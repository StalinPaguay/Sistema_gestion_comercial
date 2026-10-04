# ============================================================
# MODELO DE DETALLE DEL CARRITO
# ============================================================

from sqlalchemy import ForeignKey, Integer, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from config.database import Base
from models.carrito import Carrito
from models.producto import Producto


# ============================================================
# CLASE CARRITO DETALLE
# ============================================================

class CarritoDetalle(Base):
    # Nombre de la tabla en SQL Server
    __tablename__ = "CarritoDetalle"

    # Restricción para evitar productos repetidos en un carrito
    __table_args__ = (
        UniqueConstraint(
            "CarritoId",
            "ProductoId",
            name="UQ_Carrito_Producto"
        ),
    )

    # Identificador único del detalle
    DetalleId: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True
    )

    # Identificador del carrito
    CarritoId: Mapped[int] = mapped_column(
        ForeignKey("Carrito.CarritoId"),
        nullable=False
    )

    # Relación con el modelo de carrito
    Carrito: Mapped["Carrito"] = relationship(
        "Carrito"
    )

    # Identificador del producto
    ProductoId: Mapped[int] = mapped_column(
        ForeignKey("Productos.ProductoId"),
        nullable=False
    )

    # Relación con el modelo de productos
    Producto: Mapped["Producto"] = relationship(
        "Producto"
    )

    # Cantidad del producto
    Cantidad: Mapped[int] = mapped_column(
        Integer,
        nullable=False
    )