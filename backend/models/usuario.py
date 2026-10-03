
# ============================================================
# MODELO DE USUARIOS
# ============================================================

from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from config.database import Base
from models.rol import Rol


# ============================================================
# CLASE USUARIO
# ============================================================

class Usuario(Base):
    # Nombre de la tabla en SQL Server
    __tablename__ = "Usuarios"

    # Identificador único del usuario
    UsuarioId: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True
    )

    # Identificador del rol del usuario
    RolId: Mapped[int] = mapped_column(
        ForeignKey("Roles.RolId"),
        nullable=False
    )

    # Relación con el modelo de roles
    Rol: Mapped["Rol"] = relationship(
        "Rol"
    )

    # Nombres del usuario
    Nombres: Mapped[str] = mapped_column(
        String(100),
        nullable=False
    )

    # Apellidos del usuario
    Apellidos: Mapped[str] = mapped_column(
        String(100),
        nullable=False
    )

    # Correo electrónico del usuario
    Email: Mapped[str] = mapped_column(
        String(150),
        unique=True,
        nullable=False
    )

    # Contraseña almacenada como hash
    PasswordHash: Mapped[str] = mapped_column(
        String(255),
        nullable=False
    )

    # Número telefónico del usuario
    Telefono: Mapped[str | None] = mapped_column(
        String(20),
        nullable=True
    )

    # Fecha de registro del usuario
    FechaRegistro: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False
    )

    # Estado del usuario
    Estado: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False
    )
