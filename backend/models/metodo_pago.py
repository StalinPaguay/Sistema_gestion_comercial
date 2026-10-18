# ============================================================
# MODELO DE MÉTODOS DE PAGO
# ============================================================

from sqlalchemy import Boolean, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from config.database import Base


# ============================================================
# CLASE METODO PAGO
# ============================================================

class MetodoPago(Base):
    # Nombre de la tabla en SQL Server
    __tablename__ = "MetodosPago"

    # Identificador único del método de pago
    MetodoPagoId: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True
    )

    # Nombre del método de pago
    Nombre: Mapped[str] = mapped_column(
        String(100),
        unique=True,
        nullable=False
    )

    # Estado del método de pago
    Estado: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False
    )