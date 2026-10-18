# ============================================================
# MODELO DE DETALLES DE FACTURAS
# ============================================================

from sqlalchemy import ForeignKey, Integer, Numeric
from sqlalchemy.orm import Mapped, mapped_column, relationship

from config.database import Base
from models.factura import Factura
from models.producto import Producto


# ============================================================
# CLASE DETALLE FACTURA
# ============================================================

class DetalleFactura(Base):
    # Nombre de la tabla en SQL Server
    __tablename__ = "DetallesFactura"

    # Identificador único del detalle de factura
    DetalleFacturaId: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True
    )

    # Identificador de la factura
    FacturaId: Mapped[int] = mapped_column(
        ForeignKey("Facturas.FacturaId"),
        nullable=False
    )

    # Relación con el modelo de facturas
    Factura: Mapped["Factura"] = relationship(
        "Factura"
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

    # Cantidad del producto facturado
    Cantidad: Mapped[int] = mapped_column(
        Integer,
        nullable=False
    )

    # Precio unitario normal del producto
    PrecioUnitario: Mapped[float] = mapped_column(
        Numeric(18, 2),
        nullable=False
    )

    # Porcentaje de descuento aplicado
    DescuentoPorcentaje: Mapped[float] = mapped_column(
        Numeric(5, 2),
        nullable=False
    )

    # Valor monetario del descuento
    DescuentoValor: Mapped[float] = mapped_column(
        Numeric(18, 2),
        nullable=False
    )

    # Subtotal del detalle
    Subtotal: Mapped[float] = mapped_column(
        Numeric(18, 2),
        nullable=False
    )

    # Total final del detalle
    Total: Mapped[float] = mapped_column(
        Numeric(18, 2),
        nullable=False
    )