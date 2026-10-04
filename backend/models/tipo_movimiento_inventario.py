# ============================================================
# MODELO DE TIPOS DE MOVIMIENTO DE INVENTARIO
# ============================================================

from sqlalchemy import Boolean, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from config.database import Base


# ============================================================
# CLASE TIPO MOVIMIENTO INVENTARIO
# ============================================================

class TipoMovimientoInventario(Base):
    # Nombre de la tabla en SQL Server
    __tablename__ = "TiposMovimientoInventario"

    # Identificador único del tipo de movimiento
    TipoMovimientoId: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True
    )

    # Nombre del tipo de movimiento
    Nombre: Mapped[str] = mapped_column(
        String(50),
        unique=True,
        nullable=False
    )

    # Descripción del tipo de movimiento
    Descripcion: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True
    )

    # Estado del tipo de movimiento
    Estado: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False
    )