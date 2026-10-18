# ============================================================
# MODELO DE FACTURAS
# ============================================================

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from config.database import Base
from models.pedido import Pedido
from models.cliente import Cliente
from models.usuario import Usuario


# ============================================================
# CLASE FACTURA
# ============================================================

class Factura(Base):
    # Nombre de la tabla en SQL Server
    __tablename__ = "Facturas"

    # Identificador único de la factura
    FacturaId: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True
    )

    # Número único de la factura
    Numero: Mapped[str] = mapped_column(
        String(30),
        unique=True,
        nullable=False
    )

    # Identificador del pedido
    PedidoId: Mapped[int | None] = mapped_column(
        ForeignKey("Pedidos.PedidoId"),
        nullable=True
    )

    # Relación con el modelo de pedidos
    Pedido: Mapped["Pedido"] = relationship(
        "Pedido"
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

    # Identificador del usuario que registra la factura
    UsuarioId: Mapped[int] = mapped_column(
        ForeignKey("Usuarios.UsuarioId"),
        nullable=False
    )

    # Relación con el modelo de usuarios
    Usuario: Mapped["Usuario"] = relationship(
        "Usuario"
    )

    # Fecha de emisión de la factura
    Fecha: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False
    )

    # Subtotal de la factura
    Subtotal: Mapped[float] = mapped_column(
        Numeric(18, 2),
        nullable=False
    )

    # Descuento aplicado a la factura
    Descuento: Mapped[float] = mapped_column(
        Numeric(18, 2),
        nullable=False
    )

    # Impuesto aplicado a la factura
    Impuesto: Mapped[float] = mapped_column(
        Numeric(18, 2),
        nullable=False
    )

    # Total final de la factura
    Total: Mapped[float] = mapped_column(
        Numeric(18, 2),
        nullable=False
    )

    # Estado actual de la factura
    Estado: Mapped[str] = mapped_column(
        String(30),
        nullable=False
    )