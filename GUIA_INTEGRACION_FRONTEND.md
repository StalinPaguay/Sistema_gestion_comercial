# 📘 MANUAL DE INTEGRACIÓN DEL BACKEND PARA FRONTEND
### Sistema de Gestión Comercial TECNOMEGA
**Versión:** 1.0.0 | **Branch:** `develop` | **Fecha:** Octubre 2026

---

## 🎯 1. Resumen y Propósito

Este documento proporciona toda la información técnica, comandos y especificaciones necesarias para que el desarrollador de Frontend pueda integrar y consumir el Backend de TECNOMEGA de manera autónoma, rápida y sin fricciones.

El backend está desarrollado en **FastAPI (Python 3.14)** con **SQLAlchemy 2.0** y **SQL Server 2022**. Cuenta con autenticación por **JWT**, arquitectura RESTful y documentación interactiva autogenerada en **Swagger UI / OpenAPI**.

---

## 🚀 2. Puesta en Marcha del Entorno (Paso a Paso)

### 2.1. Requisitos Previos
- **Git** instalado.
- **Docker** y **Docker Compose** instalados y ejecutándose.
- **Node.js** (v20 o superior) y **npm** (para ejecutar Angular en desarrollo local si no se usa el contenedor de frontend).

---

### 2.2. Clonación y Selección de Rama
```bash
# 1. Clonar el repositorio
git clone https://github.com/StalinPaguay/Sistema_gestion_comercial.git

# 2. Entrar a la carpeta del proyecto
cd Sistema_gestion_comercial

# 3. Cambiar a la rama de desarrollo
git checkout develop
git pull origin develop
```

---

### 2.3. Variables de Entorno
Crea un archivo `.env` en la raíz del proyecto copiando la plantilla:
```bash
cp .env.example .env
```

Contenido verificado para desarrollo local:
```env
MSSQL_SA_PASSWORD=S3guro!2025
MSSQL_DATABASE=TECNOMEGA
MSSQL_PID=Developer

BACKEND_PORT=8000
FRONTEND_PORT=4200
```

---

### 2.4. Iniciar los Servicios con Docker
Para levantar toda la infraestructura (Base de Datos SQL Server, Backend FastAPI y Frontend Angular):
```bash
docker compose up -d
```

Verificar que los contenedores estén activos:
```bash
docker compose ps
```
Deberías ver 3 servicios saludables:
- `tecnomega_database` en puerto `1433`.
- `tecnomega_backend` en puerto `8000`.
- `tecnomega_frontend` en puerto `4200`.

---

### 2.5. Restauración o Carga Inicial de la Base de Datos
Si es la primera vez que levantas la base de datos y la instancia está vacía, ejecuta el script de esquema y datos iniciales:
```bash
docker exec -i tecnomega_database /opt/mssql-tools18/bin/sqlcmd \
  -S localhost -U sa -P 'S3guro!2025' -C -d master -I \
  -i /var/opt/mssql/scripts/01_create_database.sql

docker exec -i tecnomega_database /opt/mssql-tools18/bin/sqlcmd \
  -S localhost -U sa -P 'S3guro!2025' -C -d TECNOMEGA -I \
  -i /var/opt/mssql/scripts/02_schema_and_data.sql
```
*(Nota: El flag `-I` asegura que los triggers con índices filtrados se compilen con `QUOTED_IDENTIFIER ON`).*

---

### 2.6. Verificación de Conectividad
- **Salud del Backend:**
  Visita: `http://localhost:8000/`
  Respuesta esperada: `{"sistema":"Sistema de Gestión Comercial TECNOMEGA","version":"1.0.0","estado":"Operativo","docs":"/docs"}`
- **Documentación Interactiva Swagger UI:**
  Visita: `http://localhost:8000/docs`
  *(Aquí puedes probar interactivamente cada endpoint y ver sus esquemas JSON).*
- **Verificación de conexión a Base de Datos:**
  `http://localhost:8000/database`

---

## 🔐 3. Autenticación y Autorización (JWT)

El backend utiliza tokens de acceso **JWT (Bearer Tokens)** con expiración de 24 horas.

