import { CurrencyPipe, DatePipe, DOCUMENT } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, HostListener, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription, catchError, forkJoin, of, switchMap, timer } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { CustomerOrder, OrderService } from '../../services/order.service';
import { getProductImage } from '../../services/product.service';

@Component({
  selector: 'app-order-history',
  standalone: true,
  imports: [CurrencyPipe, DatePipe, RouterLink],
  templateUrl: './order-history.component.html',
  styleUrl: './order-history.component.css',
})
export class OrderHistoryComponent implements OnInit, OnDestroy {
  private readonly document = inject(DOCUMENT);
  private readonly orderService = inject(OrderService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private ordersSubscription?: Subscription;
  private detailSubscription?: Subscription;
  private detailTrigger: HTMLElement | null = null;

  protected readonly orders = signal<CustomerOrder[]>([]);
  protected readonly selectedOrder = signal<CustomerOrder | null>(null);
  protected readonly loading = signal(true);
  protected readonly detailLoading = signal(false);
  protected readonly errorMessage = signal('');
  protected readonly detailError = signal('');
  protected readonly lastUpdated = signal<Date | null>(null);
  protected readonly confirmationMessage = signal('');
  protected readonly cartCleanupWarning = signal('');
  protected readonly clientNotifications = signal<
    Array<{
      notificacionId: number;
      pedidoId: number;
      clienteEmail: string;
      clienteNombre?: string;
      estado: string;
      motivo: string;
      fecha: string;
    }>
  >([]);

  ngOnInit(): void {
    this.loadClientNotifications();
    const createdOrderId = this.route.snapshot.queryParamMap.get('pedido');
    if (createdOrderId) {
      this.confirmationMessage.set(
        `Pedido #${createdOrderId} creado. Su estado actual es Pendiente y el pago quedó pendiente de confirmación.`,
      );
    }
    if (this.route.snapshot.queryParamMap.get('carritoPendiente') === 'true') {
      this.cartCleanupWarning.set(
        'El pedido se creó, pero no se pudo sincronizar el vaciado del carrito. Actualiza el carrito antes de realizar otra compra.',
      );
    }
    if (!this.authService.accessToken()) {
      void this.router.navigate(['/login'], { queryParams: { returnUrl: '/order-history' } });
      return;
    }

    // Refresh every 30 seconds so state changes made by staff appear without reloading.
    this.ordersSubscription = timer(0, 10_000)
      .pipe(
        switchMap(() =>
          this.orderService.getOrders().pipe(
            catchError((error: unknown) => {
              this.errorMessage.set(this.requestError(error));
              this.loading.set(false);
              return of(null);
            }),
          ),
        ),
      )
      .subscribe((orders) => {
        if (orders) {
          this.orders.set(orders);
          this.syncSelectedOrderStatus(orders);
          this.errorMessage.set('');
          this.lastUpdated.set(new Date());
        }
        this.loading.set(false);
      });
  }

  ngOnDestroy(): void {
    this.ordersSubscription?.unsubscribe();
    this.detailSubscription?.unsubscribe();
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    if (this.selectedOrder()) {
      this.closeDetails();
    }
  }

  protected toggleDetails(order: CustomerOrder): void {
    if (this.selectedOrder()?.PedidoId === order.PedidoId) {
      this.closeDetails();
      return;
    }

    const activeElement = this.document.activeElement;
    this.detailTrigger = activeElement instanceof HTMLElement ? activeElement : null;
    this.selectedOrder.set(order);
    this.detailLoading.set(true);
    this.detailError.set('');
    this.detailSubscription?.unsubscribe();
    this.detailSubscription = forkJoin({
      detail: this.orderService.getOrder(order.PedidoId),
      payments: this.orderService.getPaymentsForOrder(order.PedidoId),
    }).subscribe({
      next: ({ detail, payments }) => {
        this.selectedOrder.set({ ...detail, Pagos: payments });
        this.detailLoading.set(false);
      },
      error: (error: unknown) => {
        this.detailError.set(this.requestError(error));
        this.detailLoading.set(false);
      },
    });
  }

  protected closeDetails(): void {
    this.detailSubscription?.unsubscribe();
    this.selectedOrder.set(null);
    this.detailLoading.set(false);
    this.detailError.set('');
    const trigger = this.detailTrigger;
    this.detailTrigger = null;
    this.document.defaultView?.requestAnimationFrame(() => trigger?.focus());
  }

  protected refresh(): void {
    this.loading.set(true);
    this.orderService.getOrders().subscribe({
      next: (orders) => {
        this.orders.set(orders);
        this.syncSelectedOrderStatus(orders);
        this.errorMessage.set('');
        this.lastUpdated.set(new Date());
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.errorMessage.set(this.requestError(error));
        this.loading.set(false);
      },
    });
  }

  protected statusClass(status: string): string {
    return status.toLocaleLowerCase().replaceAll(' ', '-');
  }

  protected productImage(sku: string): string {
    return getProductImage(sku);
  }

  protected paymentMethods(order: CustomerOrder): string {
    const names = [...new Set((order.Pagos ?? []).map((payment) => payment.MetodoPago).filter(Boolean))];
    return names.length ? names.join(', ') : 'Sin pago registrado';
  }

  protected orderTax(order: CustomerOrder): number {
    const reportedTax = this.moneyValue(order.IVA);
    if (reportedTax > 0) {
      return reportedTax;
    }
    return Math.max(0, this.moneyValue(order.Subtotal)) * 0.15;
  }

  protected orderTotal(order: CustomerOrder): number {
    const reportedTax = this.moneyValue(order.IVA);
    const reportedTotal = this.moneyValue(order.Total);
    if (reportedTax > 0 && reportedTotal > 0) {
      return reportedTotal;
    }
    const subtotalAfterDiscount = Math.max(
      0,
      this.moneyValue(order.Subtotal) - this.moneyValue(order.Descuento),
    );
    return subtotalAfterDiscount + this.orderTax(order);
  }

  private moneyValue(value: string | number | null | undefined): number {
    const parsed = typeof value === 'number' ? value : Number(value ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private syncSelectedOrderStatus(orders: CustomerOrder[]): void {
    const selected = this.selectedOrder();
    if (!selected) return;
    const refreshed = orders.find((order) => order.PedidoId === selected.PedidoId);
    if (refreshed && refreshed.Estado !== selected.Estado) {
      this.selectedOrder.set({ ...selected, Estado: refreshed.Estado });
    }
  }

  private requestError(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const detail: unknown = error.error?.detail;
      if (typeof detail === 'string') return detail;
      if (error.status === 0) return 'No se pudo conectar con el servidor de pedidos.';
      if (error.status === 401) {
        this.authService.logout();
        void this.router.navigate(['/login'], { queryParams: { returnUrl: '/order-history' } });
        return 'Tu sesión expiró. Inicia sesión nuevamente.';
      }
    }
    return 'No se pudo cargar la información del pedido.';
  }

  private loadClientNotifications(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      const stored = localStorage.getItem('tecnomega_client_notifications');
      if (stored) {
        const notifs = JSON.parse(stored);
        const userEmail = this.authService.currentUser()?.Email?.toLowerCase();
        if (Array.isArray(notifs)) {
          const userNotifs = notifs.filter(
            (n: any) => !userEmail || !n.clienteEmail || n.clienteEmail.toLowerCase() === userEmail
          );
          this.clientNotifications.set(userNotifs);
        }
      }
    } catch {}
  }

  protected dismissNotification(id: number): void {
    const updated = this.clientNotifications().filter((n) => n.notificacionId !== id);
    this.clientNotifications.set(updated);
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem('tecnomega_client_notifications', JSON.stringify(updated));
      } catch {}
    }
  }
}
