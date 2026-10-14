import { CurrencyPipe, DatePipe, DecimalPipe, NgFor, NgIf } from '@angular/common';
import { ChangeDetectorRef, Component, effect, inject, OnDestroy, OnInit } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { forkJoin, Subscription } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { CartService } from '../../services/cart.service';
import { FavoritesService } from '../../services/favorites.service';
import { Product, ProductCategory, ProductService } from '../../services/product.service';
import { ProductReview, ProductReviews, ReviewService } from '../../services/review.service';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CatalogNavigationService } from '../../services/catalog-navigation.service';
import { AddToCartModalComponent } from '../add-to-cart-modal/add-to-cart-modal.component';

@Component({
  selector: 'app-products',
  standalone: true,
  imports: [
    AddToCartModalComponent,
    CurrencyPipe,
    DatePipe,
    DecimalPipe,
    FormsModule,
    MatIconModule,
    MatTooltipModule,
    NgFor,
    NgIf,
    RouterLink,
  ],
  templateUrl: './products.component.html',
  styleUrl: './products.component.css',
})
export class ProductsComponent implements OnInit, OnDestroy {
  private readonly productService = inject(ProductService);
  private readonly cartService = inject(CartService);
  private readonly catalogNavigation = inject(CatalogNavigationService);
  protected readonly favoritesService = inject(FavoritesService);
  private readonly authService = inject(AuthService);
  private readonly reviewService = inject(ReviewService);
  private readonly router = inject(Router);
  private readonly changeDetector = inject(ChangeDetectorRef);
  readonly ratingStars = [1, 2, 3, 4, 5];

  readonly banners: string[] = [
    'images/publicidad/Publicidad 1.jpg',
    'images/publicidad/Publicidad 2.jpg',
    'images/publicidad/Publicidad 3.jpg',
    'images/publicidad/Publicidad 4.jpg',
  ];
  products: Product[] = [];
  categories: ProductCategory[] = [];
  cartNotice = '';
  cartNoticeError = false;
  loading = true;
  loadWarning = '';
  detailLoading = false;
  detailWarning = '';
  selectedProduct: Product | null = null;
  cartProductToAdd: Product | null = null;
  cartAddError = '';
  cartAdding = false;
  ratingSummaries: Record<number, ProductReviews | null | undefined> = {};
  ratingLoadWarning = '';
  ratingLoading = false;
  selectedReviews: ProductReview[] = [];
  reviewsExpanded = false;
  selectedRating = 0;
  hoverRating = 0;
  reviewComment = '';
  reviewLoading = false;
  reviewSubmitting = false;
  reviewMessage = '';
  reviewError = '';
  currentIndex = 0;
  private autoSlideInterval: ReturnType<typeof setInterval> | undefined;
  private noticeTimeout: ReturnType<typeof setTimeout> | undefined;
  private detailSubscription?: Subscription;
  private selectedReviewsSubscription?: Subscription;

  constructor(private readonly cdr: ChangeDetectorRef) {
    effect(() => {
      const syncError = this.favoritesService.syncError();
      if (syncError) {
        this.showCartNotice(syncError, true);
      }
    });
  }

  get selectedCategory(): string {
    return this.catalogNavigation.selectedCategory();
  }

  set selectedCategory(category: string) {
    this.catalogNavigation.selectedCategory.set(category);
  }

  get selectedCategories(): string[] {
    return this.catalogNavigation.selectedCategories();
  }

  set selectedCategories(categories: string[]) {
    this.catalogNavigation.selectedCategories.set(categories);
  }

  get selectedMaxPrice(): number {
    return this.catalogNavigation.selectedMaxPrice();
  }

  set selectedMaxPrice(price: number) {
    this.catalogNavigation.selectedMaxPrice.set(price);
  }

  get selectedMinimumRating(): number {
    return this.catalogNavigation.selectedMinimumRating();
  }

  set selectedMinimumRating(rating: number) {
    this.catalogNavigation.selectedMinimumRating.set(rating);
  }

  get searchTerm(): string {
    return this.catalogNavigation.searchTerm();
  }

  ngOnInit(): void {
    this.loadCatalog();
    this.startAutoSlide();
  }

  ngOnDestroy(): void {
    this.stopAutoSlide();
    this.detailSubscription?.unsubscribe();
    this.selectedReviewsSubscription?.unsubscribe();
    if (this.noticeTimeout) {
      clearTimeout(this.noticeTimeout);
    }
  }

