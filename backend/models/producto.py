# ============================================================
# MODELO DE PRODUCTOS
# ============================================================

from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from config.database import Base
from models.categoria import Categoria
from models.marca import Marca
from models.proveedor import Proveedor


# ============================================================
# CLASE PRODUCTO
# ============================================================

class Producto(Base):
    # Nombre de la tabla en SQL Server
    __tablename__ = "Productos"

    # Identificador único del producto
    ProductoId: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True
    )

    # Identificador de la categoría
    CategoriaId: Mapped[int] = mapped_column(
        ForeignKey("Categorias.CategoriaId"),
        nullable=False
    )

    # Relación con la categoría
    Categoria: Mapped["Categoria"] = relationship(
        "Categoria"
    )

    # Identificador de la marca
    MarcaId: Mapped[int] = mapped_column(
        ForeignKey("Marcas.MarcaId"),
        nullable=False
    )

    # Relación con la marca
    Marca: Mapped["Marca"] = relationship(
        "Marca"
    )

    # Identificador del proveedor
    ProveedorId: Mapped[int] = mapped_column(
        ForeignKey("Proveedores.ProveedorId"),
        nullable=False
    )

    # Relación con el proveedor
    Proveedor: Mapped["Proveedor"] = relationship(
        "Proveedor"
    )

    # Nombre del producto
    Nombre: Mapped[str] = mapped_column(
        String(200),
        nullable=False
    )

    # Descripción del producto
    Descripcion: Mapped[str | None] = mapped_column(
        String,
        nullable=True
    )

    # Precio del producto
    Precio: Mapped[float] = mapped_column(
        Numeric(18, 2),
        nullable=False
    )

    # Cantidad disponible en inventario
    Stock: Mapped[int] = mapped_column(
        Integer,
        nullable=False
    )

    # Stock mínimo permitido
    StockMinimo: Mapped[int] = mapped_column(
        Integer,
        nullable=False
    )

    # Código único del producto
    SKU: Mapped[str] = mapped_column(
        String(50),
        unique=True,
        nullable=False
    )

    # Estado del producto
    Estado: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False
    )

    # Fecha de creación del producto
    FechaCreacion: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False
    )