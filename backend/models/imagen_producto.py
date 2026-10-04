# ============================================================
# MODELO DE IMÁGENES DE PRODUCTOS
# ============================================================

from sqlalchemy import Boolean, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from config.database import Base
from models.producto import Producto


# ============================================================
# CLASE IMAGEN PRODUCTO
# ============================================================

class ImagenProducto(Base):
    # Nombre de la tabla en SQL Server
    __tablename__ = "ImagenesProducto"

    # Identificador único de la imagen
    ImagenId: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True
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

    # URL de la imagen
    UrlImagen: Mapped[str] = mapped_column(
        String(500),
        nullable=False
    )

    # Indica si la imagen es principal
    EsPrincipal: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False
    )