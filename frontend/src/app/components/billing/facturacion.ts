import { CurrencyPipe, DatePipe, NgFor, NgIf } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { catchError, of } from 'rxjs';
import { API_BASE_URL } from '../../services/api.config';
import { AuthService } from '../../services/auth.service';
import { CustomerOrder, OrderService } from '../../services/order.service';

interface InvoiceRow {
  facturaId?: number;
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
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
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

  private getAuthHeaders(): HttpHeaders {
    const token = this.authService.accessToken();
    let headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }
    return headers;
  }

  cargarFacturas(): void {
    if (this.cargando) return;
    this.cargando = true;
    this.error = '';

    this.http
      .get<any>(`${API_BASE_URL}/facturas?limite=100`, { headers: this.getAuthHeaders() })
      .pipe(catchError(() => of({ facturas: [] })))
      .subscribe({
        next: (res) => {
          if (res && Array.isArray(res.facturas) && res.facturas.length > 0) {
            this.facturas = res.facturas.map((f: any) => {
              const rawItems = Array.isArray(f.Items) ? f.Items : (Array.isArray(f.detalles) ? f.detalles : []);
              const mappedItems = rawItems.map((it: any) => ({
                PedidoDetalleId: it.DetalleFacturaId || it.ProductoId,
                ProductoId: it.ProductoId,
                Nombre: it.Nombre || 'Producto',
                SKU: it.SKU || '',
                Cantidad: Number(it.Cantidad || 1),
                PrecioUnitario: String(it.PrecioUnitario || '0'),
                Subtotal: String(it.Subtotal || '0'),
                Descuento: String(it.DescuentoValor || it.Descuento || '0'),
                Total: String(it.Total || '0'),
              }));

              const subtotal = Number(f.Subtotal || 0);
              const descuento = Number(f.Descuento || 0);
              const iva = Number(f.Impuesto ?? f.IVA ?? 0);
              const total = Number(f.Total || 0);
              const clienteNombre = f.Cliente
                ? `${f.Cliente.Nombres || ''} ${f.Cliente.Apellidos || ''}`.trim()
                : 'Cliente';

              const dummyOrder: CustomerOrder = {
                PedidoId: f.PedidoId || f.FacturaId,
                DireccionId: 0,
                FechaPedido: f.Fecha || f.FechaEmision,
                Subtotal: String(subtotal),
                Descuento: String(descuento),
                IVA: String(iva),
                Total: String(total),
                Estado: f.Estado || 'Emitida',
                Items: mappedItems,
                Pagos: [],
              };

              return {
                facturaId: f.FacturaId,
                numeroFactura: f.Numero || f.NumeroFactura || `FAC-${String(f.FacturaId).padStart(6, '0')}`,
                cliente: clienteNombre,
                identificacion: f.Cliente?.Identificacion || '',
                fecha: f.Fecha || f.FechaEmision,
                estado: f.Estado || 'Emitida',
                total,
                pedido: dummyOrder,
              };
            });
            this.cargando = false;
          } else {
            // Fallback a pedidos en caso de no haber facturas emitidas aún
            this.cargarDesdePedidos();
          }
        },
        error: () => {
          this.cargarDesdePedidos();
        },
      });
  }

  private cargarDesdePedidos(): void {
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
      error: () => {
        this.error = 'No se pudieron cargar los comprobantes de facturación.';
        this.cargando = false;
      },
    });
  }

  verFactura(factura: InvoiceRow): void {
    this.facturaSeleccionada = factura;
  }

  imprimirFactura(factura: InvoiceRow): void {
    this.facturaSeleccionada = factura;
    setTimeout(() => {
      window.print();
    }, 150);
  }
}
