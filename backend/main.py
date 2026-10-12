# ============================================================
# TECNOMEGA - API PRINCIPAL (FASTAPI)
# ============================================================

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routes.auth_routes import router as auth_router
from routes.carrito_routes import router as carrito_router
from routes.catalogo_routes import router as catalogo_router
from routes.cliente_routes import router as cliente_router
from routes.database_routes import router as database_router
from routes.factura_routes import router as factura_router
from routes.inventario_routes import router as inventario_router
from routes.pedido_routes import router as pedido_router
from routes.proveedor_routes import router as proveedor_router

app = FastAPI(
    title="TECNOMEGA API",
    description="API REST del Sistema de Gestión Comercial TECNOMEGA",
    version="1.0.0",
)

# Configuración de CORS para permitir consumo desde el Frontend (Angular / HTTP)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Registro de routers por módulo
app.include_router(database_router)
app.include_router(auth_router)
app.include_router(catalogo_router)
app.include_router(cliente_router)
app.include_router(carrito_router)
app.include_router(pedido_router)
app.include_router(factura_router)
app.include_router(inventario_router)
app.include_router(proveedor_router)


@app.get("/", tags=["Salud"])
def root():
    return {
        "sistema": "Sistema de Gestión Comercial TECNOMEGA",
        "version": "1.0.0",
        "estado": "Operativo",
        "docs": "/docs",
    }
