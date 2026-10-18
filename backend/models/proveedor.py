# ============================================================
# MODELO DE PROVEEDORES - TECNOMEGA
# ============================================================

from sqlalchemy import Boolean, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from config.database import Base


class Proveedor(Base):
    __tablename__ = "Proveedores"

    ProveedorId: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
    )

    NombreEmpresa: Mapped[str] = mapped_column(
        String(150),
        nullable=False,
    )

    RUC: Mapped[str] = mapped_column(
        String(20),
        unique=True,
        nullable=False,
    )

    Contacto: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )

    Telefono: Mapped[str | None] = mapped_column(
        String(20),
        nullable=True,
    )

    Email: Mapped[str | None] = mapped_column(
        String(150),
        nullable=True,
    )

    Direccion: Mapped[str | None] = mapped_column(
        String(250),
        nullable=True,
    )

    Estado: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )