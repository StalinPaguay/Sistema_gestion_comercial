# ============================================================
# TECNOMEGA - API PRINCIPAL (FASTAPI)
# ============================================================

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError

from routes.auth_routes import router as auth_router
from routes.carrito_routes import router as carrito_router
from routes.catalogo_routes import router as catalogo_router
from routes.cliente_routes import router as cliente_router
from routes.database_routes import router as database_router
from routes.factura_routes import router as factura_router
from routes.interaccion_routes import router as interaccion_router
from routes.inventario_routes import router as inventario_router
from routes.pedido_routes import router as pedido_router
from routes.parametro_routes import router as parametro_router
from routes.promocion_routes import router as promocion_router
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


# ============================================================
# MANEJADORES GLOBALES DE EXCEPCIONES Y RESPUESTAS ESTÁNDAR
# ============================================================

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Estandariza respuestas HTTP controladas preservando 'detail' para compatibilidad frontend."""
    mensaje = exc.detail if isinstance(exc.detail, str) else "Error en la petición."
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": True,
            "status_code": exc.status_code,
            "mensaje": mensaje,
            "detail": exc.detail,
        },
        headers=getattr(exc, "headers", None),
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Captura errores de validación de esquemas Pydantic y formatea una respuesta limpia."""
    errores = exc.errors()
    detalles = [
        f"{'.'.join(str(loc) for loc in err.get('loc', []))}: {err.get('msg', '')}"
        for err in errores
    ]
    mensaje_resumen = "; ".join(detalles) if detalles else "Parámetros de entrada no válidos."
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "error": True,
            "status_code": status.HTTP_422_UNPROCESSABLE_ENTITY,
            "mensaje": mensaje_resumen,
            "detail": mensaje_resumen,
            "errores": errores,
        },
    )


@app.exception_handler(SQLAlchemyError)
async def sqlalchemy_exception_handler(request: Request, exc: SQLAlchemyError):
    """Captura excepciones de base de datos protegiendo datos sensibles internos."""
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": True,
            "status_code": status.HTTP_500_INTERNAL_SERVER_ERROR,
            "mensaje": "Error en la base de datos al procesar la operación.",
            "detail": "Error en la base de datos al procesar la operación.",
        },
    )


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    """Manejador general para excepciones imprevistas no capturadas."""
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": True,
            "status_code": status.HTTP_500_INTERNAL_SERVER_ERROR,
            "mensaje": "Error interno del servidor. Por favor, intente más tarde.",
            "detail": "Error interno del servidor. Por favor, intente más tarde.",
        },
    )


# Registro de routers por módulo
app.include_router(database_router)
app.include_router(auth_router)
app.include_router(catalogo_router)
app.include_router(cliente_router)
app.include_router(carrito_router)
app.include_router(pedido_router)
app.include_router(parametro_router)
app.include_router(factura_router)
app.include_router(inventario_router)
app.include_router(proveedor_router)
app.include_router(promocion_router)
app.include_router(interaccion_router)


@app.get("/", tags=["Salud"])
def root():
    return {
        "sistema": "Sistema de Gestión Comercial TECNOMEGA",
        "version": "1.0.0",
        "estado": "Operativo",
        "docs": "/docs",
    }
