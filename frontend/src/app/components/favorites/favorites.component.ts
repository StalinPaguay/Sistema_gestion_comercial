import { CurrencyPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { CartService } from '../../services/cart.service';
import { FavoritesService } from '../../services/favorites.service';
import { Product } from '../../services/product.service';
import { AddToCartModalComponent } from '../add-to-cart-modal/add-to-cart-modal.component';

@Component({
  selector: 'app-favorites',
  standalone: true,
  imports: [AddToCartModalComponent, CurrencyPipe, RouterLink],
  templateUrl: './favorites.component.html',
  styleUrl: './favorites.component.css',
})
export class FavoritesComponent {
  protected readonly favoritesService = inject(FavoritesService);
  private readonly authService = inject(AuthService);
  private readonly cartService = inject(CartService);
  private readonly router = inject(Router);
  protected readonly feedback = signal('');
  protected readonly selectedProduct = signal<Product | null>(null);
  protected readonly addingToCart = signal(false);
  protected readonly cartError = signal('');

  protected get availableQuantity(): number {
    const product = this.selectedProduct();
    if (!product) {
      return 0;
    }
    const existingQuantity =
      this.cartService.items().find((item) => item.product.productoId === product.productoId)
        ?.quantity ?? 0;
    return Math.max(0, product.stock - existingQuantity);
  }

  protected formatIndex(index: number): string {
    return String(index + 1).padStart(2, '0');
  }

  protected removeFavorite(product: Product): void {
    this.favoritesService.toggleFavorite(product);
    this.feedback.set('');
  }

  protected addToCart(product: Product): void {
    if (!product.estado || product.stock <= 0) {
      this.feedback.set('Este producto no está disponible actualmente.');
      return;
    }

    this.feedback.set('');
    this.cartError.set('');
    this.selectedProduct.set(product);
  }

  protected confirmAddToCart(quantity: number): void {
    const product = this.selectedProduct();
    if (
      !product ||
      this.addingToCart() ||
      quantity < 1 ||
      quantity > this.availableQuantity
    ) {
      return;
    }

    this.cartError.set('');
    this.addingToCart.set(true);
    if (this.authService.accessToken()) {
      this.cartService.addRemoteProduct(product.productoId, quantity).subscribe({
        next: (response) => {
          this.cartService.syncFromApi(response, this.favoritesService.getFavorites());
          this.feedback.set(`${product.nombre} se agregó al carrito.`);
          this.selectedProduct.set(null);
          this.addingToCart.set(false);
        },
        error: (error: unknown) => {
          this.cartError.set(this.requestError(error));
          this.addingToCart.set(false);
        },
      });
      return;
    }

    const added = this.cartService.addProduct(product, quantity);
    if (added) {
      this.feedback.set(`${product.nombre} se agregó al carrito.`);
      this.selectedProduct.set(null);
    } else {
      this.cartError.set(`No hay suficientes unidades disponibles de ${product.nombre}.`);
    }
    this.addingToCart.set(false);
  }

  protected closeCartModal(): void {
    if (!this.addingToCart()) {
      this.selectedProduct.set(null);
      this.cartError.set('');
    }
  }

  protected goToCart(): void {
    if (this.addingToCart()) {
      return;
    }
    this.selectedProduct.set(null);
    void this.router.navigate(['/cart']);
  }

  private requestError(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const detail: unknown = error.error?.detail;
      if (typeof detail === 'string') {
        return detail;
      }
      if (error.status === 0) {
        return 'No se pudo conectar con el servidor para actualizar el carrito.';
      }
    }
    return 'No se pudo agregar el producto al carrito.';
  }
}