  get filteredProducts(): Product[] {
    const term = this.searchTerm.trim().toLocaleLowerCase();
    return this.products.filter((product) => {
      const matchesCategory = this.selectedCategories.length
        ? this.selectedCategories.includes(product.categoria)
        : !this.selectedCategory || product.categoria === this.selectedCategory;
      const matchesPrice = product.precio <= this.selectedMaxPrice;
      const rating = this.ratingSummaries[product.productoId]?.CalificacionPromedio ?? 0;
      const matchesRating = rating >= this.selectedMinimumRating;
      const matchesTerm =
        !term ||
        product.nombre.toLocaleLowerCase().includes(term) ||
        product.descripcion.toLocaleLowerCase().includes(term) ||
        product.categoria.toLocaleLowerCase().includes(term);
      return matchesCategory && matchesPrice && matchesRating && matchesTerm;
    });
  }

  get maximumAvailablePrice(): number {
    return Math.max(1, Math.ceil(Math.max(0, ...this.products.map((product) => product.precio))));
  }

  get minimumRatingOptions(): number[] {
    return [4, 3, 2, 1];
  }

  get visibleReviews(): ProductReview[] {
    return this.reviewsExpanded ? this.selectedReviews : this.selectedReviews.slice(0, 5);
  }

  get hasActiveFilters(): boolean {
    return (
      this.selectedCategories.length > 0 ||
      Boolean(this.selectedCategory) ||
      this.selectedMaxPrice < this.maximumAvailablePrice ||
      this.selectedMinimumRating > 0 ||
      Boolean(this.searchTerm.trim())
    );
  }

  get emptyStateTitle(): string {
    if (this.selectedMinimumRating > 0) {
      return 'No se encontraron productos con esta calificación';
    }
    if (this.selectedCategories.length > 0 || this.selectedCategory) {
      return 'No hay productos en las categorías seleccionadas';
    }
    if (this.selectedMaxPrice < this.maximumAvailablePrice) {
      return 'No hay productos en este rango de precio';
    }
    if (this.searchTerm.trim()) {
      return 'No encontramos coincidencias';
    }
    return 'No se encontraron productos';
  }

  get emptyStateDescription(): string {
    return this.hasActiveFilters
      ? 'Intenta seleccionar otra calificación, ampliar el rango de precio o limpiar los filtros activos.'
      : 'Vuelve a intentarlo más tarde para encontrar productos en el catálogo.';
  }

  get nextIndex(): number {
    return (this.currentIndex + 1) % this.banners.length;
  }

  loadCatalog(): void {
    this.loading = true;
    this.loadWarning = '';
    forkJoin({
      products: this.productService.getProducts(),
      categories: this.productService.getCategories(),
    }).subscribe({
      next: ({ products, categories }) => {
        this.categories = categories.data;
        this.catalogNavigation.setCategories(categories.data);
        this.products = products.data.map((product) => ({
          ...product,
          categoria: product.categoria,
        }));
        this.catalogNavigation.maximumAvailablePrice.set(this.maximumAvailablePrice);
        this.selectedMaxPrice =
          this.selectedMaxPrice > 0
            ? Math.min(this.selectedMaxPrice, this.maximumAvailablePrice)
            : this.maximumAvailablePrice;
        this.loadRatingSummaries(this.products);
        if (this.authService.accessToken()) {
          this.favoritesService.syncWithBackend(this.products).subscribe();
        }
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (error: unknown) => {
        this.products = [];
        this.categories = [];
        this.ratingSummaries = {};
        this.ratingLoadWarning = '';
        this.catalogNavigation.setCategories([]);
        this.loadWarning =
          error instanceof HttpErrorResponse && error.status === 0
            ? 'No se pudo conectar con la API. El catálogo requiere datos del servidor.'
            : 'No se pudo cargar el catálogo desde la API. Inténtalo de nuevo.';
        this.loading = false;
        this.cdr.detectChanges();
      },
    });
  }

  onSearchChange(event: Event): void {
    const input = event.target;
    if (input instanceof HTMLInputElement) {
      this.catalogNavigation.searchTerm.set(input.value);
    }
  }

  onCategoryChange(category: string, event: Event): void {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) {
      return;
    }

    this.selectedCategory = '';
    this.selectedCategories = input.checked
      ? [...new Set([...this.selectedCategories, category])]
      : this.selectedCategories.filter((selected) => selected !== category);
  }

  isCategorySelected(category: string): boolean {
    return (
      this.selectedCategories.includes(category) ||
      (!this.selectedCategories.length && this.selectedCategory === category)
    );
  }

  updateMaxPrice(event: Event): void {
    const input = event.target;
    if (input instanceof HTMLInputElement) {
      this.selectedMaxPrice = Number(input.value);
    }
  }

