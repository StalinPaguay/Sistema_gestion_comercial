"""Consulta y actualización de parámetros comerciales del sistema."""

from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import inspect, text
from sqlalchemy.orm import Session

from config.database import get_db
from services.auth_service import require_admin

router = APIRouter(tags=["Parámetros del sistema"])


class ActualizarIvaEntrada(BaseModel):
    porcentaje: Decimal = Field(ge=0, le=100, max_digits=5, decimal_places=2)


def _iva_column(db: Session) -> str:
    """Admite las dos definiciones de Parametros usadas por los scripts del proyecto."""
    columns = {
        column["name"]
        for column in inspect(db.get_bind()).get_columns("Parametros", schema="dbo")
    }
    if "ValorDecimal" in columns:
        return "ValorDecimal"
    if "Valor" in columns:
        return "Valor"
    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="La tabla Parametros no contiene una columna de valor compatible.",
    )


def _read_iva(db: Session) -> tuple[Decimal, str | None]:
    value_column = _iva_column(db)
    has_state = "Estado" in {
        column["name"]
        for column in inspect(db.get_bind()).get_columns("Parametros", schema="dbo")
    }
    state_filter = "AND Estado = 1" if has_state else ""
    row = db.execute(
        text(
            f"SELECT TOP 1 [{value_column}] AS valor, Descripcion "
            f"FROM dbo.Parametros WHERE Clave = 'IVA_PORCENTAJE' {state_filter}"
        )
    ).mappings().first()
    if row is None or row["valor"] is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No existe un parámetro IVA_PORCENTAJE activo en la base de datos.",
        )
    return Decimal(str(row["valor"])), row.get("Descripcion")


@router.get("/parametros/iva", summary="Consultar porcentaje de IVA vigente")
def obtener_iva(db: Session = Depends(get_db)):
    porcentaje, descripcion = _read_iva(db)
    return {"Clave": "IVA_PORCENTAJE", "Porcentaje": str(porcentaje), "Descripcion": descripcion}


@router.patch("/parametros/iva", summary="Actualizar porcentaje de IVA (Admin)")
def actualizar_iva(
    datos: ActualizarIvaEntrada,
    db: Session = Depends(get_db),
    _admin=Depends(require_admin),
):
    value_column = _iva_column(db)
    columns = {
        column["name"]
        for column in inspect(db.get_bind()).get_columns("Parametros", schema="dbo")
    }
    has_state = "Estado" in columns
    state_filter = "AND Estado = 1" if has_state else ""
    value = f"{datos.porcentaje:.2f}"
    try:
        result = db.execute(
            text(
                f"UPDATE dbo.Parametros SET [{value_column}] = :valor, "
                f"FechaActualizacion = SYSDATETIME() "
                f"WHERE Clave = 'IVA_PORCENTAJE' {state_filter}"
            ),
            {"valor": value},
        )
        if result.rowcount == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No existe un parámetro IVA_PORCENTAJE activo para actualizar.",
            )
        db.commit()
    except HTTPException:
        db.rollback()
        raise
    except Exception as error:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="No se pudo guardar el porcentaje de IVA.",
        ) from error

    porcentaje, descripcion = _read_iva(db)
    return {"Clave": "IVA_PORCENTAJE", "Porcentaje": str(porcentaje), "Descripcion": descripcion}
