# ============================================================
# MODELO DE DIRECCIONES DE CLIENTES
# ============================================================

from sqlalchemy import Boolean, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from config.database import Base
from models.cliente import Cliente


# ============================================================
# CLASE DIRECCION CLIENTE
# ============================================================

class DireccionCliente(Base):
    # Nombre de la tabla en SQL Server
    __tablename__ = "DireccionesCliente"

    # Identificador único de la dirección
    DireccionId: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True
    )

    # Identificador del cliente
    ClienteId: Mapped[int] = mapped_column(
        ForeignKey("Clientes.ClienteId"),
        nullable=False
    )

    # Relación con el modelo de clientes
    Cliente: Mapped["Cliente"] = relationship(
        "Cliente"
    )

    # Provincia de la dirección
    Provincia: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True
    )

    # Ciudad de la dirección
    Ciudad: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True
    )

    # Dirección principal
    Direccion: Mapped[str] = mapped_column(
        String(250),
        nullable=False
    )

    # Referencia de la dirección
    Referencia: Mapped[str | None] = mapped_column(
        String(250),
        nullable=True
    )

    # Código postal
    CodigoPostal: Mapped[str | None] = mapped_column(
        String(20),
        nullable=True
    )

    # Indica si es la dirección principal
    EsPrincipal: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False
    )

    # Estado de la dirección
    Estado: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False
    )