### 3.1. Flujo de Autenticación
1. El usuario envía sus credenciales a `POST /auth/login`.
2. El backend responde con `{ "access_token": "...", "token_type": "bearer", "usuario": { ... } }`.
3. El frontend almacena el token (ej: en `localStorage` o `sessionStorage`).
4. Para todas las peticiones protegidas, el frontend debe enviar la cabecera HTTP:
   ```http
   Authorization: Bearer <access_token>
   ```

### 3.2. Roles del Sistema
- **Administrador:** Acceso a CRUD completo del catálogo (crear/editar productos, marcas, categorías), proveedores, inventario y emisión de facturas/pagos.
- **Cliente:** Acceso a perfil propio, gestión de sus direcciones, carrito de compras, emisión de pedidos, consulta de sus compras, favoritos y creación de reseñas.

### 3.3. Cuentas de Prueba Pre-configuradas
| Rol | Email | Contraseña |
| :--- | :--- | :--- |
| **Administrador** | `admin@tecnomega.com` | `Admin123!` |
| **Vendedor** | `vendedor@tecnomega.com` | `S3guro!2025` |
| **Cliente** | Registro libre vía `POST /auth/register` | Cualquiera definida |

---

## 📡 4. Catálogo Detallado de Endpoints por Módulo

### 4.1. Módulo: Autenticación (`/auth`)

#### `POST /auth/login`
- **Público**: Sí
- **Body**:
  ```json
  {
    "Email": "admin@tecnomega.com",
    "Password": "Admin123!"
  }
  ```
- **Respuesta `200 OK`**:
  ```json
  {
    "access_token": "eyJhbGciOi...",
    "token_type": "bearer",
    "usuario": {
      "UsuarioId": 1,
      "PersonaId": 1,
      "Nombres": "Administrador",
      "Apellidos": "Sistema",
      "Email": "admin@tecnomega.com",
      "Rol": "Administrador"
    }
  }
  ```

#### `POST /auth/register`
- **Público**: Sí (crea Persona, Usuario con hash seguro y registro en Cliente).
- **Body**:
  ```json
  {
    "Nombres": "Carlos",
    "Apellidos": "Mendoza",
    "Email": "carlos.mendoza@email.com",
    "Password": "MiPasswordSeguro123!",
    "Telefono": "0991234567",
    "Identificacion": "1712345678"
  }
  ```
- **Respuesta `201 Created`**: Devuelve directamente el `access_token` y el objeto `usuario` para loguear inmediatamente al cliente.

#### `GET /auth/me`
- **Protegido**: Sí (Cualquier usuario autenticado).
- **Respuesta `200 OK`**: Devuelve los datos del perfil actual.

#### `PATCH /auth/cambiar-password` (o `POST /auth/cambiar-password`)
- **Protegido**: Sí (`Authorization: Bearer <token>`).
- **Body**: (Acepta camelCase o PascalCase)
  ```json
  {
    "currentPassword": "MiPasswordActual123!",
    "newPassword": "MiNuevaPasswordSegura456!"
  }
  ```
- **Respuesta `200 OK`**:
  ```json
  {
    "message": "Contraseña actualizada exitosamente."
  }
  ```
- **Posibles errores**:
  - `400 Bad Request`: Si la contraseña actual es errónea o si la nueva es idéntica a la actual.
  - `401 Unauthorized`: Si falta el token de autorización o expiró.

---

### 4.2. Módulo: Catálogo Comercial (`/productos`, `/categorias`, `/marcas`)

#### `GET /productos`
- **Público**: Sí.
- **Query Params**:
  - `limite` (int, default: 20)
  - `desde` (int, default: 0)
  - `categoria_id` (int, opcional)
  - `marca_id` (int, opcional)
  - `busqueda` (string, opcional, busca en Nombre o SKU)
  - `incluir_inactivos` (bool, default: false)
- **Respuesta `200 OK`**:
  ```json
  {
    "total": 50,
    "limite": 20,
    "desde": 0,
    "productos": [
      {
        "ProductoId": 1,
        "SKU": "LAP-DELL-001",
        "Nombre": "Laptop Dell XPS 15",
        "Descripcion": "Intel Core i7, 16GB RAM, 512GB SSD",
        "Precio": "1499.99",
        "Stock": 15,
        "StockMinimo": 5,
        "Estado": true,
        "Categoria": { "CategoriaId": 1, "Nombre": "Laptops" },
        "Marca": { "MarcaId": 1, "Nombre": "Dell" }
      }
    ]
  }
  ```

