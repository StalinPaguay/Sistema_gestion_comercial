import { CommonModule, CurrencyPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Subscription, timer } from 'rxjs';
import {
  AdminCategory,
  AdminInvoice,
  AdminOrder,
  AdminProduct,
  AdminPromotion,
  AdminService,
  AdminSupplier,
  InventoryMovement,
} from '../../services/admin.service';
import { AuthService } from '../../services/auth.service';
import { getProductImage } from '../../services/product-images.config';
import { ThemeService } from '../../services/theme.service';
import { TaxService } from '../../services/tax.service';

const NON_WHITESPACE = Validators.pattern(/\S/);
const INTEGER = Validators.pattern(/^\d+$/);
const SUPPLIER_PHONE = Validators.pattern(/^\d{10}$/);
const SUPPLIER_ID = Validators.pattern(/^(?:\d{10}|\d{13})$/);
const IMAGE_URL = Validators.pattern(/^https?:\/\/\S+\.\S+$/i);

type AdminTab =
  | 'dashboard'
  | 'orders'
  | 'products'
  | 'categories'
  | 'inventory'
  | 'promotions'
  | 'suppliers'
  | 'clients'
  | 'billing'
  | 'settings';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, CurrencyPipe, RouterLink],
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.css',
})
export class AdminComponent implements OnInit, OnDestroy {
  protected readonly adminService = inject(AdminService);
  protected readonly authService = inject(AuthService);
  protected readonly themeService = inject(ThemeService);
  protected readonly taxService = inject(TaxService);
  private readonly router = inject(Router);
  private refreshSubscription?: Subscription;

  ngOnInit(): void {
    this.adminService.refreshAllData();
    this.loadTaxParameter();
    // Auto-actualizar cada 4 segundos para reflejar nuevos clientes y pedidos en tiempo real
    this.refreshSubscription = timer(4000, 4000).subscribe(() => {
      this.adminService.refreshAllData();
    });
  }

  ngOnDestroy(): void {
    this.refreshSubscription?.unsubscribe();
  }

  manualRefresh(): void {
    this.adminService.refreshAllData();
    this.loadTaxParameter();
    this.showAlert('Datos del sistema sincronizados con el servidor.');
  }

  loadTaxParameter(): void {
    this.taxLoading.set(true);
    this.taxLoadError.set('');
    this.taxService.load().subscribe({
      next: (parameter) => {
        this.taxForm.controls.porcentaje.setValue(Number(parameter.Porcentaje));
        this.taxLoading.set(false);
      },
      error: (error: unknown) => {
        this.taxLoadError.set(error instanceof HttpErrorResponse && error.status === 404
          ? 'No se encontró IVA_PORCENTAJE en la base de datos.'
          : 'No se pudo leer el IVA desde el servidor.');
        this.taxLoading.set(false);
      },
    });
  }

  saveTaxParameter(): void {
    const percent = this.taxForm.controls.porcentaje.value;
    if (this.taxForm.invalid || percent === null || this.taxSaving()) {
      this.taxForm.markAllAsTouched();
      return;
    }
    this.taxSaving.set(true);
    this.taxService.update(percent).subscribe({
      next: (parameter) => {
        this.taxForm.controls.porcentaje.setValue(Number(parameter.Porcentaje));
        this.taxSaving.set(false);
        this.showAlert(`IVA actualizado a ${Number(parameter.Porcentaje)}%. Se aplicará en nuevos pedidos.`);
      },
      error: (error: unknown) => {
        const detail = error instanceof HttpErrorResponse
          ? (typeof error.error?.detail === 'string' ? error.error.detail : error.message)
          : 'Error inesperado.';
        this.taxSaving.set(false);
        this.showAlert(`No se pudo guardar el IVA: ${detail}`, 'danger');
      },
    });
  }

  invoiceTaxPercent(invoice: AdminInvoice): string {
    const taxableBase = Math.max(0, invoice.subtotal - invoice.descuento);
    if (taxableBase <= 0) return this.taxService.ivaPercent().toFixed(2);
    return ((invoice.impuesto / taxableBase) * 100).toFixed(2);
  }

  handleImageError(event: Event, sku: string): void {
    const target = event.target as HTMLImageElement;
    if (target) {
      target.src = getProductImage(sku);
    }
  }

  // Pestaña actual seleccionada
  readonly currentTab = signal<AdminTab>('dashboard');

