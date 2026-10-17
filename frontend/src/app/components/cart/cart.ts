import { CurrencyPipe, NgFor, NgIf } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, ElementRef, inject, OnInit, signal, ViewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { catchError, forkJoin, of, throwError } from 'rxjs';
import QRCode from 'qrcode';
import { AuthService } from '../../services/auth.service';
import { CartItem, CartService } from '../../services/cart.service';
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
  @ViewChild('cardDemoForm') private cardDemoForm?: ElementRef<HTMLFormElement>;
  protected recommendedProducts: Product[] = [];
  protected feedback = '';
  protected readonly addresses = signal<DeliveryAddress[]>([]);
  protected readonly paymentMethods = signal<PaymentMethod[]>([]);
  protected readonly selectedAddressId = signal<number | null>(null);
  protected readonly selectedPaymentMethodId = signal<number | null>(null);
  protected readonly transferDemoQr = signal('');
  protected readonly transferDemoQrLoading = signal(false);
  protected readonly cardDemoValid = signal(false);
  protected readonly cardDemoSubmitted = signal(false);
  protected readonly cardDemoErrors = signal<string[]>([]);
  protected readonly checkoutDetailsOpen = signal(false);
  protected readonly addressFormOpen = signal(false);
  protected readonly checkoutLoading = signal(false);
  protected readonly addressSaving = signal(false);
  protected readonly orderSubmitting = signal(false);
  protected addressDraft = { Provincia: '', Ciudad: '', Direccion: '', Referencia: '' };
  private transferQrGeneration = 0;

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
    this.cartService.getRemoteCart().subscribe({
      next: (response) => {
        if (response.Items.length || !this.cartService.items().length) {
          this.cartService.syncFromApi(response, products);
        }
      },
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
        const mostRecentlyUsedAddressId = orders[0]?.DireccionId;
        this.selectedAddressId.set(
          addresses.find((address) => address.DireccionId === mostRecentlyUsedAddressId)?.DireccionId ??
            addresses.find((address) => address.EsPrincipal)?.DireccionId ??
            addresses[0]?.DireccionId ??
            null,
        );
        this.selectedPaymentMethodId.set(methods[0]?.MetodoPagoId ?? null);
        this.updateTransferDemoQr();
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
      this.cardDemoValid.set(false);
      this.cardDemoSubmitted.set(false);
      this.cardDemoErrors.set([]);
      this.updateTransferDemoQr();
    }
  }

  protected isCardPaymentSelected(): boolean {
    return this.paymentMethods()
      .find((method) => method.MetodoPagoId === this.selectedPaymentMethodId())
      ?.Nombre.toLocaleLowerCase().includes('tarjeta') ?? false;
  }

  protected validateDemoCard(event: Event): void {
    const input = event.target;
    const form = input instanceof HTMLInputElement ? input.closest('form') : null;
    this.cardDemoSubmitted.set(true);
    this.updateCardDemoValidation(form ?? undefined);
  }

  protected formatDemoCardExpiry(event: Event): void {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) return;

    const cursor = input.selectionStart ?? input.value.length;
    const digitsBeforeCursor = input.value.slice(0, cursor).replace(/\D/g, '').length;
    const digits = input.value.replace(/\D/g, '').slice(0, 4);
    input.value = digits.length >= 2
      ? `${digits.slice(0, 2)}/${digits.slice(2)}`
      : digits;

    const formattedCursor = digitsBeforeCursor + (digitsBeforeCursor >= 2 && digits.length >= 2 ? 1 : 0);
    input.setSelectionRange(formattedCursor, formattedCursor);
  }

  private updateCardDemoValidation(form?: HTMLFormElement): boolean {
    const formElement = form ?? this.cardDemoForm?.nativeElement;
    if (!formElement) {
      this.cardDemoErrors.set(['los campos de tarjeta']);
      this.cardDemoValid.set(false);
      return false;
    }

    const invalidFields = Array.from(formElement.querySelectorAll<HTMLInputElement>(':invalid'));
    this.cardDemoErrors.set(
      invalidFields.map((field) => field.closest('label')?.textContent?.trim().replace(/\s+/g, ' ') ?? 'Un campo'),
    );
    const valid = formElement.checkValidity();
    this.cardDemoValid.set(valid);
    if (valid && this.feedback === 'Revisa los campos de tarjeta marcados antes de continuar.') {
      this.feedback = '';
    }
    return valid;
  }

  private updateTransferDemoQr(): void {
    const generation = ++this.transferQrGeneration;
    const selectedMethod = this.paymentMethods().find(
      (method) => method.MetodoPagoId === this.selectedPaymentMethodId(),
    );
    if (!selectedMethod?.Nombre.toLocaleLowerCase().includes('transferencia')) {
      this.transferDemoQr.set('');
      this.transferDemoQrLoading.set(false);
      return;
    }

    this.transferDemoQrLoading.set(true);
    void QRCode.toDataURL('TECNOMEGA-DEMO|TRANSFERENCIA|NO_PAGO', {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 220,
    })
      .then((qr) => {
        if (generation === this.transferQrGeneration) this.transferDemoQr.set(qr);
      })
      .catch(() => {
        if (generation === this.transferQrGeneration) {
          this.transferDemoQr.set('');
          this.feedback = 'No se pudo generar el QR de demostración.';
        }
      })
      .finally(() => {
        if (generation === this.transferQrGeneration) this.transferDemoQrLoading.set(false);
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
      this.cardDemoSubmitted.set(true);
      if (!this.updateCardDemoValidation()) {
        this.feedback = 'Revisa los campos de tarjeta marcados antes de continuar.';
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
    };
    this.feedback = '';
    this.orderSubmitting.set(true);
    this.orderService.createOrder(request).subscribe({
      next: (order) => {
        this.cardDemoValid.set(false);
        this.cardDemoSubmitted.set(false);
        this.cardDemoErrors.set([]);
        this.cartService.clear();
        this.orderSubmitting.set(false);
        void this.router.navigate(['/order-history'], {
          queryParams: { pedido: order.PedidoId },
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
}