#### `GET /productos/{producto_id}`
- **Público**: Sí.

#### `POST /productos` | `PATCH /productos/{id}` | `DELETE /productos/{id}`
- **Protegido**: Sí (**Requiere rol Administrador**).
- *Nota:* El borrado es lógico (`Estado = False`).

#### `GET /categorias` y `GET /marcas`
- **Público**: Sí. Devuelve listas de categorías y marcas activas con sus contadores.

---

### 4.3. Módulo: Clientes y Direcciones (`/clientes`)

#### `GET /clientes/me/direcciones`
- **Protegido**: Sí (Cliente autenticado).
- **Respuesta `200 OK`**: Lista de direcciones del usuario conectado.

#### `POST /clientes/me/direcciones`
- **Protegido**: Sí (Cliente autenticado).
- **Body**:
  ```json
  {
    "Provincia": "Pichincha",
    "Ciudad": "Quito",
    "Direccion": "Av. República y Eloy Alfaro",
    "Referencia": "Edificio Titanium, Piso 4",
    "CodigoPostal": "170501",
    "EsPrincipal": true
  }
  ```
- **Respuesta `201 Created`**: Retorna el objeto `DireccionCliente` con su `DireccionId`.

#### `PATCH /clientes/direcciones/{direccion_id}` | `DELETE /clientes/direcciones/{direccion_id}`
- **Protegido**: Sí. Actualización o desactivación de una dirección específica.

---

### 4.4. Módulo: Carrito de Compras (`/carrito`)

Cada cliente tiene un carrito persistente en base de datos vinculado a su cuenta.

#### `GET /carrito`
- **Protegido**: Sí.
- **Respuesta `200 OK`**:
  ```json
  {
    "CarritoId": 4,
    "ClienteId": 2,
    "FechaActualizacion": "2026-10-11T22:15:00",
    "TotalItems": 3,
    "Subtotal": "2999.97",
    "Items": [
      {
        "DetalleCarritoId": 12,
        "ProductoId": 1,
        "Nombre": "Laptop Dell XPS 15",
        "SKU": "LAP-DELL-001",
        "Precio": "999.99",
        "Cantidad": 3,
        "StockDisponible": 15,
        "Subtotal": "2999.97"
      }
    ]
  }
  ```

#### `POST /carrito/items`
- **Protegido**: Sí.
- **Body**:
  ```json
  {
    "ProductoId": 1,
    "Cantidad": 1
  }
  ```
- **Respuesta `201 Created`**: Carrito actualizado.

#### `PATCH /carrito/items/{detalle_carrito_id}`
- **Protegido**: Sí.
- **Body**: `{ "Cantidad": 2 }`
- **Respuesta `200 OK`**: Carrito recalculado.

#### `DELETE /carrito/items/{detalle_carrito_id}`
- **Protegido**: Sí. Elimina una línea individual.

#### `DELETE /carrito`
- **Protegido**: Sí. Vacía todos los productos del carrito.

---

### 4.5. Módulo: Promociones y Cupones (`/promociones`)

#### `POST /promociones/validar-cupon`
- **Público**: Sí (usado en el Checkout del frontend).
- **Body**:
  ```json
  {
    "CodigoCupon": "PROMO10",
    "Subtotal": 150.00
  }
  ```
- **Respuesta `200 OK`**:
  ```json
  {
    "valido": true,
    "promocion_id": 1,
    "nombre": "Descuento 10% Especial",
    "codigo_cupon": "PROMO10",
    "tipo_descuento": "PORCENTAJE",
    "valor_descuento": "10.00",
    "monto_descuento": "15.00",
    "subtotal_original": "150.00",
    "subtotal_con_descuento": "135.00"
  }
  ```
- **Posibles errores**:
  - `404 Not Found`: Cupón no existe o está inactivo.
  - `400 Bad Request`: Cupón expirado o subtotal menor al `MontoMinimoCompra`.

#### `GET /promociones`
- **Público**: Sí. Lista promociones vigentes para mostrar banners o alertas en la tienda.

---

### 4.6. Módulo: Pedidos / Ventas (`/pedidos`)

