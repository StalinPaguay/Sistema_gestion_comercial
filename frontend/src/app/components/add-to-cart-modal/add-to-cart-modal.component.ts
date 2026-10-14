import { CurrencyPipe, DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, EventEmitter, inject, Input, OnChanges, OnDestroy, Output, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { Product } from '../../services/product.service';
import { ProductReview, ProductReviews, ReviewService } from '../../services/review.service';

@Component({
  selector: 'app-add-to-cart-modal',
  standalone: true,
  imports: [CurrencyPipe, DatePipe, FormsModule],
  templateUrl: './add-to-cart-modal.component.html',
  styleUrl: './add-to-cart-modal.component.css',
})
export class AddToCartModalComponent implements OnChanges, OnDestroy {
  private readonly reviewService = inject(ReviewService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private reviewsSubscription?: Subscription;

  @Input({ required: true }) product!: Product;
  @Input() availableQuantity = 0;
  @Input() adding = false;
  @Input() errorMessage = '';

  @Output() readonly confirmed = new EventEmitter<number>();
  @Output() readonly cancelled = new EventEmitter<void>();
  @Output() readonly cartOpened = new EventEmitter<void>();

  readonly stars = [1, 2, 3, 4, 5];
  quantity = 1;
  reviews: ProductReview[] = [];
  reviewsLoading = false;
  reviewsError = '';
  selectedRating = 0;
  hoverRating = 0;
  reviewComment = '';
  reviewSubmitting = false;
  reviewMessage = '';
  reviewSubmitError = '';

  get isAuthenticated(): boolean {
    return Boolean(this.authService.accessToken());
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['product'] || changes['availableQuantity']) {
      this.quantity = this.availableQuantity > 0 ? 1 : 0;
    }
    if (changes['product'] && this.product) {
      this.selectedRating = 0;
      this.hoverRating = 0;
      this.reviewComment = '';
      this.reviewMessage = '';
      this.reviewSubmitError = '';
      this.loadReviews();
    }
  }

  ngOnDestroy(): void {
    this.reviewsSubscription?.unsubscribe();
  }

  get subtotal(): number {
    return this.product.precio * this.quantity;
  }

  decrease(): void {
    this.quantity = Math.max(1, this.quantity - 1);
  }

  increase(): void {
    this.quantity = Math.min(this.availableQuantity, this.quantity + 1);
  }

  setQuantity(event: Event): void {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) {
      return;
    }
    const parsed = Number.parseInt(input.value, 10);
    this.quantity = Number.isFinite(parsed)
      ? Math.min(this.availableQuantity, Math.max(1, parsed))
      : 1;
  }

  confirm(): void {
    if (this.adding || this.availableQuantity < 1 || this.quantity < 1) {
      return;
    }
    this.confirmed.emit(this.quantity);
  }

  selectRating(rating: number): void {
    this.selectedRating = rating;
    this.reviewSubmitError = '';
  }

  submitReview(): void {
    if (!this.authService.accessToken()) {
      this.reviewSubmitError = 'Inicia sesión para enviar tu opinión.';
      return;
    }
    if (this.selectedRating < 1 || this.selectedRating > 5) {
      this.reviewSubmitError = 'Selecciona una calificación de 1 a 5 estrellas.';
      return;
    }
    if (this.reviewSubmitting) {
      return;
    }

    this.reviewSubmitting = true;
    this.reviewSubmitError = '';
    this.reviewMessage = '';
    this.reviewService.submitReview(this.product.productoId, {
      Calificacion: this.selectedRating,
      Comentario: this.reviewComment.trim() || null,
    }).subscribe({
      next: () => {
        this.reviewSubmitting = false;
        this.reviewMessage = '¡Gracias! Tu opinión se registró correctamente.';
        this.selectedRating = 0;
        this.reviewComment = '';
        this.loadReviews();
      },
      error: (error: unknown) => {
        this.reviewSubmitting = false;
        this.reviewSubmitError = this.getRequestErrorMessage(
          error,
          'No se pudo enviar tu opinión. Inténtalo de nuevo.',
        );
      },
    });
  }

  goToLogin(): void {
    void this.router.navigate(['/login'], {
      queryParams: { returnUrl: '/products' },
    });
  }

  reloadReviews(): void {
    this.loadReviews();
  }

  private loadReviews(): void {
    this.reviewsSubscription?.unsubscribe();
    this.reviews = [];
    this.reviewsLoading = true;
    this.reviewsError = '';
    this.reviewsSubscription = this.reviewService
      .getProductReviews(this.product.productoId)
      .subscribe({
        next: (result: ProductReviews) => {
          this.reviews = result.Resenas;
          this.reviewsLoading = false;
        },
        error: (error: unknown) => {
          this.reviewsError = this.getRequestErrorMessage(
            error,
            'No se pudieron cargar las reseñas. Inténtalo de nuevo.',
          );
          this.reviewsLoading = false;
        },
      });
  }

  private getRequestErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof HttpErrorResponse) {
      const detail: unknown = error.error?.detail;
      if (typeof detail === 'string') {
        return detail;
      }
      if (error.status === 0) {
        return 'No se pudo conectar con el servidor. Inténtalo de nuevo.';
      }
    }
    return fallback;
  }

  stopPropagation(event: MouseEvent): void {
    event.stopPropagation();
  }
}
