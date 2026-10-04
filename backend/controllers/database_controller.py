# ============================================================
# CONTROLADOR DE PRUEBA DE BASE DE DATOS
# ============================================================

from sqlalchemy import text
from sqlalchemy.orm import Session


# ============================================================
# VERIFICACIÓN DE CONEXIÓN CON SQL SERVER
# ============================================================

def verificar_base_datos(db: Session):
    # Ejecuta una consulta para obtener el nombre de la base de datos
    resultado = db.execute(text("SELECT DB_NAME()")).scalar()

    # Retorna el resultado en formato JSON
    return {
        "base_de_datos": resultado
    }