# ============================================================
# MODELO DE DETALLE DEL CARRITO - TECNOMEGA
# ============================================================

from sqlalchemy import ForeignKey, Integer, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from config.database import Base
from models.producto import Producto


class DetalleCarrito(Base):
    __tablename__ = "DetalleCarrito"

    __table_args__ = (
        UniqueConstraint(
            "CarritoId",
            "ProductoId",
            name="UQ_Carrito_Producto",
        ),
    )

    DetalleCarritoId: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
    )

    CarritoId: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("Carrito.CarritoId"),
        nullable=False,
    )

    ProductoId: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("Productos.ProductoId"),
        nullable=False,
    )

    Cantidad: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    Carrito: Mapped["Carrito"] = relationship("Carrito", back_populates="Detalles")
    Producto: Mapped["Producto"] = relationship("Producto")