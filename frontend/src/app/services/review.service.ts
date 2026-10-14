import { HttpClient, HttpHeaders } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, from, mergeMap, Observable, of } from 'rxjs';
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

export interface ProductReviewSummaryResult {
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

const REVIEW_REQUEST_CONCURRENCY = 6;

@Injectable({ providedIn: 'root' })
export class ReviewService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);

  getProductReviewSummaries(productIds: number[]): Observable<ProductReviewSummaryResult> {
    return from(productIds).pipe(
      mergeMap(
        (productId) =>
          this.getProductReviews(productId).pipe(
            mergeMap((reviews) => of({ productId, reviews, failed: false })),
            catchError(() => of({ productId, reviews: null, failed: true })),
          ),
        REVIEW_REQUEST_CONCURRENCY,
      ),
    );
  }

  getProductReviews(productId: number): Observable<ProductReviews> {
    return this.http.get<ProductReviews>(
      `${API_BASE_URL}/productos/${productId}/resenas`,
    );
  }

  submitReview(productId: number, review: ReviewInput): Observable<CreatedReview> {
    const token = this.authService.accessToken();
    if (!token) {
      throw new Error('Se requiere iniciar sesión para enviar una calificación.');
    }

    return this.http.post<CreatedReview>(
      `${API_BASE_URL}/productos/${productId}/resenas`,
      review,
      { headers: new HttpHeaders({ Authorization: `Bearer ${token}` }) },
    );
  }
}
