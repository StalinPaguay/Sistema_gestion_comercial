import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { API_BASE_URL } from './api.config';

export interface OrderPayment {
  PagoId: number;
  MetodoPagoId: number;
  MetodoPago: string | null;
  FechaPago: string | null;
  Monto: string;
  Estado: string;
  TransaccionId: string | null;
}

export interface OrderItem {
  PedidoDetalleId: number;
  ProductoId: number;
  Nombre: string;
  SKU: string;
  Cantidad: number;
  PrecioUnitario: string;
  Subtotal: string;
  Descuento: string;
  Total: string;
}

export interface CustomerOrder {
  PedidoId: number;
  DireccionId: number;
  FechaPedido: string | null;
  Subtotal: string;
  Descuento: string;
  IVA: string;
  Total: string;
  Estado: 'Pendiente' | 'Procesando' | 'Enviado' | 'Entregado' | 'Cancelado' | string;
  Items: OrderItem[];
  Pagos: OrderPayment[];
}

export interface PaymentMethod {
  MetodoPagoId: number;
  Nombre: string;
  Estado: boolean;
}

export interface CreateOrderRequest {
  DireccionId: number;
  MetodoPagoId: number;
  Items: Array<{ ProductoId: number; Cantidad: number }>;
}

interface OrdersResponse {
  total: number;
  pedidos: CustomerOrder[];
}

@Injectable({ providedIn: 'root' })
export class OrderService {
  private readonly http = inject(HttpClient);

  getOrders(limit = 50): Observable<CustomerOrder[]> {
    return this.http
      .get<OrdersResponse>(`${API_BASE_URL}/pedidos`, { params: { limite: limit } })
      .pipe(map((response) => response.pedidos ?? []));
  }

  getOrder(orderId: number): Observable<CustomerOrder> {
    return this.http.get<CustomerOrder>(`${API_BASE_URL}/pedidos/${orderId}`);
  }

  getPaymentMethods(): Observable<PaymentMethod[]> {
    return this.http.get<PaymentMethod[]>(`${API_BASE_URL}/metodos-pago`);
  }

  createOrder(order: CreateOrderRequest): Observable<CustomerOrder> {
    return this.http.post<CustomerOrder>(`${API_BASE_URL}/pedidos`, order);
  }
}
