import { CurrencyPipe, NgFor, NgIf } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { CartItem, CartService } from '../../services/cart.service';
import { Product, ProductService } from '../../services/product.service';

@Component({
  imports: [CurrencyPipe, NgFor, NgIf, RouterLink],
  selector: 'app-cart',
  styleUrl: './cart.css',
  templateUrl: './cart.html',
})
export class Cart implements OnInit {
  protected readonly cartService = inject(CartService);
  private readonly authService = inject(AuthService);
  private readonly productService = inject(ProductService);
  protected recommendedProducts: Product[] = [];
  protected feedback = '';

  ngOnInit(): void {
    this.productService.getProducts().subscribe({
      next: (result) => {
        this.recommendedProducts = result.data.slice(0, 3);
        if (this.authService.accessToken()) {
          this.loadRemoteCart(result.data);
        }
      },
      error: (error: unknown) => {
        this.recommendedProducts = [];
        this.showError(error);
      },
    });
  }

  protected remove(item: CartItem): void {
    if (this.authService.accessToken() && item.apiDetailId !== undefined) {
      this.cartService.removeRemoteItem(item.apiDetailId).subscribe({
        next: (response) => this.cartService.syncFromApi(response, this.recommendedProducts),
        error: (error: unknown) => this.showError(error),
      });
      return;
    }
    this.cartService.removeProduct(item.product.productoId);
  }

  protected updateQuantity(item: CartItem, event: Event): void {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) {
      return;
    }
    this.updateItem(item, Number(input.value));
  }

  protected decrease(item: CartItem): void {
    this.updateItem(item, item.quantity - 1);
  }

  protected increase(item: CartItem): void {
    this.updateItem(item, item.quantity + 1);
  }

  protected addRecommended(productId: number): void {
    const product = this.recommendedProducts.find((item) => item.productoId === productId);
    if (!product) {
      return;
    }

    if (this.authService.accessToken()) {
      this.cartService.addRemoteProduct(product.productoId).subscribe({
        next: (response) => this.cartService.syncFromApi(response, this.recommendedProducts),
        error: (error: unknown) => this.showError(error),
      });
      return;
    }
    this.cartService.addProduct(product);
  }

  private loadRemoteCart(products: Product[]): void {
    this.cartService.reconcileGuestCart(products).subscribe({
      next: () => undefined,
      error: (error: unknown) => this.showError(error),
    });
  }

  private updateItem(item: CartItem, quantity: number): void {
    if (this.authService.accessToken() && item.apiDetailId !== undefined) {
      const request =
        quantity < 1
          ? this.cartService.removeRemoteItem(item.apiDetailId)
          : this.cartService.updateRemoteQuantity(item.apiDetailId, quantity);
      request.subscribe({
        next: (response) => this.cartService.syncFromApi(response, this.recommendedProducts),
        error: (error: unknown) => this.showError(error),
      });
      return;
    }
    this.cartService.updateQuantity(item.product.productoId, quantity);
  }

  private showError(error: unknown): void {
    if (error instanceof HttpErrorResponse) {
      const detail: unknown = error.error?.detail;
      this.feedback =
        typeof detail === 'string'
          ? detail
          : error.status === 0
            ? 'No se pudo conectar con el servidor para actualizar el carrito.'
            : 'No se pudo actualizar el carrito. Inténtalo de nuevo.';
      return;
    }
    this.feedback = 'No se pudo actualizar el carrito. Inténtalo de nuevo.';
  }

  protected checkout(): void {
    window.alert('Tu carrito está listo. La conexión de pago aún no está disponible.');
  }
}
