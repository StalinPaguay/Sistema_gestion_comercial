# ============================================================
# RUTAS DE PRUEBA DE BASE DE DATOS
# ============================================================

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from config.database import get_db
from controllers.database_controller import verificar_base_datos


# ============================================================
# CREACIÓN DEL ROUTER
# ============================================================

router = APIRouter()


# ============================================================
# RUTA PARA VERIFICAR LA BASE DE DATOS
# ============================================================

@router.get("/database")
def database(db: Session = Depends(get_db)):
    # Envía la sesión al controlador
    return verificar_base_datos(db)