  // Filtros de búsqueda en tablas
  readonly productSearch = signal('');
  readonly productCategoryFilter = signal('Todas');
  readonly productStatusFilter = signal('Todos');
  readonly inventoryFilter = signal<'Todos' | 'BajoStock' | 'Agotados'>('Todos');

  // Modales
  readonly showProductModal = signal(false);
  readonly editingProduct = signal<AdminProduct | null>(null);
  readonly savingProduct = signal(false);

  readonly showCategoryModal = signal(false);
  readonly editingCategory = signal<AdminCategory | null>(null);

  readonly showMovementModal = signal(false);
  readonly selectedProductForMovement = signal<AdminProduct | null>(null);

  readonly showPromotionModal = signal(false);
  readonly editingPromotionId = signal<number | null>(null);
  readonly showSupplierModal = signal(false);
  readonly selectedInvoice = signal<AdminInvoice | null>(null);
  readonly taxLoading = signal(false);
  readonly taxSaving = signal(false);
  readonly taxLoadError = signal('');
  readonly taxForm = new FormGroup({
    porcentaje: new FormControl<number | null>(15, [Validators.required, Validators.min(0), Validators.max(100)]),
  });

  // Pedidos y Bloqueo
  readonly orderStatusFilter = signal<string>('Todos');
  readonly showBlockOrderModal = signal(false);
  readonly orderToBlock = signal<AdminOrder | null>(null);
  readonly blockActionType = signal<'Bloqueado' | 'Cancelado'>('Cancelado');
  readonly blockReasonControl = new FormControl('', [Validators.required, Validators.minLength(4)]);
  readonly selectedOrderDetail = signal<AdminOrder | null>(null);

  // Notificaciones
  readonly alertMessage = signal<string>('');
  readonly alertType = signal<'success' | 'danger'>('success');

  // ==========================================
  // FORMULARIOS REACTIVOS
  // ==========================================
  readonly productForm = new FormGroup({
    sku: new FormControl('', [Validators.required, Validators.minLength(3)]),
    nombre: new FormControl('', [Validators.required, Validators.minLength(3), NON_WHITESPACE]),
    descripcion: new FormControl('', [Validators.required, NON_WHITESPACE]),
    precio: new FormControl<number | null>(null, [Validators.required, Validators.min(0.01)]),
    stock: new FormControl<number | null>(0, [Validators.required, Validators.min(0), INTEGER]),
    stockMinimo: new FormControl<number | null>(3, [Validators.required, Validators.min(0), INTEGER]),
    categoria: new FormControl('', [Validators.required, NON_WHITESPACE]),
    marca: new FormControl('', [Validators.required, NON_WHITESPACE]),
    proveedorId: new FormControl<number | null>(null, [Validators.required]),
    urlImagen: new FormControl(''),
    estado: new FormControl(true),
  });

  readonly categoryForm = new FormGroup({
    nombre: new FormControl('', [Validators.required, Validators.minLength(2), NON_WHITESPACE]),
    descripcion: new FormControl('', [Validators.required, NON_WHITESPACE]),
    estado: new FormControl(true),
  });

  readonly movementForm = new FormGroup({
    productoId: new FormControl<number | null>(null, [Validators.required]),
    tipoMovimiento: new FormControl<'Entrada' | 'Salida' | 'Ajuste'>('Entrada', [Validators.required]),
    cantidad: new FormControl<number | null>(1, [Validators.required, Validators.min(1), INTEGER]),
    proveedor: new FormControl(''),
    motivo: new FormControl('', [Validators.required, Validators.minLength(4), NON_WHITESPACE]),
    observacion: new FormControl(''),
  });

  readonly promotionForm = new FormGroup({
    nombre: new FormControl('', [Validators.required, Validators.minLength(3), NON_WHITESPACE]),
    codigoCupon: new FormControl('', [Validators.maxLength(50)]),
    tipo: new FormControl<'Porcentaje' | 'Monto Fijo'>('Porcentaje', [Validators.required]),
    valor: new FormControl<number | null>(10, [Validators.required, Validators.min(0.1)]),
    montoMinimo: new FormControl<number | null>(null, [Validators.min(0)]),
    fechaInicio: new FormControl('', [Validators.required]),
    fechaFin: new FormControl('', [Validators.required]),
    aplicaA: new FormControl<'Producto' | 'Categoria' | 'General'>('General', [Validators.required]),
    referenciaId: new FormControl<number | null>(null),
  });

