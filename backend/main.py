# ============================================================
# CONFIGURACIÓN PRINCIPAL DE FASTAPI
# ============================================================

from fastapi import FastAPI

from routes.database_routes import router as database_router


# ============================================================
# CREACIÓN DE LA APLICACIÓN
# ============================================================

app = FastAPI(title="TECNOMEGA API")


# ============================================================
# REGISTRO DE RUTAS
# ============================================================

app.include_router(database_router)


# ============================================================
# RUTA PRINCIPAL
# ============================================================

@app.get("/")
def root():
    # Retorna un mensaje para comprobar que la API funciona
    return {"message": "API TECNOMEGA funcionando"}