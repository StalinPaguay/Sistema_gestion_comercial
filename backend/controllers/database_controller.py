# ============================================================
# CONTROLADOR DE PRUEBA DE BASE DE DATOS
# ============================================================

from fastapi import HTTPException, status
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session


# ============================================================
# VERIFICACIÓN DE CONEXIÓN CON SQL SERVER
# ============================================================

def verificar_base_datos(db: Session):
    """
    Verifica la conectividad activa con el motor de base de datos SQL Server.
    Captura de forma controlada cualquier fallo de conexión o timeout.
    """
    try:
        # Ejecuta una consulta para obtener el nombre de la base de datos
        resultado = db.execute(text("SELECT DB_NAME()")).scalar()
        if not resultado:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="No se pudo obtener el nombre de la base de datos activa.",
            )

        # Retorna el resultado en formato JSON estructurado
        return {
            "estado": "Conectado",
            "base_de_datos": resultado,
        }
    except HTTPException:
        raise
    except SQLAlchemyError as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Error de conexión con la base de datos: {error.__class__.__name__}",
        ) from error
    except Exception as error:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error inesperado al verificar la base de datos: {str(error)}",
        ) from error