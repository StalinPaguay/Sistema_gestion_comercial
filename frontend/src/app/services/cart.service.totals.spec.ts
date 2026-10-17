import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { CartService } from './cart.service';
import { Product } from './product.service';

describe('CartService totals', () => {
  let service: CartService;

  const product: Product = {
    productoId: 21,
    sku: 'TM-TEST-001',
    nombre: 'Producto de prueba',
    descripcion: '',
    precio: 25,
    stock: 10,
    stockMinimo: 1,
    categoria: 'Pruebas',
    marca: 'TECNOMEGA',
    urlImagen: '',
    estado: true,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), CartService],
    });
    service = TestBed.inject(CartService);
    service.clear();
  });

  afterEach(() => service.clear());

  it('calculates 15 percent tax and includes it in the total', () => {
    service.addProduct(product, 2);

    expect(service.subtotal()).toBe(50);
    expect(service.tax()).toBe(7.5);
    expect(service.shipping()).toBe(0);
    expect(service.total()).toBe(57.5);
  });

  it('clears the local cart count and persisted items', () => {
    service.addProduct(product, 2);

    service.clear();

    expect(service.items()).toEqual([]);
    expect(service.count()).toBe(0);
    expect(JSON.parse(localStorage.getItem('tecnomega_cart_v1') ?? '[]')).toEqual([]);
  });
});
