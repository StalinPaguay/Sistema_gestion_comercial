# ============================================================
# MODELO DE MOVIMIENTOS DE INVENTARIO
# ============================================================

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from config.database import Base
from models.producto import Producto
from models.proveedor import Proveedor
from models.usuario import Usuario
from models.tipo_movimiento_inventario import TipoMovimientoInventario


# ============================================================
# CLASE MOVIMIENTO INVENTARIO
# ============================================================

class MovimientoInventario(Base):
    # Nombre de la tabla en SQL Server
    __tablename__ = "MovimientosInventario"

    # Identificador único del movimiento
    MovimientoId: Mapped[int] = mapped_column(
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

    # Identificador del proveedor
    ProveedorId: Mapped[int | None] = mapped_column(
        ForeignKey("Proveedores.ProveedorId"),
        nullable=True
    )

    # Relación con el modelo de proveedores
    Proveedor: Mapped["Proveedor"] = relationship(
        "Proveedor"
    )

    # Identificador del usuario que registra el movimiento
    UsuarioId: Mapped[int] = mapped_column(
        ForeignKey("Usuarios.UsuarioId"),
        nullable=False
    )

    # Relación con el modelo de usuarios
    Usuario: Mapped["Usuario"] = relationship(
        "Usuario"
    )

    # Identificador del tipo de movimiento
    TipoMovimientoId: Mapped[int] = mapped_column(
        ForeignKey("TiposMovimientoInventario.TipoMovimientoId"),
        nullable=False
    )

    # Relación con el tipo de movimiento
    TipoMovimiento: Mapped["TipoMovimientoInventario"] = relationship(
        "TipoMovimientoInventario"
    )

    # Cantidad del movimiento
    Cantidad: Mapped[int] = mapped_column(
        Integer,
        nullable=False
    )

    # Motivo del movimiento
    Motivo: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True
    )

    # Observación del movimiento
    Observacion: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True
    )

    # Fecha del movimiento
    Fecha: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False
    )