# ============================================================
# MODELO DE FAVORITOS
# ============================================================

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from config.database import Base
from models.usuario import Usuario
from models.producto import Producto


# ============================================================
# CLASE FAVORITO
# ============================================================

class Favorito(Base):
    # Nombre de la tabla en SQL Server
    __tablename__ = "Favoritos"

    # Restricción para evitar productos favoritos repetidos
    # para el mismo usuario
    __table_args__ = (
        UniqueConstraint(
            "UsuarioId",
            "ProductoId",
            name="UQ_Favoritos_Usuario_Producto"
        ),
    )

    # Identificador único del favorito
    FavoritoId: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True
    )

    # Identificador del usuario
    UsuarioId: Mapped[int] = mapped_column(
        ForeignKey("Usuarios.UsuarioId"),
        nullable=False
    )

    # Relación con el modelo de usuarios
    Usuario: Mapped["Usuario"] = relationship(
        "Usuario"
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

    # Fecha en la que se agregó el favorito
    Fecha: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False
    )