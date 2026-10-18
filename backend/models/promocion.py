# ============================================================
# MODELO DE PROMOCIONES
# ============================================================

from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from config.database import Base


# ============================================================
# CLASE PROMOCION
# ============================================================

class Promocion(Base):
    # Nombre de la tabla en SQL Server
    __tablename__ = "Promociones"

    # Identificador único de la promoción
    PromocionId: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True
    )

    # Nombre de la promoción
    Nombre: Mapped[str] = mapped_column(
        String(150),
        nullable=False
    )

    # Código de cupón de la promoción
    CodigoCupon: Mapped[str | None] = mapped_column(
        String(50),
        unique=True,
        nullable=True
    )

    # Tipo de descuento
    TipoDescuento: Mapped[str] = mapped_column(
        String(20),
        nullable=False
    )

    # Valor del descuento
    ValorDescuento: Mapped[float] = mapped_column(
        Numeric(18, 2),
        nullable=False
    )

    # Monto mínimo de compra para aplicar la promoción
    MontoMinimoCompra: Mapped[float] = mapped_column(
        Numeric(18, 2),
        nullable=False
    )

    # Fecha de inicio de la promoción
    FechaInicio: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False
    )

    # Fecha de finalización de la promoción
    FechaFin: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False
    )

    # Estado de la promoción
    Estado: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False
    )