  readonly supplierForm = new FormGroup({
    identificacion: new FormControl('', [Validators.required, SUPPLIER_ID]),
    nombre: new FormControl('', [Validators.required, Validators.minLength(3), NON_WHITESPACE]),
    contacto: new FormControl(''),
    telefono: new FormControl('', [Validators.required, SUPPLIER_PHONE]),
    correo: new FormControl('', [Validators.required, Validators.email]),
    direccion: new FormControl('', [Validators.required, NON_WHITESPACE]),
    estado: new FormControl(true),
  });

  // ==========================================
  // COMPUTED SIGNALS
  // ==========================================
  readonly filteredProducts = computed(() => {
    const term = this.productSearch().toLowerCase().trim();
    const cat = this.productCategoryFilter();
    const status = this.productStatusFilter();

    return this.adminService.products().filter((p) => {
      const matchSearch =
        !term ||
        p.nombre.toLowerCase().includes(term) ||
        p.sku.toLowerCase().includes(term) ||
        p.marca.toLowerCase().includes(term);

      const matchCat = cat === 'Todas' || p.categoria === cat;
      const matchStatus =
        status === 'Todos' ||
        (status === 'Activos' && p.estado) ||
        (status === 'Inactivos' && !p.estado);

      return matchSearch && matchCat && matchStatus;
    });
  });

  readonly filteredInventoryProducts = computed(() => {
    const filter = this.inventoryFilter();
    const prods = this.adminService.products();

    if (filter === 'BajoStock') {
      return prods.filter((p) => p.stock > 0 && p.stock <= p.stockMinimo);
    }
    if (filter === 'Agotados') {
      return prods.filter((p) => p.stock === 0);
    }
    return prods;
  });

  readonly filteredOrders = computed(() => {
    const filter = this.orderStatusFilter();
    const ords = this.adminService.orders();
    if (filter === 'Todos') return ords;
    return ords.filter((o) => o.estado === filter);
  });

  readonly filteredClients = computed(() => {
    const currentAdminEmail = (this.authService.currentUser()?.Email || 'admin@tecnomega.com').toLowerCase();
    return this.adminService.clients().filter((c) => {
      const email = (c.correo || '').toLowerCase();
      return email !== currentAdminEmail && !email.includes('admin@');
    });
  });

