# Backend — Sistema de Gestión Comercial TECNOMEGA

## 1. Descripción del proyecto

Backend integral desarrollado con **Python, FastAPI, SQLAlchemy y Microsoft SQL Server** para el sistema de gestión comercial TECNOMEGA.

Provee una API REST completa y robusta con autenticación JWT, gestión de catálogo, clientes, carrito de compras, pedidos, facturación, métodos de pago, inventario y proveedores.

## 2. Tecnologías y Librerías

- **Python 3.14** (Entorno Dockerizado).
- **FastAPI**: Framework web moderno, asíncrono y de alto rendimiento.
- **SQLAlchemy 2.1**: ORM para mapeo objeto-relacional y manejo de transacciones.
- **pyodbc & Microsoft ODBC Driver 18**: Conector nativo de alto rendimiento para SQL Server.
- **PyJWT & Bcrypt**: Autenticación segura mediante tokens JWT y cifrado de contraseñas con salado.
- **Pytest & HTTPX**: Suite de pruebas automatizadas de integración.
- **SQL Server 2022**: Motor de base de datos relacional con triggers de integridad, inventario y auditoría.
- **Docker y Docker Compose**: Orquestación de contenedores y entorno reproducible.

## 3. Estructura del backend

```text
backend/
├── config/
│   └── database.py          # Conexión SQLAlchemy, pool y sesiones de BD
├── controllers/
│   └── database_controller.py
├── models/                  # 25 modelos ORM mapeados al esquema de SQL Server
│   ├── persona.py
│   ├── usuario.py
│   ├── cliente.py
│   ├── producto.py
│   ├── categoria.py
│   ├── marca.py
│   ├── carrito.py
│   ├── carrito_detalle.py
│   ├── pedido.py
│   ├── pedido_detalle.py
│   ├── factura.py
│   ├── detalle_factura.py
│   ├── pago.py
│   ├── metodo_pago.py
│   ├── inventario...
│   └── ...
├── routes/                  # Endpoints REST organizados por módulo
│   ├── auth_routes.py       # Login, registro y perfil JWT (/auth)
│   ├── catalogo_routes.py   # Productos, categorías y marcas
│   ├── cliente_routes.py    # Gestión de clientes y direcciones (/clientes)
│   ├── carrito_routes.py    # Carrito de compras y sus items (/carrito)
│   ├── pedido_routes.py     # Creación, consulta y estados de pedidos (/pedidos)
│   ├── factura_routes.py    # Emisión de facturas y pagos (/facturas, /pagos)
│   ├── inventario_routes.py # Movimientos de stock y stock bajo (/inventario)
│   ├── proveedor_routes.py  # Proveedores (/proveedores)
│   └── database_routes.py   # Health check de BD (/database)
├── services/
│   └── auth_service.py      # Lógica de seguridad, JWT y hashing bcrypt
├── tests/
│   └── test_api.py          # Pruebas automatizadas de integración
├── Dockerfile
├── main.py                  # Aplicación FastAPI, CORS y routers
└── requirements.txt
```

## 4. Requisitos previos e Inicio Rápido

1. Crear el archivo `.env` en la raíz del repositorio basándose en `.env.example`:
   ```dotenv
   MSSQL_SA_PASSWORD=S3guro!2025
   MSSQL_DATABASE=TECNOMEGA
   MSSQL_PID=Developer
   BACKEND_PORT=8000
   FRONTEND_PORT=4200
   ```
2. Iniciar los servicios con Docker Compose:
   ```bash
   docker compose up -d
   ```
3. Inicializar la base de datos (si es la primera vez que se monta el volumen):
   ```bash
   docker exec -i tecnomega_database /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P "S3guro!2025" -C -I < database/scripts/02_schema_and_data.sql
   ```

## 5. Documentación Interactiva

- **Swagger UI (Pruebas interactivas):** [http://localhost:8000/docs](http://localhost:8000/docs)
- **OpenAPI Schema:** [http://localhost:8000/openapi.json](http://localhost:8000/openapi.json)

## 6. Endpoints de la API

### Autenticación y Perfil (`/auth`)
| Método | Ruta | Descripción |
|---|---|---|
| POST | `/auth/login` | Inicia sesión con Email y Password, devuelve JWT |
| POST | `/auth/register` | Registra nueva persona, usuario y cliente |
| GET | `/auth/me` | Obtiene el perfil del usuario autenticado (Bearer Token) |

### Catálogo Comercial
| Método | Ruta | Descripción |
|---|---|---|
| GET / POST | `/productos` | Listado paginado y creación de productos |
| GET / PATCH / DELETE | `/productos/{id}` | Detalle, edición parcial y baja lógica |
| GET / POST | `/categorias` | Listado y creación de categorías |
| GET / PATCH / DELETE | `/categorias/{id}` | Detalle, edición y baja lógica |
| GET / POST | `/marcas` | Listado y creación de marcas |
| GET / PATCH / DELETE | `/marcas/{id}` | Detalle, edición y baja lógica |

### Clientes y Direcciones (`/clientes`)
| Método | Ruta | Descripción |
|---|---|---|
| GET / POST | `/clientes` | Listado paginado y creación de clientes |
| GET / PATCH | `/clientes/{id}` | Detalle y actualización de cliente |
| GET / POST | `/clientes/{id}/direcciones` | Listar y agregar direcciones a un cliente |
| PATCH / DELETE | `/clientes/direcciones/{dir_id}` | Actualizar o desactivar dirección |

### Carrito de Compras (`/carrito`)
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/carrito` | Consulta el carrito activo del usuario con totales |
| POST | `/carrito/items` | Agrega un producto al carrito (valida stock) |
| PATCH | `/carrito/items/{id}` | Modifica la cantidad de un item |
| DELETE | `/carrito/items/{id}` | Quita un item del carrito |
| DELETE | `/carrito` | Vacía el carrito |

### Pedidos (`/pedidos`)
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/pedidos` | Listar pedidos (filtrable por cliente y estado) |
| GET | `/pedidos/{id}` | Detalle completo de pedido con sus items |
| POST | `/pedidos` | Crea pedido desde el carrito o items explícitos |
| PATCH | `/pedidos/{id}/estado` | Actualiza estado (`Pendiente`, `Procesando`, etc.) |

### Facturación y Pagos
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/facturas` | Listado de facturas |
| GET | `/facturas/{id}` | Detalle de factura con desglose de items y totales |
| POST | `/facturas` | Emite factura formal a partir de un pedido |
| PATCH | `/facturas/{id}/anular` | Anula una factura emitida |
| GET | `/metodos-pago` | Consulta formas de pago activas |
| POST | `/pagos` | Registra el pago de un pedido |
| GET | `/pagos/pedido/{id}` | Consulta pagos asociados a un pedido |

### Inventario y Proveedores
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/inventario/tipos-movimiento` | Tipos (Entrada, Salida, Ajuste) |
| GET / POST | `/inventario/movimientos` | Historial y registro de movimiento de stock |
| GET | `/inventario/stock-bajo` | Alertas de productos bajo el stock mínimo |
| GET / POST | `/proveedores` | Listado y registro de proveedores |
| GET / PATCH / DELETE | `/proveedores/{id}` | Detalle, actualización y baja lógica |

## 7. Ejecución de Pruebas Automatizadas

Para ejecutar la suite de pruebas unitarias y de integración dentro del contenedor:

```bash
docker exec tecnomega_backend python -m pytest tests/test_api.py -v
```