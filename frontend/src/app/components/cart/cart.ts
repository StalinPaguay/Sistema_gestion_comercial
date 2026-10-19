import { CurrencyPipe, NgFor, NgIf } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  OnInit,
  signal,
  untracked,
  ViewChild,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { catchError, forkJoin, of, throwError } from 'rxjs';
import QRCode from 'qrcode';
import { AuthService } from '../../services/auth.service';
import { CartItem, CartService } from '../../services/cart.service';
import { CouponValidation, PromotionService } from '../../services/promotion.service';
import { Product, ProductService } from '../../services/product.service';
import { CreateOrderRequest, CustomerOrder, OrderService, PaymentMethod } from '../../services/order.service';
import { DeliveryAddress, DeliveryAddressInput, UserService } from '../../services/user.service';

@Component({
  imports: [CurrencyPipe, NgFor, NgIf, RouterLink],
  selector: 'app-cart',
  styleUrl: './cart.css',
  templateUrl: './cart.html',
})
export class Cart implements OnInit {
  protected readonly cartService = inject(CartService);
  private readonly authService = inject(AuthService);
  private readonly productService = inject(ProductService);
  private readonly userService = inject(UserService);
  private readonly orderService = inject(OrderService);
  private readonly router = inject(Router);
  private readonly promotionService = inject(PromotionService);
  @ViewChild('cardForm') private cardForm?: ElementRef<HTMLFormElement>;
  protected recommendedProducts: Product[] = [];
  protected feedback = '';
  protected readonly addresses = signal<DeliveryAddress[]>([]);
  protected readonly paymentMethods = signal<PaymentMethod[]>([]);
  protected readonly selectedAddressId = signal<number | null>(null);
  protected readonly selectedPaymentMethodId = signal<number | null>(null);
  protected readonly transferQr = signal('');
  protected readonly transferQrLoading = signal(false);
  protected readonly cardValid = signal(false);
  protected readonly cardSubmitted = signal(false);
  protected readonly cardErrors = signal<string[]>([]);

  // Compatibilidad con getters
  get transferDemoQr() { return this.transferQr; }
  get transferDemoQrLoading() { return this.transferQrLoading; }
  get cardDemoValid() { return this.cardValid; }
  get cardDemoSubmitted() { return this.cardSubmitted; }
  get cardDemoErrors() { return this.cardErrors; }
  protected readonly checkoutDetailsOpen = signal(false);
  protected readonly addressFormOpen = signal(false);
  protected readonly checkoutLoading = signal(false);
  protected readonly addressSaving = signal(false);
  protected readonly orderSubmitting = signal(false);
  protected addressDraft = { Provincia: '', Ciudad: '', Direccion: '', Referencia: '' };
  private transferQrGeneration = 0;

  // ----- Cupones de descuento -----
  protected couponInput = '';
  protected readonly appliedCoupon = signal<CouponValidation | null>(null);
  protected readonly couponLoading = signal(false);
  protected readonly couponError = signal('');
  protected readonly discount = computed(() => Number(this.appliedCoupon()?.monto_descuento ?? 0));
  protected readonly taxAfterDiscount = computed(
    () => Math.round(((this.cartService.subtotal() - this.discount()) * 0.15 + Number.EPSILON) * 100) / 100,
  );
  protected readonly totalAfterDiscount = computed(
    () =>
      this.cartService.subtotal() -
      this.discount() +
      this.taxAfterDiscount() +
      this.cartService.shipping(),
  );

  constructor() {
    // Si el carrito cambia después de aplicar un cupón, el descuento ya no es válido.
    effect(() => {
      this.cartService.subtotal();
      untracked(() => {
        if (this.appliedCoupon()) {
          this.appliedCoupon.set(null);
          this.couponError.set('El carrito cambió. Vuelve a aplicar el cupón.');
        }
      });
    });
  }

  ngOnInit(): void {
    this.productService.getProducts().subscribe({
      next: (result) => {
        this.recommendedProducts = result.data.slice(0, 3);
        if (this.authService.accessToken()) {
          this.loadRemoteCart(result.data);
        }
      },
      error: (error: unknown) => {
        this.recommendedProducts = [];
        this.showError(error);
      },
    });
  }

  protected remove(item: CartItem): void {
    if (this.authService.accessToken() && item.apiDetailId !== undefined) {
      this.cartService.removeRemoteItem(item.apiDetailId).subscribe({
        next: (response) => this.cartService.syncFromApi(response, this.recommendedProducts),
        error: (error: unknown) => this.showError(error),
      });
      return;
    }
    this.cartService.removeProduct(item.product.productoId);
  }

