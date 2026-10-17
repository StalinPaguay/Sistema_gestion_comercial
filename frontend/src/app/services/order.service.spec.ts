import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_BASE_URL } from './api.config';
import { CustomerOrder, OrderService } from './order.service';

describe('OrderService API contracts', () => {
  let service: OrderService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), OrderService],
    });
    service = TestBed.inject(OrderService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('reads paginated orders using the backend response shape', () => {
    const order: CustomerOrder = {
      PedidoId: 17,
      Direccion: {
        DireccionId: 5,
        Direccion: 'Av. Prueba 123',
        Ciudad: 'Quito',
        Provincia: 'Pichincha',
        Referencia: null,
      },
      FechaPedido: '2026-10-17T12:00:00',
      Subtotal: '100.00',
      Descuento: '0.00',
      IVA: '0.00',
      Total: '100.00',
      Estado: 'Pendiente',
      Items: [],
    };
    let result: CustomerOrder[] | undefined;

    service.getOrders(25).subscribe((orders) => {
      result = orders;
    });

    const request = httpTesting.expectOne(`${API_BASE_URL}/pedidos?limite=25`);
    expect(request.request.method).toBe('GET');
    request.flush({ total: 1, limite: 25, desde: 0, pedidos: [order] });

    expect(result).toEqual([order]);
  });

  it("loads a pedido's payments from the dedicated payment-history route", () => {
    let result: unknown;

    service.getPaymentsForOrder(17).subscribe((payments) => {
      result = payments;
    });

    const request = httpTesting.expectOne(`${API_BASE_URL}/pagos/pedido/17`);
    expect(request.request.method).toBe('GET');
    request.flush([
      {
        PagoId: 3,
        PedidoId: 17,
        MetodoPagoId: 2,
        MetodoPago: 'Transferencia',
        FechaPago: '2026-10-17T12:10:00',
        Monto: '100.00',
        Estado: 'Pagado',
        TransaccionId: null,
      },
    ]);

    expect(result).toEqual([
      {
        PagoId: 3,
        PedidoId: 17,
        MetodoPagoId: 2,
        MetodoPago: 'Transferencia',
        FechaPago: '2026-10-17T12:10:00',
        Monto: '100.00',
        Estado: 'Pagado',
        TransaccionId: null,
      },
    ]);
  });

  it('creates pedidos using only fields accepted by the backend', () => {
    const requestBody = {
      DireccionId: 5,
      Items: [{ ProductoId: 12, Cantidad: 2 }],
    };
    let result: CustomerOrder | undefined;

    service.createOrder(requestBody).subscribe((order) => {
      result = order;
    });

    const request = httpTesting.expectOne(`${API_BASE_URL}/pedidos`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(requestBody);
    request.flush({
      PedidoId: 17,
      Direccion: {
        DireccionId: 5,
        Direccion: 'Av. Prueba 123',
        Ciudad: 'Quito',
        Provincia: 'Pichincha',
        Referencia: null,
      },
      FechaPedido: '2026-10-17T12:00:00',
      Subtotal: '100.00',
      Descuento: '0.00',
      IVA: '0.00',
      Total: '100.00',
      Estado: 'Pendiente',
      Items: [],
    });

    expect(result?.PedidoId).toBe(17);
  });
});
