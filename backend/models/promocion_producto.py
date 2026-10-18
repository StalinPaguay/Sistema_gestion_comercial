# ============================================================
# MODELO DE PROMOCIONES Y PRODUCTOS
# ============================================================

from sqlalchemy import ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship

from config.database import Base
from models.promocion import Promocion
from models.producto import Producto


# ============================================================
# CLASE PROMOCION PRODUCTO
# ============================================================

class PromocionProducto(Base):
    # Nombre de la tabla en SQL Server
    __tablename__ = "PromocionProducto"

    # Identificador de la promoción
    PromocionId: Mapped[int] = mapped_column(
        ForeignKey("Promociones.PromocionId"),
        primary_key=True
    )

    # Relación con el modelo de promociones
    Promocion: Mapped["Promocion"] = relationship(
        "Promocion"
    )

    # Identificador del producto
    ProductoId: Mapped[int] = mapped_column(
        ForeignKey("Productos.ProductoId"),
        primary_key=True
    )

    # Relación con el modelo de productos
    Producto: Mapped["Producto"] = relationship(
        "Producto"
    )