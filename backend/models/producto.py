# ============================================================
# MODELO DE PRODUCTOS - TECNOMEGA
# Descripción:
#   Define la estructura ORM de la tabla Productos en SQL Server.
#   Las columnas y sus tipos corresponden al esquema existente
#   de la base de datos.
# ============================================================

from decimal import Decimal

from sqlalchemy import Boolean, ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from config.database import Base


class Producto(Base):
    """
    Modelo ORM de productos comerciales.

    Representa la tabla Productos y establece las relaciones
    con las tablas Categorias y Marcas.
    """

    # Nombre exacto de la tabla existente en SQL Server.
    __tablename__ = "Productos"

    # --------------------------------------------------------
    # Identificador principal
    # --------------------------------------------------------
    ProductoId: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
        comment="Identificador único del producto",
    )

    # --------------------------------------------------------
    # Relación con la categoría del producto
    # --------------------------------------------------------
    CategoriaId: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("Categorias.CategoriaId"),
        nullable=False,
        comment="Identificador de la categoría asociada",
    )

    # --------------------------------------------------------
    # Relación con la marca del producto
    # --------------------------------------------------------
    MarcaId: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("Marcas.MarcaId"),
        nullable=False,
        comment="Identificador de la marca asociada",
    )

    # --------------------------------------------------------
    # Código único de identificación del producto
    # --------------------------------------------------------
    # La base de datos ya dispone del índice único
    # UQ_Productos_SKU para evitar códigos duplicados.
    SKU: Mapped[str] = mapped_column(
        String(50),
        unique=True,
        nullable=False,
        comment="Código único de identificación del producto",
    )

    # --------------------------------------------------------
    # Información descriptiva
    # --------------------------------------------------------
    Nombre: Mapped[str] = mapped_column(
        String(150),
        nullable=False,
        comment="Nombre comercial del producto",
    )

    Descripcion: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
        comment="Descripción detallada del producto",
    )

    # --------------------------------------------------------
    # Información económica
    # --------------------------------------------------------
    # Decimal permite representar importes con precisión.
    # Numeric(18, 2) corresponde a la precisión de SQL Server.
    Precio: Mapped[Decimal] = mapped_column(
        Numeric(18, 2),
        nullable=False,
        comment="Precio unitario del producto",
    )

    # --------------------------------------------------------
    # Control de inventario
    # --------------------------------------------------------
    Stock: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        comment="Cantidad disponible en inventario",
    )

    StockMinimo: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        comment="Nivel mínimo de inventario permitido",
    )

    # --------------------------------------------------------
    # Estado del registro
    # --------------------------------------------------------
    # Permite distinguir productos activos de productos inactivos.
    Estado: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        comment="Indica si el producto está activo",
    )

    # --------------------------------------------------------
    # Relaciones ORM
    # --------------------------------------------------------
    # Facilitan el acceso a la categoría y a la marca asociadas
    # mediante SQLAlchemy, sin agregar columnas a la tabla.
    Categoria: Mapped["Categoria"] = relationship(
        "Categoria",
    )

    Marca: Mapped["Marca"] = relationship(
        "Marca",
    )

    Imagenes: Mapped[list["ImagenProducto"]] = relationship(
        "ImagenProducto",
        back_populates="Producto",
        cascade="all, delete-orphan",
    )