  resetFilters(): void {
    this.selectedCategories = [];
    this.selectedCategory = '';
    this.selectedMaxPrice = this.maximumAvailablePrice;
    this.selectedMinimumRating = 0;
    this.catalogNavigation.searchTerm.set('');
  }

  toggleFavorite(product: Product): void {
    this.favoritesService.toggleFavorite(product);
  }

  addToCart(product: Product): void {
    if (product.stock <= 0 || this.cartAdding) {
      return;
    }

    this.selectedProduct = null;
    this.cartProductToAdd = product;
    this.cartAddError = '';
  }

  get cartProductAvailableQuantity(): number {
    const product = this.cartProductToAdd;
    if (!product) {
      return 0;
    }
    const alreadyInCart =
      this.cartService.items().find((item) => item.product.productoId === product.productoId)
        ?.quantity ?? 0;
    return Math.max(0, product.stock - alreadyInCart);
  }

  confirmAddToCart(quantity: number): void {
    const product = this.cartProductToAdd;
    if (
      !product ||
      this.cartAdding ||
      quantity < 1 ||
      quantity > this.cartProductAvailableQuantity
    ) {
      return;
    }

    this.cartAddError = '';
    this.cartAdding = true;
    if (this.authService.accessToken()) {
      this.cartService.addRemoteProduct(product.productoId, quantity).subscribe({
        next: (response) => {
          this.cartService.syncFromApi(response, this.products);
          this.showCartNotice(`${product.nombre} se agregó al carrito.`, false);
          this.cartProductToAdd = null;
          this.cartAdding = false;
        },
        error: (error: unknown) => {
          this.cartAddError = this.cartErrorMessage(error);
          this.cartAdding = false;
          this.cdr.detectChanges();
        },
      });
      return;
    }

    const added = this.cartService.addProduct(product, quantity);
    if (added) {
      this.showCartNotice(`${product.nombre} se agregó al carrito.`, false);
      this.cartProductToAdd = null;
    } else {
      this.cartAddError = `No hay suficientes unidades disponibles de ${product.nombre}.`;
    }
    this.cartAdding = false;
  }

  closeCartModal(): void {
    if (!this.cartAdding) {
      this.cartProductToAdd = null;
      this.cartAddError = '';
    }
  }

  goToCart(): void {
    if (this.cartAdding) {
      return;
    }
    this.cartProductToAdd = null;
    void this.router.navigate(['/cart']);
  }

  private showCartNotice(message: string, isError: boolean): void {
    this.cartNoticeError = isError;
    this.cartNotice = message;
    if (this.noticeTimeout) {
      clearTimeout(this.noticeTimeout);
    }
    this.noticeTimeout = setTimeout(() => {
      this.cartNotice = '';
      this.cdr.detectChanges();
    }, 3500);
  }

