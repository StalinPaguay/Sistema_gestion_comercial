# ============================================================
# MODELO DE TIPOS DE MOVIMIENTO DE INVENTARIO - TECNOMEGA
# ============================================================

from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from config.database import Base


class TipoMovimientoInventario(Base):
    __tablename__ = "TiposMovimientoInventario"

    TipoMovimientoId: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
    )

    Nombre: Mapped[str] = mapped_column(
        String(50),
        unique=True,
        nullable=False,
    )

    Descripcion: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )