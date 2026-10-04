# ============================================================
# MODELO DE CARRITO
# ============================================================

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from config.database import Base
from models.usuario import Usuario


# ============================================================
# CLASE CARRITO
# ============================================================

class Carrito(Base):
    # Nombre de la tabla en SQL Server
    __tablename__ = "Carrito"

    # Identificador único del carrito
    CarritoId: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True
    )

    # Identificador del usuario propietario del carrito
    UsuarioId: Mapped[int] = mapped_column(
        ForeignKey("Usuarios.UsuarioId"),
        nullable=False
    )

    # Relación con el modelo de usuarios
    Usuario: Mapped["Usuario"] = relationship(
        "Usuario"
    )

    # Fecha de creación del carrito
    FechaCreacion: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False
    )

    # Estado actual del carrito
    Estado: Mapped[str] = mapped_column(
        String(20),
        nullable=False
    )
    