  private cartErrorMessage(error: unknown): string {
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

  showDetails(product: Product): void {
    this.detailSubscription?.unsubscribe();
    this.selectedReviewsSubscription?.unsubscribe();
    this.selectedProduct = product;
    this.detailWarning = '';
    this.detailLoading = true;
    this.selectedReviews = [];
    this.reviewsExpanded = false;
    this.selectedRating = 0;
    this.hoverRating = 0;
    this.reviewComment = '';
    this.reviewMessage = '';
    this.reviewError = '';
    this.reviewLoading = true;
    this.detailSubscription = this.productService.getProductById(product.productoId).subscribe({
      next: (result) => {
        if (this.selectedProduct?.productoId !== product.productoId) {
          return;
        }
        this.selectedProduct = result.data;
        this.detailWarning = '';
        this.detailLoading = false;
        this.cdr.detectChanges();
      },
      error: (error: unknown) => {
        if (this.selectedProduct?.productoId !== product.productoId) {
          return;
        }
        this.detailWarning =
          error instanceof HttpErrorResponse && error.status === 404
            ? 'Este producto ya no está disponible.'
            : 'No se pudo cargar el detalle del producto. Inténtalo de nuevo.';
        this.detailLoading = false;
        this.cdr.detectChanges();
      },
    });
    this.loadSelectedReviews(product.productoId);
  }

  closeDetails(): void {
    this.detailSubscription?.unsubscribe();
    this.selectedReviewsSubscription?.unsubscribe();
    this.selectedProduct = null;
    this.detailLoading = false;
    this.reviewLoading = false;
    this.reviewsExpanded = false;
    this.detailWarning = '';
    this.reviewError = '';
    this.reviewMessage = '';
  }

  isStarFilled(rating: number, star: number): boolean {
    return star <= Math.round(rating);
  }

  reviewStarString(rating: number): string {
    return `${'★'.repeat(rating)}${'☆'.repeat(5 - rating)}`;
  }

  setRating(rating: number): void {
    this.selectedRating = rating;
    this.reviewError = '';
  }

  submitReview(): void {
    const product = this.selectedProduct;
    if (!product) {
      return;
    }
    if (!this.authService.accessToken()) {
      void this.router.navigate(['/login'], {
        queryParams: { returnUrl: '/products' },
      });
      return;
    }
    if (this.selectedRating < 1 || this.selectedRating > 5) {
      this.reviewError = 'Selecciona una calificación de 1 a 5 estrellas.';
      return;
    }
    if (this.reviewSubmitting) {
      return;
    }

    this.reviewError = '';
    this.reviewMessage = '';
    this.reviewSubmitting = true;
    this.reviewService
      .submitReview(product.productoId, {
        Calificacion: this.selectedRating,
        Comentario: this.reviewComment.trim() || null,
      })
      .subscribe({
        next: () => {
          this.reviewMessage = '¡Gracias! Tu calificación se registró correctamente.';
          this.reviewSubmitting = false;
          this.selectedRating = 0;
          this.reviewComment = '';
          this.loadSelectedReviews(product.productoId);
        },
        error: (error: unknown) => {
          this.reviewError = this.reviewErrorMessage(error);
          this.reviewSubmitting = false;
          this.cdr.detectChanges();
        },
      });
  }

  private loadRatingSummaries(products: Product[]): void {
    this.ratingLoadWarning = '';
    this.ratingLoading = products.length > 0;
    for (const product of products) {
      this.ratingSummaries[product.productoId] = undefined;
    }
    if (!products.length) {
      this.ratingLoading = false;
      return;
    }

    this.reviewService
      .getProductReviewSummaries(products.map((product) => product.productoId))
      .subscribe({
        next: (result) => {
          this.ratingSummaries[result.productId] = result.reviews;
          if (result.failed) {
            const failedCount = Object.values(this.ratingSummaries).filter(
              (summary) => summary === null,
            ).length;
            this.ratingLoadWarning =
              failedCount === products.length
                ? 'No se pudieron cargar las calificaciones. Inténtalo de nuevo.'
                : `No se pudieron cargar las calificaciones de ${failedCount} producto(s).`;
          }
          this.cdr.detectChanges();
        },
        complete: () => {
          this.ratingLoading = false;
          this.cdr.detectChanges();
        },
      });
  }

  retryRatingSummaries(): void {
    this.loadRatingSummaries(this.products);
  }

  private loadSelectedReviews(productId: number): void {
    this.selectedReviewsSubscription?.unsubscribe();
    this.reviewLoading = true;
    this.selectedReviewsSubscription = this.reviewService.getProductReviews(productId).subscribe({
      next: (reviews) => {
        if (this.selectedProduct?.productoId !== productId) {
          return;
        }
        this.ratingSummaries[productId] = reviews;
        this.selectedReviews = reviews.Resenas;
        this.reviewLoading = false;
        this.cdr.detectChanges();
      },
      error: (error: unknown) => {
        if (this.selectedProduct?.productoId !== productId) {
          return;
        }
        this.ratingSummaries[productId] = null;
        this.reviewError = this.reviewErrorMessage(error);
        this.reviewLoading = false;
        this.cdr.detectChanges();
      },
    });
  }

  private reviewErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const detail: unknown = error.error?.detail;
      if (typeof detail === 'string') {
        return detail;
      }
      if (error.status === 0) {
        return 'No se pudo conectar con el servidor de reseñas.';
      }
    }
    return 'No se pudo completar la operación de reseñas. Inténtalo nuevamente.';
  }

  startAutoSlide(): void {
    this.stopAutoSlide();
    this.autoSlideInterval = setInterval(() => this.nextSlide(), 3500);
  }

  stopAutoSlide(): void {
    if (this.autoSlideInterval) {
      clearInterval(this.autoSlideInterval);
      this.autoSlideInterval = undefined;
    }
  }

  resetAutoSlide(): void {
    this.startAutoSlide();
  }

  nextSlide(): void {
    this.currentIndex = (this.currentIndex + 1) % this.banners.length;
    this.cdr.detectChanges();
  }

  prevSlide(): void {
    this.currentIndex = (this.currentIndex - 1 + this.banners.length) % this.banners.length;
    this.cdr.detectChanges();
  }

  goToSlide(index: number): void {
    this.currentIndex = index;
    this.resetAutoSlide();
  }
}
