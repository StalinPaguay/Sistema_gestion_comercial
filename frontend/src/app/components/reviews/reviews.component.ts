import { CurrencyPipe, DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { catchError, from, mergeMap, of, Subscription, switchMap, throwError, toArray } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { Product, ProductService } from '../../services/product.service';
import { CreatedReview, ReviewInput, ReviewService } from '../../services/review.service';

interface ReviewEntry {
  product: Product;
  review: CreatedReview;
}

@Component({
  selector: 'app-reviews',
  standalone: true,
  imports: [CurrencyPipe, DatePipe, FormsModule, RouterLink],
  templateUrl: './reviews.component.html',
  styleUrl: './reviews.component.css',
})
export class ReviewsComponent implements OnInit, OnDestroy {
  private readonly authService = inject(AuthService);
  private readonly productService = inject(ProductService);
  private readonly reviewService = inject(ReviewService);
  private readonly router = inject(Router);
  private lookupSubscription?: Subscription;
  private saveSubscription?: Subscription;

  protected readonly reviews = signal<ReviewEntry[]>([]);
  protected readonly loading = signal(true);
  protected readonly errorMessage = signal('');
  protected readonly failedLookups = signal(0);
  protected readonly totalProducts = signal(0);
  protected readonly checkedProducts = signal(0);
  protected readonly editingReviewId = signal<number | null>(null);
  protected readonly editRating = signal(0);
  protected readonly editComment = signal('');
  protected readonly savingReviewId = signal<number | null>(null);
  protected readonly saveMessage = signal('');
  protected readonly stars = [1, 2, 3, 4, 5];

  ngOnInit(): void {
    if (!this.authService.accessToken()) {
      void this.router.navigate(['/login'], { queryParams: { returnUrl: '/reviews' } });
      return;
    }
    this.loadReviews();
  }

  ngOnDestroy(): void {
    this.lookupSubscription?.unsubscribe();
    this.saveSubscription?.unsubscribe();
  }

  protected reload(): void {
    this.loadReviews();
  }

  protected beginEdit(entry: ReviewEntry): void {
    this.editingReviewId.set(entry.review.ResenaId);
    this.editRating.set(entry.review.Calificacion);
    this.editComment.set(entry.review.Comentario ?? '');
    this.errorMessage.set('');
    this.saveMessage.set('');
  }

  protected cancelEdit(): void {
    this.editingReviewId.set(null);
    this.saveMessage.set('');
  }

  protected setRating(rating: number): void {
    this.editRating.set(rating);
    this.errorMessage.set('');
  }

  protected saveReview(entry: ReviewEntry): void {
    if (this.savingReviewId() !== null) return;
    const rating = this.editRating();
    if (rating < 1 || rating > 5) {
      this.errorMessage.set('Selecciona una calificación de 1 a 5 estrellas.');
      return;
    }

    const payload: ReviewInput = {
      Calificacion: rating,
      Comentario: this.editComment().trim() || null,
    };
    this.errorMessage.set('');
    this.saveMessage.set('');
    this.savingReviewId.set(entry.review.ResenaId);
    this.saveSubscription = this.reviewService
      .updateReview(entry.review.ResenaId, payload)
      .subscribe({
        next: (review) => {
          this.reviews.update((entries) =>
            entries.map((item) =>
              item.review.ResenaId === review.ResenaId ? { ...item, review } : item,
            ),
          );
          this.editingReviewId.set(null);
          this.savingReviewId.set(null);
          this.saveMessage.set('Tu reseña se actualizó correctamente.');
        },
        error: (error: unknown) => {
          this.errorMessage.set(this.requestError(error));
          this.savingReviewId.set(null);
        },
      });
  }

  private loadReviews(): void {
    this.lookupSubscription?.unsubscribe();
    this.loading.set(true);
    this.errorMessage.set('');
    this.failedLookups.set(0);
    this.checkedProducts.set(0);
    this.totalProducts.set(0);
    this.reviews.set([]);
    this.editingReviewId.set(null);
    this.lookupSubscription = this.productService
      .getProducts()
      .pipe(
        switchMap(({ data }) => {
          this.totalProducts.set(data.length);
          return from(data).pipe(
            mergeMap(
              (product) =>
                this.reviewService.getMyProductReview(product.productoId).pipe(
                  switchMap((review) => {
                    this.checkedProducts.update((checked) => checked + 1);
                    return of({ product, review, failed: false });
                  }),
                  catchError((error: unknown) => {
                    if (error instanceof HttpErrorResponse && error.status === 401) {
                      return throwError(() => error);
                    }
                    this.checkedProducts.update((checked) => checked + 1);
                    this.failedLookups.update((count) => count + 1);
                    return of({ product, review: null, failed: true });
                  }),
                ),
              6,
            ),
            toArray(),
          );
        }),
      )
      .subscribe({
        next: (results) => {
          const entries = results
            .filter(
              (result): result is typeof result & { review: CreatedReview } =>
                !result.failed && result.review !== null,
            )
            .map(({ product, review }) => ({ product, review }))
            .sort((first, second) =>
              (second.review.Fecha ?? '').localeCompare(first.review.Fecha ?? ''),
            );
          this.reviews.set(entries);
          this.loading.set(false);
        },
        error: (error: unknown) => {
          this.errorMessage.set(this.requestError(error));
          this.loading.set(false);
        },
      });
  }

  private requestError(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const detail: unknown = error.error?.detail;
      if (typeof detail === 'string') return detail;
      if (error.status === 0) return 'No se pudo conectar con el servidor de reseñas.';
      if (error.status === 401) {
        this.authService.logout();
        void this.router.navigate(['/login'], { queryParams: { returnUrl: '/reviews' } });
        return 'Tu sesión expiró. Inicia sesión nuevamente.';
      }
    }
    return 'No se pudo cargar o actualizar tu reseña. Inténtalo de nuevo.';
  }
}