  // ==========================================
  // NAVEGACIÓN Y ACCIONES GENERALES
  // ==========================================
  setTab(tab: AdminTab): void {
    this.currentTab.set(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  logout(): void {
    this.authService.logout();
    void this.router.navigate(['/login']);
  }

  private showAlert(message: string, type: 'success' | 'danger' = 'success'): void {
    this.alertMessage.set(message);
    this.alertType.set(type);
    setTimeout(() => {
      this.alertMessage.set('');
    }, 4000);
  }

  // ==========================================
  // MANEJO DE PRODUCTOS
  // ==========================================
  openNewProductModal(): void {
    this.editingProduct.set(null);
    this.productForm.controls.proveedorId.setValidators([Validators.required]);
    this.productForm.controls.proveedorId.updateValueAndValidity();
    this.productForm.controls.urlImagen.setValidators([Validators.required, IMAGE_URL]);
    this.productForm.controls.urlImagen.updateValueAndValidity();
    this.productForm.reset({
      sku: `TEC-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
      precio: null,
      stock: 5,
      stockMinimo: 3,
      categoria: this.adminService.categories()[0]?.nombre || '',
      marca: 'TECNOMEGA',
      proveedorId: null,
      urlImagen: '',
      estado: true,
    });
    this.showProductModal.set(true);
  }

  openEditProductModal(product: AdminProduct): void {
    this.editingProduct.set(product);
    this.productForm.controls.proveedorId.clearValidators();
    this.productForm.controls.proveedorId.updateValueAndValidity();
    this.productForm.controls.urlImagen.setValidators([IMAGE_URL]);
    this.productForm.controls.urlImagen.updateValueAndValidity();
    this.productForm.patchValue({
      sku: product.sku,
      nombre: product.nombre,
      descripcion: product.descripcion,
      precio: product.precio,
      stock: product.stock,
      stockMinimo: product.stockMinimo,
      categoria: product.categoria,
      marca: product.marca,
      proveedorId: product.proveedorId ?? null,
      urlImagen: product.urlImagen,
      estado: product.estado,
    });
    this.showProductModal.set(true);
  }

  saveProduct(): void {
    if (this.productForm.invalid) {
      this.productForm.markAllAsTouched();
      return;
    }

    const val = this.productForm.getRawValue();
    const productData = {
      sku: val.sku!.trim(),
      nombre: val.nombre!.trim(),
      descripcion: val.descripcion!.trim(),
      precio: Number(val.precio),
      stock: Number(val.stock),
      stockMinimo: Number(val.stockMinimo),
      categoria: val.categoria!,
      marca: val.marca!.trim(),
      proveedorId: Number(val.proveedorId),
      urlImagen: val.urlImagen!.trim(),
      estado: val.estado ?? true,
    };

    if (this.editingProduct()) {
      const changes: Partial<typeof productData> = { ...productData };
      if (!productData.urlImagen || productData.urlImagen === (this.editingProduct()!.urlImagen ?? '')) {
        delete changes.urlImagen;
      }
      this.savingProduct.set(true);
      this.adminService.updateProduct(this.editingProduct()!.productoId, changes).subscribe({
        next: () => {
          this.savingProduct.set(false);
          this.showAlert(`Producto "${productData.nombre}" actualizado con éxito.`);
          this.showProductModal.set(false);
        },
        error: (error: unknown) => {
          this.savingProduct.set(false);
          const message = error instanceof HttpErrorResponse
            ? (typeof error.error?.detail === 'string'
                ? error.error.detail
                : typeof error.error?.mensaje === 'string'
                  ? error.error.mensaje
                  : error.message)
            : 'No se pudo actualizar el producto. Inténtalo de nuevo.';
          this.showAlert(`No se pudo actualizar el producto: ${message}`, 'danger');
        },
      });
    } else {
      this.savingProduct.set(true);
      this.adminService.addProduct(productData).subscribe({
        next: (savedProduct) => {
          this.savingProduct.set(false);
          this.showProductModal.set(false);
          this.showAlert(`Producto "${savedProduct.nombre}" registrado exitosamente en el catálogo.`);
        },
        error: (error: unknown) => {
          this.savingProduct.set(false);
          const message = error instanceof HttpErrorResponse
            ? (typeof error.error?.detail === 'string'
                ? error.error.detail
                : typeof error.error?.mensaje === 'string'
                  ? error.error.mensaje
                  : error.message)
            : error instanceof Error
              ? error.message
              : 'No se pudo guardar el producto. Inténtalo de nuevo.';
          this.showAlert(`No se pudo registrar el producto: ${message}`, 'danger');
        },
      });
    }
  }

  toggleProductState(product: AdminProduct): void {
    this.adminService.toggleProductStatus(product.productoId);
    this.showAlert(
      `Producto "${product.nombre}" ${product.estado ? 'desactivado' : 'activado'} correctamente.`
    );
  }

  // ==========================================
  // MANEJO DE CATEGORÍAS
  // ==========================================
  openNewCategoryModal(): void {
    this.editingCategory.set(null);
    this.categoryForm.reset({ estado: true });
    this.showCategoryModal.set(true);
  }

  openEditCategoryModal(cat: AdminCategory): void {
    this.editingCategory.set(cat);
    this.categoryForm.patchValue({
      nombre: cat.nombre,
      descripcion: cat.descripcion,
      estado: cat.estado,
    });
    this.showCategoryModal.set(true);
  }

  saveCategory(): void {
    if (this.categoryForm.invalid) {
      this.categoryForm.markAllAsTouched();
      return;
    }

    const val = this.categoryForm.getRawValue();
    if (this.editingCategory()) {
      this.adminService.updateCategory(this.editingCategory()!.categoriaId, {
        nombre: val.nombre!,
        descripcion: val.descripcion!,
        estado: val.estado ?? true,
      });
      this.showAlert(`Categoría "${val.nombre}" actualizada correctamente.`);
    } else {
      this.adminService.addCategory({
        nombre: val.nombre!,
        descripcion: val.descripcion!,
        estado: val.estado ?? true,
      });
      this.showAlert(`Categoría "${val.nombre}" creada con éxito.`);
    }
    this.showCategoryModal.set(false);
  }

  toggleCategoryState(cat: AdminCategory): void {
    this.adminService.toggleCategoryStatus(cat.categoriaId);
    this.showAlert(`Categoría "${cat.nombre}" ${cat.estado ? 'desactivada' : 'activada'}.`);
  }

  // ==========================================
  // MANEJO DE INVENTARIO
  // ==========================================
  openMovementModal(product?: AdminProduct): void {
    this.selectedProductForMovement.set(product || null);
    this.movementForm.reset({
      productoId: product ? product.productoId : this.adminService.products()[0]?.productoId || null,
      tipoMovimiento: 'Entrada',
      cantidad: 5,
      proveedor: this.adminService.suppliers()[0]?.nombre || '',
      motivo: 'Reabastecimiento de bodega',
      observacion: '',
    });
    this.showMovementModal.set(true);
  }

  saveMovement(): void {
    if (this.movementForm.invalid) {
      this.movementForm.markAllAsTouched();
      return;
    }

    const val = this.movementForm.getRawValue();
    const prod = this.adminService.products().find((p) => p.productoId === Number(val.productoId));

    if (!prod) {
      this.showAlert('Producto no seleccionado o no encontrado.', 'danger');
      return;
    }

    if (val.tipoMovimiento === 'Salida' && Number(val.cantidad) > prod.stock) {
      this.showAlert(
        `No se puede registrar una salida mayor al stock disponible (${prod.stock} unidades).`,
        'danger'
      );
      return;
    }

    this.adminService.registerMovement({
      productoId: prod.productoId,
      productoNombre: prod.nombre,
      tipoMovimiento: val.tipoMovimiento!,
      cantidad: Number(val.cantidad),
      usuarioResponsable: this.authService.currentUser()?.Nombres || 'Administrador',
      proveedor: val.proveedor || undefined,
      motivo: val.motivo!.trim(),
      observacion: val.observacion?.trim(),
    });

    this.showAlert(
      `Movimiento de inventario (${val.tipoMovimiento}) registrado con éxito para "${prod.nombre}".`
    );
    this.showMovementModal.set(false);
  }

  // ==========================================
  // MANEJO DE PROMOCIONES
  // ==========================================
  openNewPromotionModal(): void {
    const today = new Date().toISOString().split('T')[0];
    const nextMonth = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    this.editingPromotionId.set(null);
    this.promotionForm.reset({
      nombre: '',
      codigoCupon: '',
      tipo: 'Porcentaje',
      valor: 10,
      montoMinimo: null,
      aplicaA: 'General',
      referenciaId: null,
      fechaInicio: today,
      fechaFin: nextMonth,
    });
    this.showPromotionModal.set(true);
  }

  openEditPromotionModal(promo: AdminPromotion): void {
    this.editingPromotionId.set(promo.promocionId);
    this.promotionForm.reset({
      nombre: promo.nombre,
      codigoCupon: promo.codigoCupon,
      tipo: promo.tipo,
      valor: promo.valor,
      montoMinimo: promo.montoMinimo ?? null,
      aplicaA: promo.aplicaA,
      referenciaId: promo.productosIds[0] ?? promo.categoriasIds[0] ?? null,
      fechaInicio: promo.fechaInicio,
      fechaFin: promo.fechaFin,
    });
    this.showPromotionModal.set(true);
  }

  savePromotion(): void {
    if (this.promotionForm.invalid) {
      this.promotionForm.markAllAsTouched();
      return;
    }

    const val = this.promotionForm.getRawValue();
    if (val.tipo === 'Porcentaje' && Number(val.valor) > 100) {
      this.showAlert('El porcentaje de descuento debe estar entre 0.1 y 100.', 'danger');
      return;
    }
    if (val.montoMinimo !== null && Number(val.montoMinimo) < 0) {
      this.showAlert('El monto mínimo de compra no puede ser negativo.', 'danger');
      return;
    }
    if (val.fechaFin! < val.fechaInicio!) {
      this.showAlert('La fecha de fin no puede ser anterior a la fecha de inicio.', 'danger');
      return;
    }
    if (val.aplicaA !== 'General' && !val.referenciaId) {
      this.showAlert('Selecciona la categoría o el producto al que aplica la promoción.', 'danger');
      return;
    }

    const input = {
      nombre: val.nombre!.trim(),
      codigoCupon: (val.codigoCupon || '').trim().toUpperCase() || undefined,
      tipo: val.tipo!,
      valor: Number(val.valor),
      montoMinimo: val.montoMinimo ? Number(val.montoMinimo) : undefined,
      fechaInicio: val.fechaInicio!,
      fechaFin: val.fechaFin!,
      aplicaA: val.aplicaA!,
      referenciaId: val.referenciaId ? Number(val.referenciaId) : null,
    };

    const editingId = this.editingPromotionId();
    const request$ = editingId
      ? this.adminService.updatePromotion(editingId, input)
      : this.adminService.addPromotion(input);

    request$.subscribe({
      next: () => {
        this.showAlert(
          editingId
            ? `Promoción "${input.nombre}" actualizada.`
            : `Promoción "${input.nombre}" creada y activada.`,
        );
        this.showPromotionModal.set(false);
        this.editingPromotionId.set(null);
      },
      error: (err: any) => {
        const detail = err?.error?.detail;
        this.showAlert(
          typeof detail === 'string' ? detail : 'No se pudo guardar la promoción. Inténtalo de nuevo.',
          'danger',
        );
      },
    });
  }

  togglePromoState(promo: AdminPromotion): void {
    this.adminService.togglePromotionStatus(promo.promocionId, promo.estado).subscribe({
      next: () =>
        this.showAlert(`Promoción "${promo.nombre}" ${promo.estado ? 'desactivada' : 'activada'}.`),
      error: () => this.showAlert('No se pudo cambiar el estado de la promoción.', 'danger'),
    });
  }

  // ==========================================
  // MANEJO DE PROVEEDORES
  // ==========================================
  openNewSupplierModal(): void {
    this.supplierForm.reset({ estado: true });
    this.showSupplierModal.set(true);
  }

  saveSupplier(): void {
    if (this.supplierForm.invalid) {
      this.supplierForm.markAllAsTouched();
      return;
    }

    const val = this.supplierForm.getRawValue();
    this.adminService.addSupplier({
      identificacion: val.identificacion!.trim(),
      nombre: val.nombre!.trim(),
      contacto: val.contacto?.trim(),
      telefono: val.telefono!.trim(),
      correo: val.correo!.trim(),
      direccion: val.direccion!.trim(),
      estado: val.estado ?? true,
    });

    this.showAlert(`Proveedor "${val.nombre}" registrado exitosamente.`);
    this.showSupplierModal.set(false);
  }

  toggleSupState(sup: AdminSupplier): void {
    this.adminService.toggleSupplierStatus(sup.proveedorId);
    this.showAlert(`Proveedor "${sup.nombre}" ${sup.estado ? 'desactivado' : 'activado'}.`);
  }

  // ==========================================
  // MANEJO DE CLIENTES
  // ==========================================
  toggleClient(cliId: number, nombre: string, currentEstado: boolean): void {
    this.adminService.toggleClientStatus(cliId);
    this.showAlert(`Cliente "${nombre}" ${currentEstado ? 'desactivado' : 'activado'}.`);
  }

  // ==========================================
  // FACTURACIÓN
  // ==========================================
  viewInvoiceDetail(inv: AdminInvoice): void {
    this.selectedInvoice.set(inv);
  }

  printInvoice(inv?: AdminInvoice): void {
    if (inv) {
      this.selectedInvoice.set(inv);
    }
    setTimeout(() => {
      window.print();
    }, 150);
  }

  closeInvoiceDetail(): void {
    this.selectedInvoice.set(null);
  }

  // ==========================================
  // GESTIÓN Y BLOQUEO DE PEDIDOS
  // ==========================================
  openBlockOrderModal(order: AdminOrder, action: 'Bloqueado' | 'Cancelado'): void {
    this.orderToBlock.set(order);
    this.blockActionType.set(action);
    this.blockReasonControl.reset(
      action === 'Cancelado'
        ? 'Inconsistencia en los datos de pago o falta de stock en bodega'
        : 'Bloqueado por verificación de seguridad de cuenta o dirección inválida'
    );
    this.showBlockOrderModal.set(true);
  }

  confirmBlockOrCancel(): void {
    const order = this.orderToBlock();
    if (!order || this.blockReasonControl.invalid) {
      this.blockReasonControl.markAllAsTouched();
      return;
    }

    const action = this.blockActionType();
    const reason = this.blockReasonControl.value!.trim();
    this.adminService.updateOrderStatus(order.pedidoId, action, reason);
    this.showAlert(
      `Pedido ${order.numero} marcado como "${action}". Notificación de aviso enviada al cliente (${order.clienteEmail}).`
    );
    this.showBlockOrderModal.set(false);
  }

  changeOrderStatus(order: AdminOrder, newStatus: any): void {
    if (newStatus === 'Cancelado' || newStatus === 'Bloqueado') {
      this.openBlockOrderModal(order, newStatus);
      return;
    }
    this.adminService.updateOrderStatus(order.pedidoId, newStatus);
    this.showAlert(`Estado del pedido ${order.numero} actualizado a "${newStatus}".`);
  }

  viewOrderDetail(order: AdminOrder): void {
    this.selectedOrderDetail.set(order);
  }

  closeOrderDetail(): void {
    this.selectedOrderDetail.set(null);
  }
}