#### `POST /pedidos` (Crear Pedido / Checkout)
- **Protegido**: Sí.
- Puede crearse de dos formas:
  1. **Directo desde el Carrito de compras actual:**
     ```json
     {
       "DireccionId": 1,
       "CodigoCupon": "PROMO10"
     }
     ```
  2. **Enviando items explícitos:**
     ```json
     {
       "DireccionId": 1,
       "CodigoCupon": "PROMO10",
       "Items": [
         { "ProductoId": 1, "Cantidad": 2 }
       ]
     }
     ```
- **Respuesta `201 Created`**:
  ```json
  {
    "PedidoId": 10,
    "NumeroPedido": "PED-000010",
    "FechaPedido": "2026-10-11T22:20:00",
    "Estado": "Pendiente",
    "Subtotal": "200.00",
    "Descuento": "20.00",
    "IVA": "21.60",
    "Total": "201.60",
    "Items": [ ... ]
  }
  ```

#### `GET /pedidos` y `GET /pedidos/{id}`
- **Protegido**: Sí. Los clientes solo ven sus propios pedidos; administradores pueden ver todos o filtrar por cliente.

---

### 4.7. Módulo: Facturación y Pagos (`/facturas`, `/pagos`, `/metodos-pago`)

#### `GET /metodos-pago`
- **Público**: Sí. Devuelve métodos activos (`Efectivo`, `Transferencia Bancaria`, `Tarjeta de Crédito`, etc.).

#### `POST /facturas` (Emitir Factura a partir de Pedido)
- **Protegido**: Sí.
- **Body**:
  ```json
  {
    "PedidoId": 10
  }
  ```
- **Respuesta `201 Created`**:
  Genera la factura con numeración correlativa oficial: `FAC-2026-000010`.

#### `POST /pagos` (Registrar Pago)
- **Protegido**: Sí.
- **Body**:
  ```json
  {
    "PedidoId": 10,
    "MetodoPagoId": 1,
    "Monto": 201.60,
    "TransaccionId": "TRX-ABC12345"
  }
  ```
- **Respuesta `201 Created`**:
  - Registra el pago en estado `Pagado`.
  - Si el pago cubre el valor total, **actualiza la Factura a `Pagada`** y el Pedido a `Procesando`.
  - El trigger en base de datos descuenta el stock de los productos automáticamente.

---

### 4.8. Módulo: Wishlist y Reseñas (`/favoritos`, `/productos/{id}/resenas`)

#### `GET /favoritos` | `POST /favoritos/{producto_id}` | `DELETE /favoritos/{producto_id}`
- **Protegido**: Sí (Cliente autenticado).
- Gestiona la lista de deseos personal.

#### `GET /productos/{producto_id}/resenas`
- **Público**: Sí.
- Retorna las opiniones y la calificación promedio (`CalificacionPromedio` de 1 a 5 estrellas).

#### `POST /productos/{producto_id}/resenas`
- **Protegido**: Sí (Cliente autenticado).
- **Body**: `{ "Calificacion": 5, "Comentario": "Excelente calidad." }`

---

## 💡 5. Buenas Prácticas y Recomendaciones para Angular

### 5.1. HttpInterceptor para el JWT Token
En Angular standalone o modular, implementa un interceptor que agregue automáticamente el token Bearer:
```typescript
// auth.interceptor.ts
import { HttpInterceptorFn } from '@angular/common/http';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    const cloned = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
    return next(cloned);
  }
  return next(req);
};
```

### 5.2. Manejo de Errores
El backend siempre responde con formato JSON de error estándar en caso de fallo:
```json
{
  "detail": "Mensaje legible del error para mostrar al usuario"
}
```
En Angular, se puede capturar con `error.error.detail` en los bloques `catchError` o toasts/snackbars.

---

## 📋 6. Resumen de Puertos y Accesos Locales

| Servicio | URL / Host | Puerto | Credenciales por Defecto |
| :--- | :--- | :--- | :--- |
| **API REST** | `http://localhost:8000` | `8000` | N/A |
| **Documentación Swagger** | `http://localhost:8000/docs` | `8000` | N/A |
| **Frontend App** | `http://localhost:4200` | `4200` | N/A |
| **SQL Server** | `localhost` | `1433` | `sa` / `S3guro!2025` (DB: `TECNOMEGA`) |
| **Admin de Pruebas** | `POST /auth/login` | `8000` | `admin@tecnomega.com` / `Admin123!` |

---
**El backend está 100% testeado, operativo y listo para el desarrollo del frontend.**
