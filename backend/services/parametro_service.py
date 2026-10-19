"""Lectura de parámetros comerciales persistidos en la base de datos."""

from decimal import Decimal

from sqlalchemy import inspect, text
from sqlalchemy.orm import Session


def obtener_porcentaje_iva(db: Session) -> Decimal:
    """Lee IVA_PORCENTAJE en ambos formatos de tabla usados por los scripts SQL."""
    columns = {
        column["name"]
        for column in inspect(db.get_bind()).get_columns("Parametros", schema="dbo")
    }
    value_column = "ValorDecimal" if "ValorDecimal" in columns else "Valor" if "Valor" in columns else None
    if value_column is None:
        raise ValueError("La tabla Parametros no contiene una columna de valor compatible.")

    state_filter = "AND Estado = 1" if "Estado" in columns else ""
    row = db.execute(
        text(
            f"SELECT TOP 1 [{value_column}] AS valor FROM dbo.Parametros "
            f"WHERE Clave = 'IVA_PORCENTAJE' {state_filter}"
        )
    ).mappings().first()
    if row is None or row["valor"] is None:
        raise ValueError("No existe un parámetro IVA_PORCENTAJE activo en la base de datos.")
    return Decimal(str(row["valor"]))
