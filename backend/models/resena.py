# ============================================================
# MODELO DE RESEÑAS
# ============================================================

from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from config.database import Base
from models.usuario import Usuario
from models.producto import Producto


# ============================================================
# CLASE RESENA
# ============================================================

class Resena(Base):
    # Nombre de la tabla en SQL Server
    __tablename__ = "Resenas"

    # Identificador único de la reseña
    ResenaId: Mapped[int] = mapped_column(
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

    # Calificación otorgada al producto
    Calificacion: Mapped[int] = mapped_column(
        Integer,
        nullable=False
    )

    # Comentario de la reseña
    Comentario: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True
    )

    # Fecha de creación de la reseña
    Fecha: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False
    )

    # Estado de la reseña
    Estado: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False
    )