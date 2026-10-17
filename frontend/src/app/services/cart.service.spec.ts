import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_BASE_URL } from './api.config';
import {
  ApiCartItem,
  ApiCartResponse,
  CartService,
} from './cart.service';
import { Product } from './product.service';

describe('CartService guest cart reconciliation', () => {
  let service: CartService;
  let httpTesting: HttpTestingController;

  const guestProduct: Product = {
    productoId: 21,
    sku: 'TM-TEST-001',
    nombre: 'Producto de prueba',
    descripcion: 'Descripción de prueba',
    precio: 25,
    stock: 10,
    stockMinimo: 1,
    categoria: 'Pruebas',
    marca: 'TECNOMEGA',
    urlImagen: '',
    estado: true,
  };

  function cartResponse(items: ApiCartItem[]): ApiCartResponse {
    return {
      CarritoId: 1,
      ClienteId: 2,
      FechaActualizacion: null,
      TotalItems: items.reduce((total, item) => total + item.Cantidad, 0),
      Subtotal: String(items.reduce((total, item) => total + Number(item.Subtotal), 0)),
      Items: items,
    };
  }

  function apiItem(quantity: number): ApiCartItem {
    return {
      DetalleCarritoId: 31,
      ProductoId: guestProduct.productoId,
      Nombre: guestProduct.nombre,
      SKU: guestProduct.sku,
      Precio: String(guestProduct.precio),
      Cantidad: quantity,
      StockDisponible: guestProduct.stock,
      Subtotal: String(guestProduct.precio * quantity),
    };
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), CartService],
    });
    service = TestBed.inject(CartService);
    httpTesting = TestBed.inject(HttpTestingController);
    service.clear();
  });

  afterEach(() => {
    httpTesting.verify();
    service.clear();
  });

  it('moves a guest item into the remote cart without losing its quantity', () => {
    expect(service.addProduct(guestProduct, 2)).toBe(true);

    let result: ApiCartResponse | undefined;
    service.reconcileGuestCart([guestProduct]).subscribe((response) => {
      result = response;
    });

    httpTesting.expectOne(`${API_BASE_URL}/carrito`).flush(cartResponse([]));
    const addRequest = httpTesting.expectOne(`${API_BASE_URL}/carrito/items`);
    expect(addRequest.request.method).toBe('POST');
    expect(addRequest.request.body).toEqual({
      ProductoId: guestProduct.productoId,
      Cantidad: 2,
    });
    addRequest.flush(cartResponse([apiItem(2)]));

    expect(result?.Items[0]?.Cantidad).toBe(2);
    expect(service.items()).toHaveLength(1);
    expect(service.items()[0]?.quantity).toBe(2);
    expect(service.items()[0]?.apiDetailId).toBe(apiItem(2).DetalleCarritoId);
  });

  it('adds the guest quantity to an existing remote quantity', () => {
    expect(service.addProduct(guestProduct, 2)).toBe(true);

    service.reconcileGuestCart([guestProduct]).subscribe();

    httpTesting.expectOne(`${API_BASE_URL}/carrito`).flush(cartResponse([apiItem(1)]));
    const addRequest = httpTesting.expectOne(`${API_BASE_URL}/carrito/items`);
    expect(addRequest.request.body).toEqual({
      ProductoId: guestProduct.productoId,
      Cantidad: 2,
    });
    addRequest.flush(cartResponse([apiItem(3)]));

    expect(service.items()).toHaveLength(1);
    expect(service.items()[0]?.quantity).toBe(3);
    expect(service.count()).toBe(3);
  });

  it('preserves the guest cart locally when the remote add fails', () => {
    expect(service.addProduct(guestProduct, 2)).toBe(true);
    let receivedError: unknown;

    service.reconcileGuestCart([guestProduct]).subscribe({
      error: (error: unknown) => {
        receivedError = error;
      },
    });

    httpTesting.expectOne(`${API_BASE_URL}/carrito`).flush(cartResponse([]));
    httpTesting
      .expectOne(`${API_BASE_URL}/carrito/items`)
      .flush({ detail: 'No hay stock suficiente.' }, { status: 409, statusText: 'Conflict' });

    expect(receivedError).toBeTruthy();
    expect(service.items()).toHaveLength(1);
    expect(service.items()[0]?.quantity).toBe(2);
    expect(service.items()[0]?.apiDetailId).toBeUndefined();
    expect(JSON.parse(localStorage.getItem('tecnomega_cart_v1') ?? '[]')).toHaveLength(1);
  });

});
