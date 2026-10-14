import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AuthService } from './auth.service';
import { API_BASE_URL } from './api.config';
import { ReviewService } from './review.service';

describe('ReviewService catalog summaries', () => {
  let service: ReviewService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        ReviewService,
        {
          provide: AuthService,
          useValue: { accessToken: () => 'test-access-token' },
        },
      ],
    });
    service = TestBed.inject(ReviewService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('limits catalog review requests to six concurrent requests', () => {
    const productIds = [1, 2, 3, 4, 5, 6, 7];
    const results: number[] = [];

    service.getProductReviewSummaries(productIds).subscribe((value) => {
      results.push(value.productId);
    });

    const initialRequests = httpTesting.match((request) =>
      request.url.startsWith(`${API_BASE_URL}/productos/`),
    );
    expect(initialRequests).toHaveLength(6);

    initialRequests[0].flush(reviewResponse(1));
    const seventhRequest = httpTesting.expectOne(`${API_BASE_URL}/productos/7/resenas`);
    seventhRequest.flush(reviewResponse(7));
    for (const request of initialRequests.slice(1)) {
      const productId = Number(request.request.url.split('/').at(-2));
      request.flush(reviewResponse(productId));
    }

    expect(results).toHaveLength(productIds.length);
    expect(results.sort()).toEqual(productIds);
  });

  it('returns failed review results so the catalog can show an error', () => {
    const results: Array<{ productId: number; reviews: unknown; failed: boolean }> = [];

    service.getProductReviewSummaries([10, 11]).subscribe((value) => {
      results.push(value);
    });

    httpTesting
      .expectOne(`${API_BASE_URL}/productos/10/resenas`)
      .flush({ detail: 'Unavailable' }, { status: 503, statusText: 'Unavailable' });
    httpTesting.expectOne(`${API_BASE_URL}/productos/11/resenas`).flush(reviewResponse(11));

    expect(results.find((result) => result.productId === 10)).toEqual({
      productId: 10,
      reviews: null,
      failed: true,
    });
    expect(results.find((result) => result.productId === 11)?.failed).toBe(false);
  });

  it('submits a review to the backend create endpoint with the authenticated token', () => {
    const review = { Calificacion: 5, Comentario: 'Excelente producto' };
    let result: unknown;

    service.submitReview(23, review).subscribe((response) => {
      result = response;
    });

    const request = httpTesting.expectOne(`${API_BASE_URL}/productos/23/resenas`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(review);
    expect(request.request.headers.get('Authorization')).toBe('Bearer test-access-token');
    request.flush({
      ResenaId: 7,
      ProductoId: 23,
      Calificacion: 5,
      Comentario: 'Excelente producto',
      Fecha: '2025-03-01T12:00:00',
    });

    expect(result).toEqual({
      ResenaId: 7,
      ProductoId: 23,
      Calificacion: 5,
      Comentario: 'Excelente producto',
      Fecha: '2025-03-01T12:00:00',
    });
  });

  function reviewResponse(productId: number): object {
    return {
      ProductoId: productId,
      TotalResenas: 0,
      CalificacionPromedio: 0,
      Resenas: [],
    };
  }
});
