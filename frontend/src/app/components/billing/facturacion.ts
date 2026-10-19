import { CurrencyPipe, DatePipe, NgFor, NgIf } from '@angular/common';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { catchError, of } from 'rxjs';
import { API_BASE_URL } from '../../services/api.config';
import { AuthService } from '../../services/auth.service';
import { CustomerOrder, OrderPayment } from '../../services/order.service';
import { TaxService } from '../../services/tax.service';

interface InvoiceRow {
  facturaId?: number;
  numeroFactura: string;
  cliente: string;
  identificacion: string;
  fecha: string | null;
  estado: string;
  total: number;
  metodoPago: string;
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
  protected readonly taxService = inject(TaxService);

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
    return this.facturas.reduce((sum, f) => sum + (f.estado !== 'Anulada' ? f.total : 0), 0);
  }

  impuestoPorcentaje(invoice: InvoiceRow): string {
    const taxableBase = Math.max(0, Number(invoice.pedido.Subtotal) - Number(invoice.pedido.Descuento));
    const tax = Number(invoice.pedido.IVA ?? 0);
    return taxableBase > 0
      ? ((tax / taxableBase) * 100).toFixed(2)
      : this.taxService.ivaPercent().toFixed(2);
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

    this.taxService.load().pipe(catchError(() => of(null))).subscribe();
    this.http
      .get<any>(`${API_BASE_URL}/facturas?limite=200`, { headers: this.getAuthHeaders() })
      .pipe(catchError((error: unknown) => {
        this.error = error instanceof HttpErrorResponse
          ? (typeof error.error?.detail === 'string' ? error.error.detail : 'No se pudieron cargar las facturas.')
          : 'No se pudieron cargar las facturas.';
        return of(null);
      }))
      .subscribe({
        next: (res) => {
          if (res && Array.isArray(res.facturas)) {
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
              const payments: OrderPayment[] = (Array.isArray(f.Pagos) ? f.Pagos : []).map((p: any) => ({
                PagoId: Number(p.PagoId),
                MetodoPagoId: Number(p.MetodoPagoId),
                MetodoPago: p.MetodoPago || null,
                FechaPago: p.FechaPago || null,
                Monto: String(p.Monto ?? '0'),
                Estado: p.Estado || 'Pendiente',
                TransaccionId: p.TransaccionId || null,
              }));
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
                Pagos: payments,
              };

              return {
                facturaId: f.FacturaId,
                numeroFactura: f.Numero || f.NumeroFactura || `FAC-${String(f.FacturaId).padStart(6, '0')}`,
                cliente: clienteNombre,
                identificacion: f.Cliente?.Identificacion || '',
                fecha: f.Fecha || f.FechaEmision,
                estado: f.Estado || 'Emitida',
                total,
                metodoPago: [...new Set(payments.filter((p) => p.MetodoPago).map((p) => `${p.MetodoPago} (${p.Estado})`))].join(', ') || 'Sin pago registrado',
                pedido: dummyOrder,
              };
            });
          } else {
            this.facturas = [];
          }
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
