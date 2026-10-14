import { CurrencyPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  Component,
  ElementRef,
  HostListener,
  inject,
  OnInit,
  signal,
  ViewChild,
} from '@angular/core';
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
  protected readonly mobileMenuOpen = signal(false);
  protected readonly minimumRatingOptions = [4, 3, 2, 1];
  protected readonly cartMessage = signal('');
  protected readonly themeService = inject(ThemeService);
  private readonly productService = inject(ProductService);
  private readonly router = inject(Router);
  protected readonly authService = inject(AuthService);
  @ViewChild('navbarRoot') private navbarRoot?: ElementRef<HTMLElement>;
  @ViewChild('favoritesMenu') private favoritesMenu?: ElementRef<HTMLElement>;
  @ViewChild('accountMenu') private accountMenu?: ElementRef<HTMLElement>;

  @HostListener('document:click', ['$event'])
  closeFavoritesOnOutsideClick(event: MouseEvent): void {
    const target = event.target;
    if (
      this.mobileMenuOpen() &&
      target instanceof Node &&
      !this.navbarRoot?.nativeElement.contains(target)
    ) {
      this.closeMobileMenu();
    }
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
  }

  @HostListener('document:keydown.escape')
  closeFavoritesOnEscape(): void {
    this.favoritesOpen.set(false);
    this.accountMenuOpen.set(false);
    this.closeMobileMenu();
  }

  toggleMobileMenu(): void {
    this.mobileMenuOpen.update((open) => !open);
    this.favoritesOpen.set(false);
    this.accountMenuOpen.set(false);
  }

  closeMobileMenu(): void {
    this.mobileMenuOpen.set(false);
  }

  ngOnInit(): void {
    this.productService.getCategories().subscribe({
      next: (result) => this.catalogNavigation.setCategories(result.data),
    });
  }

  selectCategory(category: string): void {
    this.catalogNavigation.selectedCategory.set(category);
    this.catalogNavigation.selectedCategories.set([]);
    this.closeMobileMenu();
    void this.router.navigate(['/products'], { fragment: 'productos' });
  }

  toggleMobileCategory(category: string): void {
    const selected = this.catalogNavigation.selectedCategories();
    this.catalogNavigation.selectedCategory.set('');
    this.catalogNavigation.selectedCategories.set(
      selected.includes(category)
        ? selected.filter((item) => item !== category)
        : [...selected, category],
    );
  }

  updateMobileMaxPrice(event: Event): void {
    const input = event.target;
    if (input instanceof HTMLInputElement) {
      this.catalogNavigation.selectedMaxPrice.set(Number(input.value));
    }
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
    this.cartMessage.set('');
  }

  toggleAccountMenu(): void {
    this.accountMenuOpen.update((open) => !open);
    this.favoritesOpen.set(false);
  }

  logout(): void {
    this.accountMenuOpen.set(false);
    this.closeMobileMenu();
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
    this.closeMobileMenu();
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
}
