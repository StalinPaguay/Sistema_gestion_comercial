import { CurrencyPipe, DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, HostListener, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription, catchError, of, switchMap, timer } from 'rxjs';
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
  private readonly orderService = inject(OrderService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private ordersSubscription?: Subscription;
  private detailSubscription?: Subscription;

  protected readonly orders = signal<CustomerOrder[]>([]);
  protected readonly selectedOrder = signal<CustomerOrder | null>(null);
  protected readonly loading = signal(true);
  protected readonly detailLoading = signal(false);
  protected readonly errorMessage = signal('');
  protected readonly detailError = signal('');
  protected readonly lastUpdated = signal<Date | null>(null);
  protected readonly confirmationMessage = signal('');

  ngOnInit(): void {
    const createdOrderId = this.route.snapshot.queryParamMap.get('pedido');
    if (createdOrderId) {
      this.confirmationMessage.set(
        `Pedido #${createdOrderId} creado. Su estado actual es Pendiente y el pago quedó pendiente de confirmación.`,
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
  closeDetailOnEscape(): void {
    this.closeDetail();
  }

  protected showDetail(order: CustomerOrder): void {
    this.selectedOrder.set(order);
    this.detailLoading.set(true);
    this.detailError.set('');
    this.detailSubscription?.unsubscribe();
    this.detailSubscription = this.orderService.getOrder(order.PedidoId).subscribe({
      next: (detail) => {
        this.selectedOrder.set(detail);
        this.detailLoading.set(false);
      },
      error: (error: unknown) => {
        this.detailError.set(this.requestError(error));
        this.detailLoading.set(false);
      },
    });
  }

  protected closeDetail(): void {
    this.selectedOrder.set(null);
    this.detailError.set('');
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
}
