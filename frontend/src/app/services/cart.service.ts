import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { Observable, concatMap, from, last, of, switchMap, tap } from 'rxjs';
import { API_BASE_URL } from './api.config';
import { getProductImage, Product } from './product.service';

export interface CartItem {
  product: Product;
  quantity: number;
  apiDetailId?: number;
}

export interface ApiCartItem {
  DetalleCarritoId: number;
  ProductoId: number;
  Nombre: string;
  SKU: string;
  Precio: string;
  Cantidad: number;
  StockDisponible: number;
  Subtotal: string;
}

export interface ApiCartResponse {
  CarritoId: number;
  ClienteId: number;
  FechaActualizacion: string | null;
  TotalItems: number;
  Subtotal: string;
  Items: ApiCartItem[];
}

export interface AddCartItemRequest {
  ProductoId: number;
  Cantidad: number;
}

export interface UpdateCartItemRequest {
  Cantidad: number;
}

@Injectable({ providedIn: 'root' })
export class CartService {
  private readonly http = inject(HttpClient);
  private readonly storageKey = 'tecnomega_cart_v1';
  readonly items = signal<CartItem[]>(this.loadItems());
  readonly count = computed(() =>
    this.items().reduce((total, item) => total + item.quantity, 0),
  );
  readonly subtotal = computed(() =>
    this.items().reduce((total, item) => total + item.product.precio * item.quantity, 0),
  );
  readonly tax = computed(() => Math.round((this.subtotal() * 0.15 + Number.EPSILON) * 100) / 100);
  readonly shipping = computed(() => 0);
  readonly total = computed(() => this.subtotal() + this.tax() + this.shipping());

  getRemoteCart(): Observable<ApiCartResponse> {
    return this.http.get<ApiCartResponse>(`${API_BASE_URL}/carrito`);
  }

  reconcileGuestCart(availableProducts: Product[] = []): Observable<ApiCartResponse> {
    return this.getRemoteCart().pipe(
      switchMap((remoteCart) => {
        const guestItems = this.items().filter((item) => item.apiDetailId === undefined);
        if (!guestItems.length) {
          return of(remoteCart);
        }

        return from(guestItems).pipe(
          concatMap((item) =>
            this.addRemoteProduct(item.product.productoId, item.quantity),
          ),
          last(),
        );
      }),
      tap((response) => this.syncFromApi(response, availableProducts)),
    );
  }

  addRemoteProduct(productId: number, quantity = 1): Observable<ApiCartResponse> {
    const request: AddCartItemRequest = { ProductoId: productId, Cantidad: quantity };
    return this.http.post<ApiCartResponse>(`${API_BASE_URL}/carrito/items`, request);
  }

  updateRemoteQuantity(
    detailId: number,
    quantity: number,
  ): Observable<ApiCartResponse> {
    const request: UpdateCartItemRequest = { Cantidad: quantity };
    return this.http.patch<ApiCartResponse>(
      `${API_BASE_URL}/carrito/items/${detailId}`,
      request,
    );
  }

  removeRemoteItem(detailId: number): Observable<ApiCartResponse> {
    return this.http.delete<ApiCartResponse>(`${API_BASE_URL}/carrito/items/${detailId}`);
  }

  clearRemoteCart(): Observable<ApiCartResponse> {
    return this.http.delete<ApiCartResponse>(`${API_BASE_URL}/carrito`);
  }

  syncFromApi(response: ApiCartResponse, availableProducts: Product[] = []): void {
    const existingItems = this.items();
    const items = response.Items.map((apiItem): CartItem => {
      const product =
        availableProducts.find((item) => item.productoId === apiItem.ProductoId) ??
        existingItems.find((item) => item.product.productoId === apiItem.ProductoId)?.product;
      const price = Number(apiItem.Precio);
      if (!Number.isFinite(price)) {
        throw new Error(`El precio del producto ${apiItem.ProductoId} no es válido.`);
      }

      return {
        product: product
          ? { ...product, precio: price, stock: apiItem.StockDisponible }
          : {
              productoId: apiItem.ProductoId,
              sku: apiItem.SKU,
              nombre: apiItem.Nombre,
              descripcion: '',
              precio: price,
              stock: apiItem.StockDisponible,
              stockMinimo: 0,
              categoria: '',
              marca: '',
              urlImagen: getProductImage(apiItem.SKU),
              estado: true,
            },
        quantity: apiItem.Cantidad,
        apiDetailId: apiItem.DetalleCarritoId,
      };
    });
    this.setItems(items);
  }

