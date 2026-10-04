# ============================================================
# MODELO DE ROLES
# ============================================================

from sqlalchemy import Boolean, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from config.database import Base


# ============================================================
# CLASE ROL
# ============================================================

class Rol(Base):
    # Nombre de la tabla en SQL Server
    __tablename__ = "Roles"

    # Identificador único del rol
    RolId: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True
    )

    # Nombre del rol
    Nombre: Mapped[str] = mapped_column(
        String(50),
        unique=True,
        nullable=False
    )

    # Descripción del rol
    Descripcion: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True
    )

    # Estado del rol
    Estado: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True
    )