import { HttpClient, HttpHeaders } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { Observable, catchError, map, of, tap } from 'rxjs';
import { API_BASE_URL } from './api.config';
import { AuthService } from './auth.service';
import { getProductImage } from './product-images.config';
import { Product } from './product.service';

export interface AdminProduct {
  productoId: number;
  sku: string;
  nombre: string;
  descripcion: string;
  precio: number;
  stock: number;
  stockMinimo: number;
  categoria: string;
  categoriaId?: number;
  marca: string;
  urlImagen: string;
  estado: boolean;
  fechaCreacion?: string;
}

export interface AdminCategory {
  categoriaId: number;
  nombre: string;
  descripcion: string;
  estado: boolean;
  totalProductos?: number;
}

export interface InventoryMovement {
  movimientoId: number;
  productoId: number;
  productoNombre: string;
  tipoMovimiento: 'Entrada' | 'Salida' | 'Ajuste';
  cantidad: number;
  usuarioResponsable: string;
  proveedor?: string;
  motivo: string;
  observacion?: string;
  fecha: string;
  stockResultante?: number;
}

export interface AdminSupplier {
  proveedorId: number;
  identificacion: string; // RUC o Cedula
  nombre: string;
  contacto?: string;
  telefono: string;
  correo: string;
  direccion: string;
  estado: boolean;
}

export interface AdminClient {
  clienteId: number;
  personaId: number;
  identificacion: string;
  nombres: string;
  apellidos: string;
  correo: string;
  telefono: string;
  direccion?: string;
  estado: boolean;
  fechaRegistro: string;
  totalCompras?: number;
}

export interface AdminPromotion {
  promocionId: number;
  nombre: string;
  descripcion: string;
  tipo: 'Porcentaje' | 'Monto Fijo';
  valor: number; // Ej: 15 para 15% o $10
  montoMinimo?: number;
  fechaInicio: string;
  fechaFin: string;
  prioridad: number;
  estado: boolean;
  aplicaA: 'Producto' | 'Categoria' | 'General';
  referenciaNombre?: string;
}

export interface AdminInvoiceDetail {
  detalleId: number;
  productoId: number;
  productoNombre: string;
  cantidad: number;
  precioUnitario: number;
  descuentoPorcentual: number;
  descuentoValor: number;
  subtotal: number;
  total: number;
}

export interface AdminInvoice {
  facturaId: number;
  numero: string;
  clienteNombre: string;
  clienteIdentificacion: string;
  fecha: string;
  subtotal: number;
  descuento: number;
  impuesto: number; // IVA 15%
  total: number;
  estado: 'Emitida' | 'Anulada' | 'Pagada';
  detalles: AdminInvoiceDetail[];
}

export interface OrderNotification {
  notificacionId: number;
  pedidoId: number;
  clienteEmail: string;
  clienteNombre: string;
  estado: string; // 'Cancelado' | 'Bloqueado'
  motivo: string;
  fecha: string;
  leido: boolean;
}

export interface AdminOrder {
  pedidoId: number;
  numero: string;
  clienteNombre: string;
  clienteIdentificacion: string;
  clienteEmail: string;
  fecha: string;
  direccion: string;
  subtotal: number;
  descuento: number;
  total: number;
  estado: 'Pendiente' | 'Procesando' | 'Enviado' | 'Entregado' | 'Cancelado' | 'Bloqueado';
  motivoBloqueo?: string;
  items: Array<{
    productoNombre: string;
    cantidad: number;
    precioUnitario: number;
    total: number;
  }>;
}

export interface DashboardStats {
  totalVentas: number;
  totalPedidos: number;
  totalProductos: number;
  productosStockBajo: number;
  totalClientes: number;
  totalProveedores: number;
  promocionesActivas: number;
  pedidosPendientes: number;
  pedidosBloqueados: number;
  ventasPorCategoria: { categoria: string; total: number; porcentaje: number }[];
  ultimasFacturas: AdminInvoice[];
  productosCriticos: AdminProduct[];
}