  addProduct(product: Product, amount = 1): boolean {
    if (amount <= 0 || product.stock <= 0 || !product.estado) {
      return false;
    }

    const current = this.items().find((item) => item.product.productoId === product.productoId);
    const nextQuantity = (current?.quantity ?? 0) + amount;
    if (nextQuantity > product.stock) {
      return false;
    }

    const next = current
      ? this.items().map((item) =>
          item.product.productoId === product.productoId
            ? { ...item, product: { ...product }, quantity: nextQuantity }
            : item,
        )
      : [...this.items(), { product: { ...product }, quantity: amount }];

    this.setItems(next);
    return true;
  }

  removeProduct(productId: number): void {
    this.setItems(this.items().filter((item) => item.product.productoId !== productId));
  }

  updateQuantity(productId: number, quantity: number): void {
    if (!Number.isFinite(quantity)) {
      return;
    }
    if (quantity < 1) {
      this.removeProduct(productId);
      return;
    }

    const next = this.items().map((item) =>
      item.product.productoId === productId
        ? { ...item, quantity: Math.min(Math.floor(quantity), item.product.stock) }
        : item,
    );
    this.setItems(next.filter((item) => item.quantity > 0));
  }

  clear(): void {
    this.setItems([]);
  }

  private setItems(items: CartItem[]): void {
    this.items.set(items);
    this.persist(items);
  }

  private loadItems(): CartItem[] {
    if (typeof localStorage === 'undefined') {
      return [];
    }

    try {
      const stored: unknown = JSON.parse(localStorage.getItem(this.storageKey) ?? '[]');
      if (!Array.isArray(stored)) {
        return [];
      }
      return stored.flatMap((entry): CartItem[] => {
        if (!this.isRecord(entry) || !this.isRecord(entry['product'])) {
          return [];
        }

        const data = entry['product'];
        const productId = data['productoId'] ?? data['id_producto'];
        if (
          typeof productId !== 'number' ||
          typeof data['nombre'] !== 'string' ||
          typeof data['precio'] !== 'number' ||
          typeof data['stock'] !== 'number' ||
          typeof entry['quantity'] !== 'number' ||
          entry['quantity'] <= 0
        ) {
          return [];
        }

        const product: Product = {
          productoId: productId,
          sku: typeof data['sku'] === 'string' ? data['sku'] : '',
          nombre: data['nombre'],
          descripcion: typeof data['descripcion'] === 'string' ? data['descripcion'] : '',
          precio: data['precio'],
          stock: data['stock'],
          stockMinimo: typeof data['stockMinimo'] === 'number' ? data['stockMinimo'] : 0,
          categoria: typeof data['categoria'] === 'string' ? data['categoria'] : '',
          marca: typeof data['marca'] === 'string' ? data['marca'] : '',
          urlImagen:
            typeof data['urlImagen'] === 'string'
              ? data['urlImagen']
              : typeof data['imagen_url'] === 'string'
                ? data['imagen_url']
                : getProductImage(typeof data['sku'] === 'string' ? data['sku'] : ''),
          estado: typeof data['estado'] === 'boolean' ? data['estado'] : true,
        };

        return [
          {
            product,
            quantity: entry['quantity'],
            ...(typeof entry['apiDetailId'] === 'number'
              ? { apiDetailId: entry['apiDetailId'] }
              : {}),
          },
        ];
      });
    } catch {
      return [];
    }
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }

  private persist(items: CartItem[]): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(this.storageKey, JSON.stringify(items));
    }
  }
}
