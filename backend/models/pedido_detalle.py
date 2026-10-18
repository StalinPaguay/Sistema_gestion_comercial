# ============================================================
# MODELO DE DETALLE DE PEDIDOS
# ============================================================

from sqlalchemy import ForeignKey, Integer, Numeric
from sqlalchemy.orm import Mapped, mapped_column, relationship

from config.database import Base
from models.pedido import Pedido
from models.producto import Producto


# ============================================================
# CLASE PEDIDO DETALLE
# ============================================================

class PedidoDetalle(Base):
    # Nombre de la tabla en SQL Server
    __tablename__ = "PedidoDetalle"

    # Identificador único del detalle del pedido
    PedidoDetalleId: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True
    )

    # Identificador del pedido
    PedidoId: Mapped[int] = mapped_column(
        ForeignKey("Pedidos.PedidoId"),
        nullable=False
    )

    # Relación con el modelo de pedidos
    Pedido: Mapped["Pedido"] = relationship(
        "Pedido"
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

    # Cantidad del producto solicitado
    Cantidad: Mapped[int] = mapped_column(
        Integer,
        nullable=False
    )

    # Precio unitario del producto
    PrecioUnitario: Mapped[float] = mapped_column(
        Numeric(18, 2),
        nullable=False
    )

    # Subtotal del detalle
    Subtotal: Mapped[float] = mapped_column(
        Numeric(18, 2),
        nullable=False
    )

    # Descuento aplicado al detalle
    Descuento: Mapped[float] = mapped_column(
        Numeric(18, 2),
        nullable=False
    )

    # Total final del detalle
    Total: Mapped[float] = mapped_column(
        Numeric(18, 2),
        nullable=False
    )