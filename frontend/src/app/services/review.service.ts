import { HttpClient, HttpHeaders } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  catchError,
  from,
  map,
  mergeMap,
  Observable,
  of,
  shareReplay,
  tap,
  throwError,
} from 'rxjs';
import { API_BASE_URL } from './api.config';
import { AuthService } from './auth.service';

export interface ProductReview {
  ResenaId: number;
  Usuario: string;
  Calificacion: number;
  Comentario: string | null;
  Fecha: string | null;
}

export interface ProductReviews {
  ProductoId: number;
  TotalResenas: number;
  CalificacionPromedio: number;
  Resenas: ProductReview[];
}

export interface ProductReviewSummary {
  productId: number;
  reviews: ProductReviews | null;
  failed: boolean;
}

export interface ReviewInput {
  Calificacion: number;
  Comentario: string | null;
}

export interface CreatedReview {
  ResenaId: number;
  ProductoId: number;
  Calificacion: number;
  Comentario: string | null;
  Fecha: string;
}

interface MyReviewResponse {
  resena?: CreatedReview | null;
  ResenaId?: number;
  ProductoId?: number;
  Calificacion?: number;
  Comentario?: string | null;
  Fecha?: string | null;
}

@Injectable({ providedIn: 'root' })
export class ReviewService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly reviewCacheTtlMs = 30_000;
  private readonly productReviewsCache = new Map<
    number,
    { expiresAt: number; request: Observable<ProductReviews> }
  >();

  getProductReviews(productId: number): Observable<ProductReviews> {
    const now = Date.now();
    for (const [cachedProductId, cached] of this.productReviewsCache) {
      if (cached.expiresAt <= now) {
        this.productReviewsCache.delete(cachedProductId);
      }
    }

    const cached = this.productReviewsCache.get(productId);
    if (cached) {
      return cached.request;
    }

    let request: Observable<ProductReviews>;
    request = this.http
      .get<ProductReviews>(`${API_BASE_URL}/productos/${productId}/resenas`)
      .pipe(
        catchError((error: unknown) => {
          if (this.productReviewsCache.get(productId)?.request === request) {
            this.productReviewsCache.delete(productId);
          }
          return throwError(() => error);
        }),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
    this.productReviewsCache.set(productId, {
      expiresAt: now + this.reviewCacheTtlMs,
      request,
    });
    return request;
  }

  getProductReviewSummaries(productIds: number[]): Observable<ProductReviewSummary> {
    return from(productIds).pipe(
      mergeMap(
        (productId) =>
          this.getProductReviews(productId).pipe(
            map((reviews): ProductReviewSummary => ({
              productId,
              reviews,
              failed: false,
            })),
            catchError(() =>
              of<ProductReviewSummary>({ productId, reviews: null, failed: true }),
            ),
          ),
        6,
      ),
    );
  }

  getMyProductReview(productId: number): Observable<CreatedReview | null> {
    return this.http
      .get<MyReviewResponse>(`${API_BASE_URL}/productos/${productId}/resenas/me`, {
        headers: this.authHeaders(),
      })
      .pipe(
        map((response) => {
          if ('resena' in response) {
            return response.resena ?? null;
          }
          if (
            typeof response.ResenaId !== 'number' ||
            typeof response.ProductoId !== 'number' ||
            typeof response.Calificacion !== 'number'
          ) {
            throw new Error('La API devolvió una reseña propia con formato inesperado.');
          }
          return {
            ResenaId: response.ResenaId,
            ProductoId: response.ProductoId,
            Calificacion: response.Calificacion,
            Comentario: response.Comentario ?? null,
            Fecha: response.Fecha ?? '',
          };
        }),
      );
  }

  updateReview(reviewId: number, review: ReviewInput): Observable<CreatedReview> {
    return this.http.put<CreatedReview>(`${API_BASE_URL}/resenas/${reviewId}`, review, {
      headers: this.authHeaders(),
    }).pipe(tap((updatedReview) => this.invalidateProductReviews(updatedReview.ProductoId)));
  }

  invalidateProductReviews(productId: number): void {
    this.productReviewsCache.delete(productId);
  }

  private authHeaders(): HttpHeaders {
    const token = this.authService.accessToken();
    if (!token) {
      throw new Error('Se requiere iniciar sesión para gestionar tus reseñas.');
    }
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }

  submitReview(productId: number, review: ReviewInput): Observable<CreatedReview> {
    const token = this.authService.accessToken();
    if (!token) {
      throw new Error('Se requiere iniciar sesión para enviar una calificación.');
    }

    this.invalidateProductReviews(productId);
    return this.http.post<CreatedReview>(
      `${API_BASE_URL}/productos/${productId}/resenas`,
      review,
      { headers: new HttpHeaders({ Authorization: `Bearer ${token}` }) },
    );
  }
}
