# ============================================================
# MODELO DE CLIENTES
# ============================================================

from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from config.database import Base


# ============================================================
# CLASE CLIENTE
# ============================================================

class Cliente(Base):
    # Nombre de la tabla en SQL Server
    __tablename__ = "Clientes"

    # Identificador único del cliente
    ClienteId: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True
    )

    # Número de identificación del cliente
    Identificacion: Mapped[str] = mapped_column(
        String(20),
        unique=True,
        nullable=False
    )

    # Nombres del cliente
    Nombres: Mapped[str] = mapped_column(
        String(100),
        nullable=False
    )

    # Apellidos del cliente
    Apellidos: Mapped[str] = mapped_column(
        String(100),
        nullable=False
    )

    # Número telefónico del cliente
    Telefono: Mapped[str | None] = mapped_column(
        String(20),
        nullable=True
    )

    # Correo electrónico del cliente
    Email: Mapped[str | None] = mapped_column(
        String(150),
        nullable=True
    )

    # Estado del cliente
    Estado: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False
    )

    # Fecha de registro del cliente
    FechaRegistro: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False
    )