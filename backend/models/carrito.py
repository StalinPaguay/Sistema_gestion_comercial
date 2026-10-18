# ============================================================
# MODELO DE CARRITO - TECNOMEGA
# ============================================================

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship

from config.database import Base
from models.cliente import Cliente


class Carrito(Base):
    __tablename__ = "Carrito"

    CarritoId: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
    )

    ClienteId: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("Clientes.ClienteId"),
        unique=True,
        nullable=False,
    )

    FechaActualizacion: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )

    Cliente: Mapped["Cliente"] = relationship("Cliente")
    Detalles: Mapped[list["DetalleCarrito"]] = relationship("DetalleCarrito", back_populates="Carrito", cascade="all, delete-orphan")