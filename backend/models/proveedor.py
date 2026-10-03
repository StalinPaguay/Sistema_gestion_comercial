# ============================================================
# MODELO DE PROVEEDORES
# ============================================================

from sqlalchemy import Boolean, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from config.database import Base


# ============================================================
# CLASE PROVEEDOR
# ============================================================

class Proveedor(Base):
    # Nombre de la tabla en SQL Server
    __tablename__ = "Proveedores"

    # Identificador único del proveedor
    ProveedorId: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True
    )

    # Nombre de la empresa proveedora
    NombreEmpresa: Mapped[str] = mapped_column(
        String(150),
        nullable=False
    )

    # Persona de contacto del proveedor
    Contacto: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True
    )

    # Número telefónico del proveedor
    Telefono: Mapped[str | None] = mapped_column(
        String(20),
        nullable=True
    )

    # Correo electrónico del proveedor
    Correo: Mapped[str | None] = mapped_column(
        String(150),
        nullable=True
    )

    # Dirección del proveedor
    Direccion: Mapped[str | None] = mapped_column(
        String(250),
        nullable=True
    )

    # Estado del proveedor
    Estado: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False
    )