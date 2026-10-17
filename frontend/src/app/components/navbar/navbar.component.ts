import { CurrencyPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, ElementRef, HostListener, inject, OnInit, signal, ViewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { CartService } from '../../services/cart.service';
import { CatalogNavigationService } from '../../services/catalog-navigation.service';
import { FavoritesService } from '../../services/favorites.service';
import { Product, ProductService } from '../../services/product.service';
import { ThemeService } from '../../services/theme.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CurrencyPipe, RouterLink],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.css',
})
export class NavbarComponent implements OnInit {
  protected readonly cartService = inject(CartService);
  protected readonly catalogNavigation = inject(CatalogNavigationService);
  protected readonly favoritesService = inject(FavoritesService);
  protected readonly favoritesOpen = signal(false);
  protected readonly accountMenuOpen = signal(false);
  protected readonly cartMessage = signal('');
  protected readonly cartMenuOpen = signal(false);
  protected readonly cartLoading = signal(false);
  protected readonly cartPreviewError = signal('');
  protected readonly themeService = inject(ThemeService);
  private readonly productService = inject(ProductService);
  private readonly router = inject(Router);
  protected readonly authService = inject(AuthService);
  @ViewChild('favoritesMenu') private favoritesMenu?: ElementRef<HTMLElement>;
  @ViewChild('accountMenu') private accountMenu?: ElementRef<HTMLElement>;
  @ViewChild('cartMenu') private cartMenu?: ElementRef<HTMLElement>;

  @HostListener('document:click', ['$event'])
  closeFavoritesOnOutsideClick(event: MouseEvent): void {
    const target = event.target;
    if (
      this.favoritesOpen() &&
      target instanceof Node &&
      !this.favoritesMenu?.nativeElement.contains(target)
    ) {
      this.favoritesOpen.set(false);
    }
    if (
      this.accountMenuOpen() &&
      target instanceof Node &&
      !this.accountMenu?.nativeElement.contains(target)
    ) {
      this.accountMenuOpen.set(false);
    }
    if (this.cartMenuOpen() && target instanceof Node && !this.cartMenu?.nativeElement.contains(target)) {
      this.cartMenuOpen.set(false);
    }
  }

  @HostListener('document:keydown.escape')
  closeFavoritesOnEscape(): void {
    this.favoritesOpen.set(false);
    this.accountMenuOpen.set(false);
    this.cartMenuOpen.set(false);
  }

  ngOnInit(): void {
    this.productService.getCategories().subscribe({
      next: (result) => this.catalogNavigation.setCategories(result.data),
    });
  }

  selectCategory(category: string): void {
    this.catalogNavigation.selectedCategory.set(category);
    void this.router.navigate(['/products'], { fragment: 'productos' });
  }

  updateSearch(event: Event): void {
    const input = event.target;
    if (input instanceof HTMLInputElement) {
      this.catalogNavigation.searchTerm.set(input.value);
    }
  }

  toggleTheme(): void {
    this.themeService.toggleTheme();
  }

  toggleFavorites(): void {
    this.favoritesOpen.update((open) => !open);
    this.accountMenuOpen.set(false);
    this.cartMenuOpen.set(false);
    this.cartMessage.set('');
  }

  toggleCartMenu(): void {
    this.cartMenuOpen.update((open) => !open);
    this.favoritesOpen.set(false);
    this.accountMenuOpen.set(false);
    if (this.cartMenuOpen()) {
      this.loadRemoteCartPreview();
    }
  }

  openCart(): void {
    this.cartMenuOpen.set(false);
    void this.router.navigate(['/cart']);
  }

  toggleAccountMenu(): void {
    this.accountMenuOpen.update((open) => !open);
    this.favoritesOpen.set(false);
  }

  logout(): void {
    this.accountMenuOpen.set(false);
    this.favoritesService.clearForLogout();
    this.authService.logout();
    void this.router.navigate(['/login']);
  }

  addFavoriteToCart(product: Product): void {
    if (!product.estado || product.stock <= 0) {
      this.cartMessage.set('Este producto no está disponible actualmente.');
      return;
    }

    if (this.authService.accessToken()) {
      this.cartService.addRemoteProduct(product.productoId).subscribe({
        next: (response) => {
          this.cartService.syncFromApi(response, this.favoritesService.getFavorites());
          this.cartMessage.set(`${product.nombre} se agregó al carrito.`);
        },
        error: (error: unknown) => this.setCartError(error),
      });
      return;
    }

    this.cartMessage.set(
      this.cartService.addProduct(product)
        ? `${product.nombre} se agregó al carrito.`
        : `No hay más unidades disponibles de ${product.nombre}.`,
    );
  }

  openFavorites(): void {
    this.favoritesOpen.set(false);
    void this.router.navigate(['/favorites']);
  }

  private setCartError(error: unknown): void {
    if (error instanceof HttpErrorResponse) {
      const detail: unknown = error.error?.detail;
      this.cartMessage.set(
        typeof detail === 'string'
          ? detail
          : error.status === 0
            ? 'No se pudo conectar con el servidor para actualizar el carrito.'
            : 'No se pudo agregar el producto al carrito.',
      );
      return;
    }

    this.cartMessage.set('No se pudo agregar el producto al carrito.');
  }

  private loadRemoteCartPreview(): void {
    this.cartPreviewError.set('');
    if (!this.authService.accessToken()) return;

    this.cartLoading.set(true);
    this.cartService.getRemoteCart().subscribe({
      next: (response) => {
        if (response.Items.length || !this.cartService.items().length) {
          this.cartService.syncFromApi(response, this.favoritesService.getFavorites());
        }
        this.cartLoading.set(false);
      },
      error: (error: unknown) => {
        this.cartPreviewError.set(
          error instanceof HttpErrorResponse && error.status === 0
            ? 'No se pudo actualizar el carrito desde el servidor; se muestran los artículos guardados en este navegador.'
            : 'No se pudo actualizar el carrito; se muestran los artículos guardados en este navegador.',
        );
        this.cartLoading.set(false);
      },
    });
  }
}
