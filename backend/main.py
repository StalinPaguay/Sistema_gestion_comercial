
from fastapi import FastAPI

from routes.database_routes import router as database_router
from routes.catalogo_routes import router as catalogo_router

app = FastAPI(
    title="TECNOMEGA API",
    description="API de gestión comercial TECNOMEGA",
    version="1.0.0",
)

app.include_router(database_router)
app.include_router(catalogo_router)


@app.get("/")
def root():
    return {"message": "API TECNOMEGA funcionando"}
