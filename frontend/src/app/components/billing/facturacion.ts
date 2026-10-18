import { CurrencyPipe, DatePipe, NgFor, NgIf } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { CustomerOrder, OrderService } from '../../services/order.service';

interface InvoiceRow {
  numeroFactura: string;
  cliente: string;
  identificacion: string;
  fecha: string | null;
  estado: string;
  total: number;
  pedido: CustomerOrder;
}

@Component({
  selector: 'app-facturacion',
  standalone: true,
  imports: [CurrencyPipe, DatePipe, NgFor, NgIf, FormsModule],
  templateUrl: './facturacion.html',
  styleUrl: './facturacion.css',
})
export class Facturacion implements OnInit {
  private readonly orderService = inject(OrderService);
  facturas: InvoiceRow[] = [];
  facturaSeleccionada: InvoiceRow | null = null;
  busqueda = '';
  cargando = false;
  error = '';

  get facturasFiltradas(): InvoiceRow[] {
    const q = this.busqueda.trim().toLocaleLowerCase();
    if (!q) return this.facturas;
    return this.facturas.filter((f) =>
      [f.numeroFactura, f.cliente, f.identificacion, f.estado]
        .some((v) => v.toLocaleLowerCase().includes(q)),
    );
  }

  get totalFacturado(): number {
    return this.facturas.reduce((sum, f) => sum + f.total, 0);
  }

  ngOnInit(): void {
    this.cargarFacturas();
  }

  cargarFacturas(): void {
    if (this.cargando) return;
    this.cargando = true;
    this.error = '';
    this.orderService.getOrders(200).subscribe({
      next: (orders) => {
        this.facturas = orders.map((order) => {
          const raw = order as CustomerOrder & {
            Cliente?: { Identificacion?: string; Nombres?: string; Apellidos?: string };
            ClienteId?: number;
          };
          const nombre = [raw.Cliente?.Nombres, raw.Cliente?.Apellidos]
            .filter(Boolean).join(' ');
          return {
            numeroFactura: `FAC-${String(order.PedidoId).padStart(6, '0')}`,
            cliente: nombre || `Cliente #${raw.ClienteId ?? order.PedidoId}`,
            identificacion: raw.Cliente?.Identificacion ?? '',
            fecha: order.FechaPedido,
            estado: order.Estado || 'Emitida',
            total: Number(order.Total ?? 0),
            pedido: order,
          };
        });
        this.cargando = false;
      },
      error: (err: unknown) => {
        this.error = err instanceof HttpErrorResponse
          ? (typeof err.error?.detail === 'string' ? err.error.detail : 'No se pudieron cargar los comprobantes.')
          : 'No se pudieron cargar los comprobantes.';
        this.cargando = false;
      },
    });
  }

  verFactura(factura: InvoiceRow): void {
    this.facturaSeleccionada = factura;
  }

  imprimirFactura(factura: InvoiceRow): void {
    this.facturaSeleccionada = factura;
    setTimeout(() => window.print(), 0);
  }
}