  protected updateQuantity(item: CartItem, event: Event): void {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) {
      return;
    }
    this.updateItem(item, Number(input.value));
  }

  protected decrease(item: CartItem): void {
    this.updateItem(item, item.quantity - 1);
  }

  protected increase(item: CartItem): void {
    this.updateItem(item, item.quantity + 1);
  }

  protected addRecommended(productId: number): void {
    const product = this.recommendedProducts.find((item) => item.productoId === productId);
    if (!product) {
      return;
    }

    if (this.authService.accessToken()) {
      this.cartService.addRemoteProduct(product.productoId).subscribe({
        next: (response) => this.cartService.syncFromApi(response, this.recommendedProducts),
        error: (error: unknown) => this.showError(error),
      });
      return;
    }
    this.cartService.addProduct(product);
  }

  private loadRemoteCart(products: Product[]): void {
    this.cartService.reconcileGuestCart(products).subscribe({
      error: (error: unknown) => this.showError(error),
    });
  }

  private updateItem(item: CartItem, quantity: number): void {
    if (this.authService.accessToken() && item.apiDetailId !== undefined) {
      const request =
        quantity < 1
          ? this.cartService.removeRemoteItem(item.apiDetailId)
          : this.cartService.updateRemoteQuantity(item.apiDetailId, quantity);
      request.subscribe({
        next: (response) => this.cartService.syncFromApi(response, this.recommendedProducts),
        error: (error: unknown) => this.showError(error),
      });
      return;
    }
    this.cartService.updateQuantity(item.product.productoId, quantity);
  }

  private showError(error: unknown): void {
    if (error instanceof HttpErrorResponse) {
      const detail: unknown = error.error?.detail;
      this.feedback =
        typeof detail === 'string'
          ? detail
          : error.status === 0
            ? 'No se pudo conectar con el servidor para actualizar el carrito.'
            : 'No se pudo actualizar el carrito. Inténtalo de nuevo.';
      return;
    }
    this.feedback = 'No se pudo actualizar el carrito. Inténtalo de nuevo.';
  }

  protected onCouponInput(event: Event): void {
    if (event.target instanceof HTMLInputElement) {
      this.couponInput = event.target.value;
    }
  }

  protected applyCoupon(): void {
    const code = this.couponInput.trim().toUpperCase();
    if (!code || this.couponLoading()) return;
    if (!this.cartService.items().length) {
      this.couponError.set('Agrega productos al carrito antes de aplicar un cupón.');
      return;
    }

    this.couponLoading.set(true);
    this.couponError.set('');
    const productIds = this.cartService.items().map((item) => item.product.productoId);
    this.promotionService.validateCoupon(code, this.cartService.subtotal(), productIds).subscribe({
      next: (result) => {
        this.appliedCoupon.set(result);
        this.couponLoading.set(false);
      },
      error: (error: unknown) => {
        this.appliedCoupon.set(null);
        const detail = error instanceof HttpErrorResponse ? error.error?.detail : null;
        this.couponError.set(
          typeof detail === 'string' ? detail : 'No se pudo validar el cupón. Inténtalo de nuevo.',
        );
        this.couponLoading.set(false);
      },
    });
  }

  protected removeCoupon(): void {
    this.appliedCoupon.set(null);
    this.couponInput = '';
    this.couponError.set('');
  }

  protected checkout(): void {
    if (!this.authService.accessToken()) {
      void this.router.navigate(['/login'], { queryParams: { returnUrl: '/cart' } });
      return;
    }
    if (!this.cartService.items().length || this.checkoutLoading()) return;

    this.feedback = '';
    this.checkoutLoading.set(true);
    forkJoin({
      addresses: this.userService.getAddresses().pipe(
        catchError((error: unknown) =>
          error instanceof HttpErrorResponse && error.status === 404
            ? of([] as DeliveryAddress[])
            : throwError(() => error),
        ),
      ),
      methods: this.orderService.getPaymentMethods(),
      orders: this.orderService.getOrders().pipe(catchError(() => of([] as CustomerOrder[]))),
    }).subscribe({
      next: ({ addresses, methods, orders }) => {
        this.addresses.set(addresses);
        this.paymentMethods.set(methods);
        const mostRecentlyUsedAddressId =
          orders[0]?.DireccionId ?? orders[0]?.Direccion?.DireccionId;
        this.selectedAddressId.set(
          addresses.find((address) => address.DireccionId === mostRecentlyUsedAddressId)?.DireccionId ??
            addresses.find((address) => address.EsPrincipal)?.DireccionId ??
            addresses[0]?.DireccionId ??
            null,
        );
        this.selectedPaymentMethodId.set(methods[0]?.MetodoPagoId ?? null);
        this.updateTransferQr();
        this.addressFormOpen.set(addresses.length === 0);
        this.checkoutDetailsOpen.set(true);
        if (!methods.length) this.feedback = 'No hay métodos de pago activos configurados.';
        this.checkoutLoading.set(false);
      },
      error: (error: unknown) => {
        this.showError(error);
        this.checkoutLoading.set(false);
      },
    });
  }

  protected selectAddress(event: Event): void {
    const select = event.target;
    if (select instanceof HTMLSelectElement) {
      this.selectedAddressId.set(Number(select.value) || null);
    }
  }

  protected selectPaymentMethod(event: Event): void {
    const select = event.target;
    if (select instanceof HTMLSelectElement) {
      this.selectedPaymentMethodId.set(Number(select.value) || null);
      this.cardValid.set(false);
      this.cardSubmitted.set(false);
      this.cardErrors.set([]);
      this.updateTransferQr();
    }
  }

  protected isCardPaymentSelected(): boolean {
    return this.paymentMethods()
      .find((method) => method.MetodoPagoId === this.selectedPaymentMethodId())
      ?.Nombre.toLocaleLowerCase().includes('tarjeta') ?? false;
  }

  protected validateCard(event: Event): void {
    const input = event.target;
    const form = input instanceof HTMLInputElement ? input.closest('form') : null;
    this.cardSubmitted.set(true);
    this.updateCardValidation(form ?? undefined);
  }

  protected formatCardNumber(event: Event): void {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) return;

    const digits = input.value.replace(/\D/g, '').slice(0, 16);
    const groups = digits.match(/.{1,4}/g);
    input.value = groups ? groups.join(' ') : digits;
    this.updateCardValidation(input.closest('form') ?? undefined);
  }

  protected formatCardExpiry(event: Event): void {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) return;

    const digits = input.value.replace(/\D/g, '').slice(0, 4);
    if (digits.length >= 3) {
      input.value = `${digits.slice(0, 2)}/${digits.slice(2)}`;
    } else if (digits.length === 2 && input.value.length === 2) {
      input.value = `${digits}/`;
    } else {
      input.value = digits;
    }
    this.updateCardValidation(input.closest('form') ?? undefined);
  }

  protected formatCardCvv(event: Event): void {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) return;
    input.value = input.value.replace(/\D/g, '').slice(0, 4);
    this.updateCardValidation(input.closest('form') ?? undefined);
  }

  private updateCardValidation(form?: HTMLFormElement): boolean {
    const formElement = form ?? this.cardForm?.nativeElement;
    if (!formElement) {
      this.cardErrors.set(['los campos de la tarjeta']);
      this.cardValid.set(false);
      return false;
    }

    const errors: string[] = [];
    const inputs = Array.from(formElement.querySelectorAll<HTMLInputElement>('input'));
    const titularInput = inputs[0];
    const numeroInput = inputs[1];
    const vencimientoInput = inputs[2];
    const cvvInput = inputs[3];

    // 1. Titular
    if (!titularInput || titularInput.value.trim().length < 3) {
      errors.push('Titular de la tarjeta (mínimo 3 letras)');
    }

    // 2. Estándar de 16 dígitos de tarjeta
    const digitsCard = (numeroInput?.value || '').replace(/\D/g, '');
    if (digitsCard.length !== 16) {
      errors.push(`Número de tarjeta (${digitsCard.length}/16 dígitos ingresados)`);
    }

    // 3. Vencimiento MM/AA
    const expVal = vencimientoInput?.value || '';
    const expMatch = expVal.match(/^(0[1-9]|1[0-2])\/(\d{2})$/);
    if (!expMatch) {
      errors.push('Fecha de vencimiento (formato MM/AA)');
    } else {
      const month = parseInt(expMatch[1], 10);
      const year = parseInt(`20${expMatch[2]}`, 10);
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;
      if (year < currentYear || (year === currentYear && month < currentMonth)) {
        errors.push('Fecha de vencimiento expirada');
      }
    }

    // 4. CVV (3 o 4 dígitos)
    const cvvVal = (cvvInput?.value || '').replace(/\D/g, '');
    if (cvvVal.length < 3 || cvvVal.length > 4) {
      errors.push('Código de seguridad CVV (3 o 4 dígitos)');
    }

    this.cardErrors.set(errors);
    const valid = errors.length === 0;
    this.cardValid.set(valid);
    if (valid && this.feedback === 'Revisa los campos de tarjeta marcados antes de continuar.') {
      this.feedback = '';
    }
    return valid;
  }

  private updateTransferQr(): void {
    const generation = ++this.transferQrGeneration;
    const selectedMethod = this.paymentMethods().find(
      (method) => method.MetodoPagoId === this.selectedPaymentMethodId(),
    );
    if (!selectedMethod?.Nombre.toLocaleLowerCase().includes('transferencia')) {
      this.transferQr.set('');
      this.transferQrLoading.set(false);
      return;
    }

    this.transferQrLoading.set(true);
    const qrData = 'TECNOMEGA-DEMO|TRANSFERENCIA|NO_PAGO';
    void QRCode.toDataURL(qrData, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 220,
    })
      .then((qr) => {
        if (generation === this.transferQrGeneration) this.transferQr.set(qr);
      })
      .catch(() => {
        if (generation === this.transferQrGeneration) {
          this.transferQr.set('');
          this.feedback = 'No se pudo generar el código QR de transferencia.';
        }
      })
      .finally(() => {
        if (generation === this.transferQrGeneration) this.transferQrLoading.set(false);
      });
  }

  protected updateAddressField(field: 'Provincia' | 'Ciudad' | 'Direccion' | 'Referencia', event: Event): void {
    const input = event.target;
    if (input instanceof HTMLInputElement) {
      this.addressDraft = { ...this.addressDraft, [field]: input.value };
    }
  }

  protected openAddressForm(): void {
    this.addressDraft = { Provincia: '', Ciudad: '', Direccion: '', Referencia: '' };
    this.addressFormOpen.set(true);
    this.feedback = '';
  }

  protected cancelAddressForm(): void {
    if (this.addresses().length > 0) {
      this.addressFormOpen.set(false);
      this.addressDraft = { Provincia: '', Ciudad: '', Direccion: '', Referencia: '' };
      this.feedback = '';
    }
  }

  protected saveAddress(): void {
    if (this.addressSaving()) return;
    const direccion = this.addressDraft.Direccion.trim();
    if (direccion.length < 3) {
      this.feedback = 'Escribe una dirección de entrega de al menos 3 caracteres.';
      return;
    }

    const address: DeliveryAddressInput = {
      Provincia: this.addressDraft.Provincia.trim() || null,
      Ciudad: this.addressDraft.Ciudad.trim() || null,
      Direccion: direccion,
      Referencia: this.addressDraft.Referencia.trim() || null,
      CodigoPostal: null,
      EsPrincipal: this.addresses().length === 0,
    };
    this.feedback = '';
    this.addressSaving.set(true);
    this.userService.createAddress(address).subscribe({
      next: (created) => {
        this.addresses.update((addresses) => [...addresses, created]);
        this.selectedAddressId.set(created.DireccionId);
        this.addressFormOpen.set(false);
        this.addressDraft = { Provincia: '', Ciudad: '', Direccion: '', Referencia: '' };
        this.addressSaving.set(false);
      },
      error: (error: unknown) => {
        this.showError(error);
        this.addressSaving.set(false);
      },
    });
  }

  protected confirmOrder(): void {
    const addressId = this.selectedAddressId();
    const methodId = this.selectedPaymentMethodId();
    const items = this.cartService.items();
    if (!addressId || !methodId || !items.length || this.orderSubmitting()) {
      this.feedback = 'Selecciona una dirección y un método de pago para continuar.';
      return;
    }
    if (this.isCardPaymentSelected()) {
      this.cardSubmitted.set(true);
      if (!this.updateCardValidation()) {
        this.feedback = 'Revisa los datos de la tarjeta antes de continuar.';
        return;
      }
    }


const request: CreateOrderRequest = {
  DireccionId: addressId,
  MetodoPagoId: methodId,
  Items: items.map((item) => ({
    ProductoId: item.product.productoId,
    Cantidad: item.quantity,
  })),
  CodigoCupon: this.appliedCoupon()?.codigo_cupon,
};

    this.feedback = '';
    this.orderSubmitting.set(true);
    this.orderService.createOrder(request).subscribe({
      next: (order) => {
        this.cardValid.set(false);
        this.cardSubmitted.set(false);
        this.cardErrors.set([]);
        this.appliedCoupon.set(null);
        this.cartService.clear();
        this.orderSubmitting.set(false);
        this.cartService.clearRemoteCart().subscribe({
          next: () => this.navigateToCreatedOrder(order),
          error: () => this.navigateToCreatedOrder(order, true),
        });
      },
      error: (error: unknown) => {
        this.showError(error);
        this.orderSubmitting.set(false);
      },
    });
  }

  protected cancelCheckout(): void {
    if (this.orderSubmitting()) return;
    this.checkoutDetailsOpen.set(false);
    this.feedback = '';
  }

  private navigateToCreatedOrder(order: CustomerOrder, cartClearFailed = false): void {
    void this.router.navigate(['/order-history'], {
      queryParams: {
        pedido: order.PedidoId,
        ...(cartClearFailed ? { carritoPendiente: true } : {}),
      },
    });
  }
}