@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);

  // Estados reactivos (Signals)
  readonly products = signal<AdminProduct[]>([]);
  readonly categories = signal<AdminCategory[]>([]);
  readonly inventoryMovements = signal<InventoryMovement[]>([]);
  readonly suppliers = signal<AdminSupplier[]>([]);
  readonly clients = signal<AdminClient[]>([]);
  readonly promotions = signal<AdminPromotion[]>([]);
  readonly invoices = signal<AdminInvoice[]>([]);
  readonly orders = signal<AdminOrder[]>([]);
  readonly notifications = signal<OrderNotification[]>([]);
  readonly stats = signal<DashboardStats | null>(null);

  constructor() {
    this.initializeData();
  }

  private getAuthHeaders(): HttpHeaders {
    const token = this.authService.accessToken();
    let headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }
    return headers;
  }

  // ==========================================
  // INICIALIZACIÓN Y CARGA DE DATOS
  // ==========================================
  initializeData(): void {
    // Intentar leer de localStorage o cargar semillas iniciales
    const catMap = new Map<number, string>([
      [1, 'Audio'],
      [2, 'Periféricos'],
      [3, 'Smartphones'],
      [4, 'Laptops'],
      [5, 'Gaming'],
      [6, 'Componentes'],
    ]);

    const storedProducts = this.loadFromStorage<AdminProduct[]>('admin_products');
    if (storedProducts && storedProducts.length > 0) {
      const sanitized = storedProducts.map((p) => ({
        ...p,
        categoria:
          p.categoria && p.categoria !== 'General'
            ? p.categoria
            : (p.categoriaId ? catMap.get(p.categoriaId) : null) || 'General',
        urlImagen:
          !p.urlImagen || p.urlImagen.includes('favicon') || !p.urlImagen.startsWith('http')
            ? getProductImage(p.sku)
            : p.urlImagen,
      }));
      this.products.set(sanitized);
    } else {
      this.fetchProductsFromApi();
    }

    const storedCats = this.loadFromStorage<AdminCategory[]>('admin_categories');
    if (storedCats && storedCats.length > 0) {
      this.categories.set(storedCats);
    } else {
      this.initDefaultCategories();
    }

    const storedSuppliers = this.loadFromStorage<AdminSupplier[]>('admin_suppliers');
    this.suppliers.set(storedSuppliers || this.getDefaultSuppliers());

    const currentAdminEmail = (this.authService.currentUser()?.Email || 'admin@tecnomega.com').toLowerCase();
    const storedClients = this.loadFromStorage<AdminClient[]>('admin_clients');
    const filteredStoredClients = storedClients
      ? storedClients.filter(
          (c) =>
            (c.correo || '').toLowerCase() !== currentAdminEmail &&
            !(c.correo || '').toLowerCase().includes('admin@')
        )
      : null;
    this.clients.set(
      filteredStoredClients ||
        this.getDefaultClients().filter(
          (c) => (c.correo || '').toLowerCase() !== currentAdminEmail && !(c.correo || '').toLowerCase().includes('admin@')
        )
    );

    const storedPromos = this.loadFromStorage<AdminPromotion[]>('admin_promotions');
    this.promotions.set(storedPromos || this.getDefaultPromotions());

    const storedMovements = this.loadFromStorage<InventoryMovement[]>('admin_movements');
    this.inventoryMovements.set(storedMovements || this.getDefaultMovements());

    const storedInvoices = this.loadFromStorage<AdminInvoice[]>('admin_invoices');
    this.invoices.set(storedInvoices || this.getDefaultInvoices());

    const storedOrders = this.loadFromStorage<AdminOrder[]>('admin_orders');
    this.orders.set(storedOrders || this.getDefaultOrders());

    const storedNotifications = this.loadFromStorage<OrderNotification[]>('client_notifications');
    this.notifications.set(storedNotifications || []);

    this.recalculateStats();
    this.refreshAllData();
  }

  refreshAllData(): void {
    this.fetchProductsFromApi();
    this.fetchClientsFromApi();
    this.fetchOrdersFromApi();
    this.fetchInvoicesFromApi();
  }

  fetchProductsFromApi(): void {
    this.http.get<any>(`${API_BASE_URL}/productos?limite=100`, { headers: this.getAuthHeaders() })
      .pipe(
        catchError(() => of({ productos: [] }))
      )
      .subscribe((res) => {
        if (res && res.productos && res.productos.length > 0) {
          const catMap = new Map<number, string>([
            [1, 'Audio'],
            [2, 'Periféricos'],
            [3, 'Smartphones'],
            [4, 'Laptops'],
            [5, 'Gaming'],
            [6, 'Componentes'],
          ]);
          const brandMap = new Map<number, string>([
            [1, 'Apple'],
            [2, 'Logitech'],
            [3, 'ASUS'],
            [4, 'NVIDIA'],
            [5, 'Samsung'],
          ]);

          const currentProds = this.products();
          const localStockMap = new Map(currentProds.map((p) => [p.productoId, p.stock]));

          const mapped: AdminProduct[] = res.productos.map((p: any) => {
            const resolvedCat = p.Categoria || catMap.get(p.CategoriaId) || 'General';
            const resolvedBrand = p.Marca || brandMap.get(p.MarcaId) || 'TECNOMEGA';
            const localStock = localStockMap.get(p.ProductoId);
            const stockFinal = localStock !== undefined ? localStock : (p.Stock ?? 10);

            return {
              productoId: p.ProductoId,
              sku: p.SKU || `PRD-${p.ProductoId}`,
              nombre: p.Nombre,
              descripcion: p.Descripcion || '',
              precio: Number(p.Precio),
              stock: stockFinal,
              stockMinimo: p.StockMinimo ?? 5,
              categoria: resolvedCat,
              categoriaId: p.CategoriaId,
              marca: resolvedBrand,
              urlImagen:
                p.UrlImagen && p.UrlImagen.startsWith('http')
                  ? p.UrlImagen
                  : getProductImage(p.SKU || ''),
              estado: p.Estado ?? true,
              fechaCreacion: new Date().toISOString().split('T')[0],
            };
          });
          this.products.set(mapped);
          this.saveToStorage('admin_products', mapped);
        } else {
          const defaultProducts = this.getDefaultProducts();
          this.products.set(defaultProducts);
          this.saveToStorage('admin_products', defaultProducts);
        }
        this.recalculateStats();
      });
  }

  fetchClientsFromApi(): void {
    this.http
      .get<any>(`${API_BASE_URL}/clientes?limite=100`, { headers: this.getAuthHeaders() })
      .pipe(catchError(() => of({ clientes: [] })))
      .subscribe((res) => {
        const currentAdminEmail = (this.authService.currentUser()?.Email || 'admin@tecnomega.com').toLowerCase();

        let apiClients: AdminClient[] = [];
        if (res && Array.isArray(res.clientes) && res.clientes.length > 0) {
          apiClients = res.clientes
            .filter((c: any) => {
              const email = (c.Email || '').toLowerCase();
              return email !== currentAdminEmail && !email.includes('admin@');
            })
            .map((c: any) => ({
              clienteId: c.ClienteId,
              personaId: c.PersonaId,
              identificacion: c.Identificacion || `CLI-${c.ClienteId}`,
              nombres: c.Nombres || 'Cliente',
              apellidos: c.Apellidos || '',
              correo: c.Email || 'Sin correo',
              telefono: c.Telefono || 'Sin teléfono',
              direccion: c.Direccion || '',
              estado: c.Estado ?? true,
              fechaRegistro: c.FechaRegistro ? c.FechaRegistro.split('T')[0] : new Date().toISOString().split('T')[0],
              totalCompras: 0,
            }));
        }

        const defaultClients = this.getDefaultClients();
        const apiEmails = new Set(apiClients.map((c) => (c.correo || '').toLowerCase()));
        const apiIds = new Set(apiClients.map((c) => c.identificacion));

        const preservedDefaults = defaultClients.filter(
          (d) =>
            !apiEmails.has((d.correo || '').toLowerCase()) &&
            !apiIds.has(d.identificacion) &&
            (d.correo || '').toLowerCase() !== currentAdminEmail &&
            !(d.correo || '').toLowerCase().includes('admin@')
        );

        const combined = [...apiClients, ...preservedDefaults];
        this.clients.set(combined);
        this.saveToStorage('admin_clients', combined);
        this.recalculateStats();
      });
  }

  fetchOrdersFromApi(): void {
    this.http
      .get<any>(`${API_BASE_URL}/pedidos?limite=100`, { headers: this.getAuthHeaders() })
      .pipe(catchError(() => of({ pedidos: [] })))
      .subscribe((res) => {
        const currentOrders = this.orders();
        const localStatusMap = new Map(
          currentOrders.map((o) => [o.pedidoId, { estado: o.estado, motivo: o.motivoBloqueo }])
        );

        let apiMapped: AdminOrder[] = [];
        if (res && Array.isArray(res.pedidos) && res.pedidos.length > 0) {
          apiMapped = res.pedidos.map((p: any) => {
            const items = Array.isArray(p.Items)
              ? p.Items.map((it: any) => ({
                  productoNombre: it.Nombre || 'Producto',
                  cantidad: it.Cantidad,
                  precioUnitario: Number(it.PrecioUnitario || 0),
                  total: Number(it.Total || 0),
                }))
              : [];

            const local = localStatusMap.get(p.PedidoId);

            return {
              pedidoId: p.PedidoId,
              numero: `PED-${String(p.PedidoId).padStart(6, '0')}`,
              clienteNombre: p.Cliente
                ? `${p.Cliente.Nombres || ''} ${p.Cliente.Apellidos || ''}`.trim()
                : 'Cliente Registrado',
              clienteIdentificacion: p.Cliente?.Identificacion || `CLI-${p.ClienteId || ''}`,
              clienteEmail: p.Cliente?.Email || '',
              fecha: p.FechaPedido ? new Date(p.FechaPedido).toLocaleString() : new Date().toLocaleString(),
              direccion: p.Direccion
                ? `${p.Direccion.Direccion || ''}${p.Direccion.Ciudad ? ', ' + p.Direccion.Ciudad : ''}`
                : 'Retiro en tienda / Dirección registrada',
              subtotal: Number(p.Subtotal || 0),
              descuento: Number(p.Descuento || 0),
              total: Number(p.Total || 0),
              estado: local?.estado || p.Estado || 'Pendiente',
              motivoBloqueo: local?.motivo,
              items,
            };
          });
        }

        // Combinar pedidos reales de la base de datos con los pedidos preexistentes
        const defaultOrders = this.getDefaultOrders();
        const apiIds = new Set(apiMapped.map((o) => o.pedidoId));

        const preservedDefaults = defaultOrders
          .filter((d) => !apiIds.has(d.pedidoId))
          .map((d) => {
            const local = localStatusMap.get(d.pedidoId);
            return local ? { ...d, estado: local.estado, motivoBloqueo: local.motivo } : d;
          });

        const combined = [...apiMapped, ...preservedDefaults];
        this.orders.set(combined);
        this.saveToStorage('admin_orders', combined);
        this.recalculateStats();
      });
  }

  fetchInvoicesFromApi(): void {
    this.http
      .get<any>(`${API_BASE_URL}/facturas?limite=100`, { headers: this.getAuthHeaders() })
      .pipe(catchError(() => of({ facturas: [] })))
      .subscribe((res) => {
        let apiInvoices: AdminInvoice[] = [];
        if (res && Array.isArray(res.facturas) && res.facturas.length > 0) {
          apiInvoices = res.facturas.map((f: any) => {
            const detalles = Array.isArray(f.detalles)
              ? f.detalles.map((d: any) => ({
                  detalleId: d.DetalleFacturaId,
                  productoId: d.ProductoId,
                  productoNombre: d.Nombre || 'Producto',
                  cantidad: d.Cantidad,
                  precioUnitario: Number(d.PrecioUnitario || 0),
                  descuentoPorcentual: Number(d.DescuentoPorcentaje || 0),
                  descuentoValor: Number(d.DescuentoMonto || 0),
                  subtotal: Number(d.Subtotal || 0),
                  total: Number(d.Total || 0),
                }))
              : [];

            return {
              facturaId: f.FacturaId,
              numero: f.NumeroFactura || `FAC-${String(f.FacturaId).padStart(6, '0')}`,
              clienteNombre: f.Cliente
                ? `${f.Cliente.Nombres || ''} ${f.Cliente.Apellidos || ''}`.trim()
                : 'Cliente',
              clienteIdentificacion: f.Cliente?.Identificacion || 'S/I',
              fecha: f.FechaEmision ? new Date(f.FechaEmision).toLocaleString() : new Date().toLocaleString(),
              subtotal: Number(f.Subtotal || 0),
              descuento: Number(f.DescuentoTotal || 0),
              impuesto: Number(f.IVA || 0),
              total: Number(f.Total || 0),
              estado: f.Estado || 'Emitida',
              detalles,
            };
          });
        }

        const defaultInvoices = this.getDefaultInvoices();
        const apiIds = new Set(apiInvoices.map((inv) => inv.facturaId));
        const preservedDefaults = defaultInvoices.filter((d) => !apiIds.has(d.facturaId));

        const combined = [...apiInvoices, ...preservedDefaults];
        this.invoices.set(combined);
        this.saveToStorage('admin_invoices', combined);
        this.recalculateStats();
      });
  }

  // ==========================================
  // PRODUCTOS (RF05, RF06, RF07, RF09)
  // ==========================================
  addProduct(productData: Omit<AdminProduct, 'productoId'>): void {
    const current = this.products();
    const newId = current.length > 0 ? Math.max(...current.map((p) => p.productoId)) + 1 : 1;
    const newProduct: AdminProduct = {
      ...productData,
      productoId: newId,
      fechaCreacion: new Date().toISOString().split('T')[0],
    };

    const updated = [newProduct, ...current];
    this.products.set(updated);
    this.saveToStorage('admin_products', updated);

    // Registrar movimiento de inventario inicial por entrada
    if (newProduct.stock > 0) {
      this.registerMovement({
        productoId: newId,
        productoNombre: newProduct.nombre,
        tipoMovimiento: 'Entrada',
        cantidad: newProduct.stock,
        usuarioResponsable: this.authService.currentUser()?.Nombres || 'Administrador',
        motivo: 'Inventario Inicial',
        observacion: 'Carga inicial al registrar producto',
      });
    }

    this.recalculateStats();
  }

  updateProduct(id: number, changes: Partial<AdminProduct>): void {
    const updated = this.products().map((p) => (p.productoId === id ? { ...p, ...changes } : p));
    this.products.set(updated);
    this.saveToStorage('admin_products', updated);
    this.recalculateStats();

    // Persistir cambios en SQL Server mediante el backend
    const payload: any = {};
    if (changes.stock !== undefined) payload.Stock = Number(changes.stock);
    if (changes.stockMinimo !== undefined) payload.StockMinimo = Number(changes.stockMinimo);
    if (changes.precio !== undefined) payload.Precio = Number(changes.precio);
    if (changes.nombre !== undefined) payload.Nombre = changes.nombre;
    if (changes.descripcion !== undefined) payload.Descripcion = changes.descripcion;
    if (changes.estado !== undefined) payload.Estado = changes.estado;

    if (Object.keys(payload).length > 0) {
      this.http
        .patch(`${API_BASE_URL}/productos/${id}`, payload, { headers: this.getAuthHeaders() })
        .pipe(catchError(() => of(null)))
        .subscribe((res: any) => {
          if (res && res.Stock !== undefined) {
            const syncd = this.products().map((p) => (p.productoId === id ? { ...p, stock: res.Stock } : p));
            this.products.set(syncd);
            this.saveToStorage('admin_products', syncd);
            this.recalculateStats();
          }
        });
    }
  }

  toggleProductStatus(id: number): void {
    const updated = this.products().map((p) => (p.productoId === id ? { ...p, estado: !p.estado } : p));
    this.products.set(updated);
    this.saveToStorage('admin_products', updated);
    this.recalculateStats();
  }

  deleteProduct(id: number): void {
    const updated = this.products().filter((p) => p.productoId !== id);
    this.products.set(updated);
    this.saveToStorage('admin_products', updated);
    this.recalculateStats();
  }

  // ==========================================
  // CATEGORÍAS (RF08)
  // ==========================================
  addCategory(category: Omit<AdminCategory, 'categoriaId'>): void {
    const current = this.categories();
    const newId = current.length > 0 ? Math.max(...current.map((c) => c.categoriaId)) + 1 : 1;
    const newCat: AdminCategory = { ...category, categoriaId: newId };
    const updated = [...current, newCat];
    this.categories.set(updated);
    this.saveToStorage('admin_categories', updated);
    this.recalculateStats();
  }

  updateCategory(id: number, changes: Partial<AdminCategory>): void {
    const updated = this.categories().map((c) => (c.categoriaId === id ? { ...c, ...changes } : c));
    this.categories.set(updated);
    this.saveToStorage('admin_categories', updated);
  }

  toggleCategoryStatus(id: number): void {
    const updated = this.categories().map((c) => (c.categoriaId === id ? { ...c, estado: !c.estado } : c));
    this.categories.set(updated);
    this.saveToStorage('admin_categories', updated);
  }

  // ==========================================
  // INVENTARIO Y MOVIMIENTOS (RF13, RF14, RF15, RF16, RF17, RF18)
  // ==========================================
  registerMovement(movement: Omit<InventoryMovement, 'movimientoId' | 'fecha'>): void {
    const currentMovements = this.inventoryMovements();
    const newId = currentMovements.length > 0 ? Math.max(...currentMovements.map((m) => m.movimientoId)) + 1 : 1;

    // Actualizar stock del producto
    const prod = this.products().find((p) => p.productoId === movement.productoId);
    let nuevoStock = prod ? prod.stock : 0;

    if (movement.tipoMovimiento === 'Entrada') {
      nuevoStock += movement.cantidad;
    } else if (movement.tipoMovimiento === 'Salida') {
      nuevoStock = Math.max(0, nuevoStock - movement.cantidad);
    } else if (movement.tipoMovimiento === 'Ajuste') {
      nuevoStock = movement.cantidad; // Ajuste directo al valor ingresado
    }

    if (prod) {
      this.updateProduct(prod.productoId, { stock: nuevoStock });
    }

    const newMov: InventoryMovement = {
      ...movement,
      movimientoId: newId,
      fecha: new Date().toLocaleString(),
      stockResultante: nuevoStock,
    };

    const updated = [newMov, ...currentMovements];
    this.inventoryMovements.set(updated);
    this.saveToStorage('admin_movements', updated);
    this.recalculateStats();
  }

  // ==========================================
  // PROVEEDORES (RF11)
  // ==========================================
  addSupplier(supplier: Omit<AdminSupplier, 'proveedorId'>): void {
    const current = this.suppliers();
    const newId = current.length > 0 ? Math.max(...current.map((s) => s.proveedorId)) + 1 : 1;
    const newSup: AdminSupplier = { ...supplier, proveedorId: newId };
    const updated = [newSup, ...current];
    this.suppliers.set(updated);
    this.saveToStorage('admin_suppliers', updated);
    this.recalculateStats();
  }

  updateSupplier(id: number, changes: Partial<AdminSupplier>): void {
    const updated = this.suppliers().map((s) => (s.proveedorId === id ? { ...s, ...changes } : s));
    this.suppliers.set(updated);
    this.saveToStorage('admin_suppliers', updated);
  }

  toggleSupplierStatus(id: number): void {
    const updated = this.suppliers().map((s) => (s.proveedorId === id ? { ...s, estado: !s.estado } : s));
    this.suppliers.set(updated);
    this.saveToStorage('admin_suppliers', updated);
  }

  // ==========================================
  // CLIENTES (RF10, RF12)
  // ==========================================
  toggleClientStatus(clienteId: number): void {
    const updated = this.clients().map((c) => (c.clienteId === clienteId ? { ...c, estado: !c.estado } : c));
    this.clients.set(updated);
    this.saveToStorage('admin_clients', updated);
    this.recalculateStats();
  }

  // ==========================================
  // PROMOCIONES Y DESCUENTOS (RF19, RF20, RF21, RF24, RF26, RF27)
  // ==========================================
  addPromotion(promo: Omit<AdminPromotion, 'promocionId'>): void {
    const current = this.promotions();
    const newId = current.length > 0 ? Math.max(...current.map((p) => p.promocionId)) + 1 : 1;
    const newP: AdminPromotion = { ...promo, promocionId: newId };
    const updated = [newP, ...current];
    this.promotions.set(updated);
    this.saveToStorage('admin_promotions', updated);
    this.recalculateStats();
  }

  updatePromotion(id: number, changes: Partial<AdminPromotion>): void {
    const updated = this.promotions().map((p) => (p.promocionId === id ? { ...p, ...changes } : p));
    this.promotions.set(updated);
    this.saveToStorage('admin_promotions', updated);
  }

  togglePromotionStatus(id: number): void {
    const updated = this.promotions().map((p) => (p.promocionId === id ? { ...p, estado: !p.estado } : p));
    this.promotions.set(updated);
    this.saveToStorage('admin_promotions', updated);
    this.recalculateStats();
  }

  // ==========================================
  // FACTURACIÓN (RF28, RF34, RF36, RF38)
  // ==========================================
  addInvoice(invoice: Omit<AdminInvoice, 'facturaId' | 'numero' | 'fecha'>): void {
    const current = this.invoices();
    const newId = current.length > 0 ? Math.max(...current.map((i) => i.facturaId)) + 1 : 1;
    const num = `FAC-${String(newId).padStart(6, '0')}`;
    const newInv: AdminInvoice = {
      ...invoice,
      facturaId: newId,
      numero: num,
      fecha: new Date().toLocaleString(),
    };
    const updated = [newInv, ...current];
    this.invoices.set(updated);
    this.saveToStorage('admin_invoices', updated);
    this.recalculateStats();
  }

  // ==========================================
  // GESTIÓN DE PEDIDOS Y NOTIFICACIONES
  // ==========================================
  updateOrderStatus(
    pedidoId: number,
    nuevoEstado: 'Pendiente' | 'Procesando' | 'Enviado' | 'Entregado' | 'Cancelado' | 'Bloqueado',
    motivo?: string
  ): void {
    const currentOrders = this.orders();
    const orderIndex = currentOrders.findIndex((o) => o.pedidoId === pedidoId);
    if (orderIndex === -1) return;

    const targetOrder = currentOrders[orderIndex];
    const updatedOrder: AdminOrder = {
      ...targetOrder,
      estado: nuevoEstado,
      motivoBloqueo: motivo || (nuevoEstado === 'Bloqueado' ? 'Bloqueado por verificación de seguridad' : nuevoEstado === 'Cancelado' ? 'Cancelado por el Administrador' : undefined),
    };

    const updatedList = [...currentOrders];
    updatedList[orderIndex] = updatedOrder;
    this.orders.set(updatedList);
    this.saveToStorage('admin_orders', updatedList);

    // Si se cancela o bloquea, registrar notificación para el cliente
    if (nuevoEstado === 'Cancelado' || nuevoEstado === 'Bloqueado') {
      const notif: OrderNotification = {
        notificacionId: Date.now(),
        pedidoId,
        clienteEmail: targetOrder.clienteEmail,
        clienteNombre: targetOrder.clienteNombre,
        estado: nuevoEstado,
        motivo: motivo || (nuevoEstado === 'Bloqueado' ? 'Pedido bloqueado por auditoría administrativa' : 'Pedido cancelado por inconvenientes con inventario o datos de pago'),
        fecha: new Date().toLocaleString(),
        leido: false,
      };

      const updatedNotifs = [notif, ...this.notifications().filter((n) => n.pedidoId !== pedidoId)];
      this.notifications.set(updatedNotifs);
      this.saveToStorage('client_notifications', updatedNotifs);
    }

    // Intentar sincronizar con el backend
    this.http
      .patch(
        `${API_BASE_URL}/pedidos/${pedidoId}/estado`,
        { Estado: nuevoEstado === 'Bloqueado' ? 'Cancelado' : nuevoEstado },
        { headers: this.getAuthHeaders() }
      )
      .pipe(catchError(() => of(null)))
      .subscribe();

    this.recalculateStats();
  }

  // ==========================================
  // ESTADÍSTICAS Y CÁLCULOS (RF39, RF40)
  // ==========================================
  recalculateStats(): void {
    const prods = this.products();
    const invs = this.invoices();
    const ords = this.orders();
    const clis = this.clients();
    const sups = this.suppliers();
    const promos = this.promotions();

    const totalVentas = invs.reduce((acc, curr) => acc + (curr.estado !== 'Anulada' ? curr.total : 0), 0);
    const lowStock = prods.filter((p) => p.stock <= p.stockMinimo);
    const pedidosPendientes = ords.filter((o) => o.estado === 'Pendiente' || o.estado === 'Procesando').length;
    const pedidosBloqueados = ords.filter((o) => o.estado === 'Bloqueado' || o.estado === 'Cancelado').length;

    // Calcular distribución por categoría
    const catMap = new Map<string, number>();
    prods.forEach((p) => {
      const val = catMap.get(p.categoria) || 0;
      catMap.set(p.categoria, val + 1);
    });

    const ventasPorCategoria = Array.from(catMap.entries()).map(([categoria, count]) => ({
      categoria,
      total: count,
      porcentaje: prods.length > 0 ? Math.round((count / prods.length) * 100) : 0,
    }));

    this.stats.set({
      totalVentas,
      totalPedidos: ords.length || invs.length,
      totalProductos: prods.length,
      productosStockBajo: lowStock.length,
      totalClientes: clis.length,
      totalProveedores: sups.length,
      promocionesActivas: promos.filter((p) => p.estado).length,
      pedidosPendientes,
      pedidosBloqueados,
      ventasPorCategoria,
      ultimasFacturas: invs.slice(0, 5),
      productosCriticos: lowStock,
    });
  }

  // ==========================================
  // HELPERS DE STORAGE & DATOS DEFAULT
  // ==========================================
  private saveToStorage(key: string, data: any): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(`tecnomega_${key}`, JSON.stringify(data));
      }
    } catch {
      // Ignorar si el storage no está disponible
    }
  }

  private loadFromStorage<T>(key: string): T | null {
    try {
      if (typeof localStorage !== 'undefined') {
        const item = localStorage.getItem(`tecnomega_${key}`);
        return item ? JSON.parse(item) : null;
      }
    } catch {
      return null;
    }
    return null;
  }

  private initDefaultCategories(): void {
    const defaultCats: AdminCategory[] = [
      { categoriaId: 1, nombre: 'Laptops', descripcion: 'Computadoras portátiles de alto rendimiento', estado: true },
      { categoriaId: 2, nombre: 'Smartphones', descripcion: 'Teléfonos móviles y accesorios inteligentes', estado: true },
      { categoriaId: 3, nombre: 'Audio', descripcion: 'Audífonos, parlantes y sistemas de sonido', estado: true },
      { categoriaId: 4, nombre: 'Gaming', descripcion: 'Periféricos y consolas para videojuegos', estado: true },
      { categoriaId: 5, nombre: 'Componentes', descripcion: 'Procesadores, tarjetas de video, RAM y fuentes', estado: true },
      { categoriaId: 6, nombre: 'Periféricos', descripcion: 'Teclados, mouse, monitores e impresoras', estado: true },
    ];
    this.categories.set(defaultCats);
    this.saveToStorage('admin_categories', defaultCats);
  }

  private getDefaultProducts(): AdminProduct[] {
    return [
      {
        productoId: 1,
        sku: 'LAP-MAC-M3',
        nombre: 'MacBook Pro 14" M3 Pro',
        descripcion: 'Chip M3 Pro de Apple, 18GB memoria unificada, 512GB SSD',
        precio: 2199.99,
        stock: 8,
        stockMinimo: 3,
        categoria: 'Laptops',
        marca: 'Apple',
        urlImagen: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=500',
        estado: true,
        fechaCreacion: '2026-01-15',
      },
      {
        productoId: 2,
        sku: 'TEL-IPH-15P',
        nombre: 'iPhone 15 Pro Max 256GB',
        descripcion: 'Titanio natural con pantalla Super Retina XDR de 6.7"',
        precio: 1399.00,
        stock: 12,
        stockMinimo: 5,
        categoria: 'Smartphones',
        marca: 'Apple',
        urlImagen: 'https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=500',
        estado: true,
        fechaCreacion: '2026-02-10',
      },
      {
        productoId: 3,
        sku: 'AUD-SONY-XM5',
        nombre: 'Sony WH-1000XM5 Noise Cancelling',
        descripcion: 'Auriculares inalámbricos con cancelación de ruido líder en la industria',
        precio: 349.99,
        stock: 2,
        stockMinimo: 5,
        categoria: 'Audio',
        marca: 'Sony',
        urlImagen: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500',
        estado: true,
        fechaCreacion: '2026-02-20',
      },
      {
        productoId: 4,
        sku: 'PER-LOG-MX3',
        nombre: 'Logitech MX Master 3S',
        descripcion: 'Mouse inalámbrico de alto rendimiento para productividad',
        precio: 99.99,
        stock: 1,
        stockMinimo: 4,
        categoria: 'Periféricos',
        marca: 'Logitech',
        urlImagen: 'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=500',
        estado: true,
        fechaCreacion: '2026-03-01',
      },
      {
        productoId: 5,
        sku: 'GAM-ASUS-ROG',
        nombre: 'Monitor Gaming ASUS ROG Swift 27" 240Hz',
        descripcion: 'Panel OLED QHD, tiempo de respuesta 0.03ms, G-SYNC compatible',
        precio: 899.00,
        stock: 5,
        stockMinimo: 2,
        categoria: 'Gaming',
        marca: 'ASUS',
        urlImagen: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=500',
        estado: true,
        fechaCreacion: '2026-03-05',
      },
    ];
  }

  private getDefaultSuppliers(): AdminSupplier[] {
    return [
      {
        proveedorId: 1,
        identificacion: '1790012345001',
        nombre: 'Mayorista TechCorp Ecuador S.A.',
        contacto: 'Carlos Mendoza',
        telefono: '022987654',
        correo: 'ventas@techcorp.ec',
        direccion: 'Av. Amazonas N34-12 y República, Quito',
        estado: true,
      },
      {
        proveedorId: 2,
        identificacion: '0991234567001',
        nombre: 'Importadora Global Digital Cía. Ltda.',
        contacto: 'Patricia Andrade',
        telefono: '042567890',
        correo: 'pedidos@globaldigital.ec',
        direccion: 'Km 1.5 Vía a Samborondón, Guayaquil',
        estado: true,
      },
      {
        proveedorId: 3,
        identificacion: '1792345678001',
        nombre: 'Distribuciones Informáticas del Austro',
        contacto: 'Esteban Morales',
        telefono: '072834567',
        correo: 'contacto@distri-austro.com',
        direccion: 'Av. Solano y Doce de Abril, Cuenca',
        estado: true,
      },
    ];
  }

  private getDefaultClients(): AdminClient[] {
    return [
      {
        clienteId: 1,
        personaId: 10,
        identificacion: '1723456789',
        nombres: 'Santiago',
        apellidos: 'López Pérez',
        correo: 'santiago.lopez@gmail.com',
        telefono: '0987654321',
        direccion: 'Av. 6 de Diciembre y Eloy Alfaro',
        estado: true,
        fechaRegistro: '2026-02-14',
        totalCompras: 2549.98,
      },
      {
        clienteId: 2,
        personaId: 11,
        identificacion: '0912345678',
        nombres: 'Mariana',
        apellidos: 'Viteri Gómez',
        correo: 'mariana.viteri@outlook.com',
        telefono: '0991122334',
        direccion: 'Urdesa Central, Calle 3ra 402',
        estado: true,
        fechaRegistro: '2026-02-28',
        totalCompras: 449.98,
      },
      {
        clienteId: 3,
        personaId: 12,
        identificacion: '1719876543',
        nombres: 'Gabriel',
        apellidos: 'Navarrete Silva',
        correo: 'gabriel.nav@yahoo.com',
        telefono: '0984455667',
        direccion: 'Cumbayá, Pasaje San Antonio',
        estado: true,
        fechaRegistro: '2026-03-02',
        totalCompras: 899.00,
      },
    ];
  }

  private getDefaultPromotions(): AdminPromotion[] {
    return [
      {
        promocionId: 1,
        nombre: 'Descuento Black Cyber en Audio',
        descripcion: '15% de descuento en todos los audífonos y sistemas de sonido',
        tipo: 'Porcentaje',
        valor: 15,
        fechaInicio: '2026-10-01',
        fechaFin: '2026-10-31',
        prioridad: 1,
        estado: true,
        aplicaA: 'Categoria',
        referenciaNombre: 'Audio',
      },
      {
        promocionId: 2,
        nombre: 'Bono Especial Primera Compra',
        descripcion: 'Rebaja fija de $20 en compras superiores a $150',
        tipo: 'Monto Fijo',
        valor: 20,
        montoMinimo: 150,
        fechaInicio: '2026-10-10',
        fechaFin: '2026-11-15',
        prioridad: 2,
        estado: true,
        aplicaA: 'General',
      },
      {
        promocionId: 3,
        nombre: 'Super Oferta MacBook Pro',
        descripcion: '$100 de descuento directo en MacBook Pro M3',
        tipo: 'Monto Fijo',
        valor: 100,
        fechaInicio: '2026-10-05',
        fechaFin: '2026-10-25',
        prioridad: 1,
        estado: true,
        aplicaA: 'Producto',
        referenciaNombre: 'MacBook Pro 14" M3 Pro',
      },
    ];
  }

  private getDefaultMovements(): InventoryMovement[] {
    return [
      {
        movimientoId: 1,
        productoId: 1,
        productoNombre: 'MacBook Pro 14" M3 Pro',
        tipoMovimiento: 'Entrada',
        cantidad: 10,
        usuarioResponsable: 'admin@tecnomega.com',
        proveedor: 'Mayorista TechCorp Ecuador S.A.',
        motivo: 'Compra según Factura #8920',
        fecha: '2026-10-01 10:30',
        stockResultante: 10,
      },
      {
        movimientoId: 2,
        productoId: 1,
        productoNombre: 'MacBook Pro 14" M3 Pro',
        tipoMovimiento: 'Salida',
        cantidad: 2,
        usuarioResponsable: 'Sistema Facturación',
        motivo: 'Venta Factura #FAC-000001',
        fecha: '2026-10-12 15:45',
        stockResultante: 8,
      },
      {
        movimientoId: 3,
        productoId: 3,
        productoNombre: 'Sony WH-1000XM5 Noise Cancelling',
        tipoMovimiento: 'Salida',
        cantidad: 3,
        usuarioResponsable: 'Sistema Facturación',
        motivo: 'Venta Factura #FAC-000002',
        fecha: '2026-10-15 11:20',
        stockResultante: 2,
      },
      {
        movimientoId: 4,
        productoId: 4,
        productoNombre: 'Logitech MX Master 3S',
        tipoMovimiento: 'Ajuste',
        cantidad: 1,
        usuarioResponsable: 'admin@tecnomega.com',
        motivo: 'Ajuste físico por auditoría de bodega',
        observacion: 'Diferencia en conteo físico trimestral',
        fecha: '2026-10-16 09:00',
        stockResultante: 1,
      },
    ];
  }

  private getDefaultInvoices(): AdminInvoice[] {
    return [
      {
        facturaId: 1,
        numero: 'FAC-000001',
        clienteNombre: 'Santiago López Pérez',
        clienteIdentificacion: '1723456789',
        fecha: '2026-10-12 15:45',
        subtotal: 2199.99,
        descuento: 100.00,
        impuesto: 314.99,
        total: 2414.98,
        estado: 'Pagada',
        detalles: [
          {
            detalleId: 1,
            productoId: 1,
            productoNombre: 'MacBook Pro 14" M3 Pro',
            cantidad: 1,
            precioUnitario: 2199.99,
            descuentoPorcentual: 4.54,
            descuentoValor: 100.00,
            subtotal: 2099.99,
            total: 2414.98,
          },
        ],
      },
      {
        facturaId: 2,
        numero: 'FAC-000002',
        clienteNombre: 'Mariana Viteri Gómez',
        clienteIdentificacion: '0912345678',
        fecha: '2026-10-15 11:20',
        subtotal: 349.99,
        descuento: 52.50,
        impuesto: 44.62,
        total: 342.11,
        estado: 'Pagada',
        detalles: [
          {
            detalleId: 2,
            productoId: 3,
            productoNombre: 'Sony WH-1000XM5 Noise Cancelling',
            cantidad: 1,
            precioUnitario: 349.99,
            descuentoPorcentual: 15.00,
            descuentoValor: 52.50,
            subtotal: 297.49,
            total: 342.11,
          },
        ],
      },
    ];
  }

  private getDefaultOrders(): AdminOrder[] {
    return [
      {
        pedidoId: 101,
        numero: 'PED-000101',
        clienteNombre: 'Santiago López Pérez',
        clienteIdentificacion: '1723456789',
        clienteEmail: 'santiago.lopez@gmail.com',
        fecha: '2026-10-17 11:30',
        direccion: 'Av. 6 de Diciembre y Eloy Alfaro, Quito',
        subtotal: 2199.99,
        descuento: 100.00,
        total: 2414.98,
        estado: 'Pendiente',
        items: [
          {
            productoNombre: 'MacBook Pro 14" M3 Pro',
            cantidad: 1,
            precioUnitario: 2199.99,
            total: 2199.99,
          },
        ],
      },
      {
        pedidoId: 102,
        numero: 'PED-000102',
        clienteNombre: 'Mariana Viteri Gómez',
        clienteIdentificacion: '0912345678',
        clienteEmail: 'mariana.viteri@outlook.com',
        fecha: '2026-10-17 14:15',
        direccion: 'Urdesa Central, Calle 3ra 402, Guayaquil',
        subtotal: 349.99,
        descuento: 52.50,
        total: 342.11,
        estado: 'Procesando',
        items: [
          {
            productoNombre: 'Sony WH-1000XM5 Noise Cancelling',
            cantidad: 1,
            precioUnitario: 349.99,
            total: 349.99,
          },
        ],
      },
      {
        pedidoId: 103,
        numero: 'PED-000103',
        clienteNombre: 'Gabriel Navarrete Silva',
        clienteIdentificacion: '1719876543',
        clienteEmail: 'gabriel.nav@yahoo.com',
        fecha: '2026-10-16 16:40',
        direccion: 'Cumbayá, Pasaje San Antonio, Quito',
        subtotal: 899.00,
        descuento: 0,
        total: 1033.85,
        estado: 'Enviado',
        items: [
          {
            productoNombre: 'Monitor Gaming ASUS ROG Swift 27"',
            cantidad: 1,
            precioUnitario: 899.00,
            total: 899.00,
          },
        ],
      },
    ];
  }
}

