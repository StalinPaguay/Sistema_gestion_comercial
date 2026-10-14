import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { catchError, forkJoin, map, Observable, of, switchMap, tap, throwError } from 'rxjs';
import { AuthService } from './auth.service';
import { API_BASE_URL } from './api.config';
import { getProductImage, Product } from './product.service';

interface ApiFavorite {
  FavoritoId: number;
  ProductoId: number;
  Nombre: string;
  SKU: string;
  Precio: string;
  Stock: number;
  Fecha: string | null;
}

@Injectable({ providedIn: 'root' })
export class FavoritesService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly storageKey = 'tecnomega_favorites';
  private readonly legacyStorageKey = 'tecnomega_favorites_v1';
  private readonly pendingRemovalsKey = 'tecnomega_favorites_pending_removals';
  private readonly favoriteProducts = signal<Product[]>(this.loadFavorites());
  private readonly pendingRemovals = new Set<number>(this.loadPendingRemovals());

  readonly favorites = this.favoriteProducts.asReadonly();
  readonly count = computed(() => this.favoriteProducts().length);
  readonly syncError = signal('');

  toggleFavorite(product: Product): void {
    const current = this.favoriteProducts();
    const exists = current.some((favorite) => favorite.productoId === product.productoId);
    const next = exists
      ? current.filter((favorite) => favorite.productoId !== product.productoId)
      : [...current, { ...product }];

    this.favoriteProducts.set(next);
    this.persist(next);

    if (exists) {
      this.pendingRemovals.add(product.productoId);
      this.persistPendingRemovals();
      if (this.authService.accessToken()) {
        this.deleteRemoteFavorite(product.productoId).subscribe({ error: () => undefined });
      }
      return;
    }

    this.pendingRemovals.delete(product.productoId);
    this.persistPendingRemovals();
    if (this.authService.accessToken()) {
      this.addRemoteFavorite(product.productoId).subscribe({ error: () => undefined });
    }
  }

  isFavorite(productId: number): boolean {
    return this.favoriteProducts().some((product) => product.productoId === productId);
  }

  getFavorites(): Product[] {
    return this.favoriteProducts();
  }

  getFavoritesCount(): number {
    return this.count();
  }

  clearForLogout(): void {
    this.favoriteProducts.set([]);
    this.pendingRemovals.clear();
    this.syncError.set('');
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(this.storageKey);
      localStorage.removeItem(this.legacyStorageKey);
      localStorage.removeItem(this.pendingRemovalsKey);
    }
  }

  syncWithBackend(products: Product[]): Observable<void> {
    const token = this.authService.accessToken();
    if (!token) {
      return of(void 0);
    }

    this.syncError.set('');
    return this.http
      .get<ApiFavorite[]>(`${API_BASE_URL}/favoritos`, {
        headers: this.authHeaders(token),
      })
      .pipe(
        map((favorites) => {
          if (!Array.isArray(favorites)) {
            throw new Error('La respuesta de favoritos no tiene el formato esperado.');
          }
          return favorites;
        }),
        switchMap((remoteFavorites) => {
          const remoteIds = new Set(remoteFavorites.map((favorite) => favorite.ProductoId));
          const removals = [...this.pendingRemovals].filter((id) => remoteIds.has(id));
          const localToAdd = this.favoriteProducts().filter(
            (favorite) =>
              !remoteIds.has(favorite.productoId) &&
              !this.pendingRemovals.has(favorite.productoId),
          );
          const addRequests = localToAdd.map((favorite) =>
            this.addRemoteFavorite(favorite.productoId).pipe(
              map(() => ({ id: favorite.productoId, succeeded: true })),
              catchError((error: unknown) => {
                this.setSyncError(error, 'No se pudieron sincronizar todos los favoritos.');
                return of({ id: favorite.productoId, succeeded: false });
              }),
            ),
          );
          const deleteRequests = removals.map((id) =>
            this.deleteRemoteFavorite(id).pipe(
              map(() => ({ id, succeeded: true })),
              catchError((error: unknown) => {
                this.setSyncError(error, 'No se pudieron actualizar todos los favoritos.');
                return of({ id, succeeded: false });
              }),
            ),
          );
          const requests = [...addRequests, ...deleteRequests];

          const synced = remoteFavorites
            .filter((favorite) => !this.pendingRemovals.has(favorite.ProductoId))
            .map((favorite) => this.toProduct(favorite, products));
          const localOnly = this.favoriteProducts().filter(
            (favorite) =>
              !remoteIds.has(favorite.productoId) &&
              !this.pendingRemovals.has(favorite.productoId),
          );
          const resolvedProducts = [...synced, ...localOnly].filter(
            (product, index, all) =>
              all.findIndex((item) => item.productoId === product.productoId) === index,
          );

          const results$ = requests.length > 0 ? forkJoin(requests) : of([]);
          return results$.pipe(
            map((results) => {
              for (const result of results) {
                if (result.succeeded && this.pendingRemovals.has(result.id)) {
                  this.pendingRemovals.delete(result.id);
                }
              }

              this.favoriteProducts.set(resolvedProducts);
              this.persist(resolvedProducts);
              this.persistPendingRemovals();
              return void 0;
            }),
          );
        }),
        catchError((error: unknown) => {
          this.setSyncError(error, 'No se pudieron cargar los favoritos de tu cuenta.');
          return of(void 0);
        }),
      );
  }

  private addRemoteFavorite(productId: number): Observable<unknown> {
    const token = this.authService.accessToken();
    if (!token) {
      return of(void 0);
    }

    return this.http
      .post<unknown>(`${API_BASE_URL}/favoritos/${productId}`, null, {
        headers: this.authHeaders(token),
      })
      .pipe(
        catchError((error: unknown) => {
          this.setSyncError(error, 'No se pudo guardar el favorito en tu cuenta.');
          return throwError(() => error);
        }),
      );
  }

  private deleteRemoteFavorite(productId: number): Observable<unknown> {
    const token = this.authService.accessToken();
    if (!token) {
      return of(void 0);
    }

    return this.http
      .delete<unknown>(`${API_BASE_URL}/favoritos/${productId}`, {
        headers: this.authHeaders(token),
      })
      .pipe(
        tap(() => {
          this.pendingRemovals.delete(productId);
          this.persistPendingRemovals();
        }),
        catchError((error: unknown) => {
          this.setSyncError(error, 'No se pudo quitar el favorito de tu cuenta.');
          return throwError(() => error);
        }),
      );
  }

  private authHeaders(token: string): HttpHeaders {
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }

  private toProduct(favorite: ApiFavorite, products: Product[]): Product {
    const product = products.find((item) => item.productoId === favorite.ProductoId);
    if (product) {
      return { ...product };
    }

    const price = Number(favorite.Precio);
    return {
      productoId: favorite.ProductoId,
      sku: favorite.SKU,
      nombre: favorite.Nombre,
      descripcion: '',
      precio: Number.isFinite(price) ? price : 0,
      stock: favorite.Stock,
      stockMinimo: 0,
      categoria: '',
      marca: '',
      urlImagen: getProductImage(favorite.SKU),
      estado: favorite.Stock > 0,
    };
  }

  private setSyncError(error: unknown, fallback: string): void {
    if (error instanceof HttpErrorResponse) {
      const detail: unknown = error.error?.detail;
      this.syncError.set(
        typeof detail === 'string'
          ? detail
          : error.status === 0
            ? 'No se pudo conectar con el servidor de favoritos. Los cambios se guardaron localmente.'
            : fallback,
      );
      return;
    }

    this.syncError.set(
      error instanceof Error
        ? error.message
        : fallback,
    );
  }

  private loadFavorites(): Product[] {
    if (typeof localStorage === 'undefined') {
      return [];
    }

    try {
      const stored =
        localStorage.getItem(this.storageKey) ??
        localStorage.getItem(this.legacyStorageKey) ??
        '[]';
      const parsed: unknown = JSON.parse(stored);
      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed.filter((product): product is Product => this.isProduct(product));
    } catch {
      return [];
    }
  }

  private loadPendingRemovals(): number[] {
    if (typeof localStorage === 'undefined') {
      return [];
    }

    try {
      const stored: unknown = JSON.parse(
        localStorage.getItem(this.pendingRemovalsKey) ?? '[]',
      );
      return Array.isArray(stored)
        ? stored.filter((id): id is number => Number.isInteger(id) && id > 0)
        : [];
    } catch {
      return [];
    }
  }

  private isProduct(value: unknown): value is Product {
    if (!this.isRecord(value)) {
      return false;
    }

    return (
      typeof value['productoId'] === 'number' &&
      typeof value['sku'] === 'string' &&
      typeof value['nombre'] === 'string' &&
      typeof value['descripcion'] === 'string' &&
      typeof value['precio'] === 'number' &&
      typeof value['stock'] === 'number' &&
      typeof value['stockMinimo'] === 'number' &&
      typeof value['categoria'] === 'string' &&
      typeof value['marca'] === 'string' &&
      typeof value['urlImagen'] === 'string' &&
      typeof value['estado'] === 'boolean'
    );
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }

  private persist(products: Product[]): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(this.storageKey, JSON.stringify(products));
    }
  }

  private persistPendingRemovals(): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(
        this.pendingRemovalsKey,
        JSON.stringify([...this.pendingRemovals]),
      );
    }
  }
}
