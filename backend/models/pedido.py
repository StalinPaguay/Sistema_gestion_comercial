# ============================================================
# MODELO DE PEDIDOS
# ============================================================

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from config.database import Base
from models.usuario import Usuario
from models.cliente import Cliente
from models.direccion_cliente import DireccionCliente
from models.promocion import Promocion


# ============================================================
# CLASE PEDIDO
# ============================================================

class Pedido(Base):
    # Nombre de la tabla en SQL Server
    __tablename__ = "Pedidos"

    # Identificador único del pedido
    PedidoId: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True
    )

    # Identificador del usuario que realiza el pedido
    UsuarioId: Mapped[int] = mapped_column(
        ForeignKey("Usuarios.UsuarioId"),
        nullable=False
    )

    # Relación con el modelo de usuarios
    Usuario: Mapped["Usuario"] = relationship(
        "Usuario"
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

    # Identificador de la dirección utilizada en el pedido
    DireccionId: Mapped[int] = mapped_column(
        ForeignKey("DireccionesCliente.DireccionId"),
        nullable=False
    )

    # Relación con el modelo de direcciones
    Direccion: Mapped["DireccionCliente"] = relationship(
        "DireccionCliente"
    )

    # Identificador de la promoción aplicada al pedido
    PromocionId: Mapped[int | None] = mapped_column(
        ForeignKey("Promociones.PromocionId"),
        nullable=True
    )

    # Relación con el modelo de promociones
    Promocion: Mapped["Promocion"] = relationship(
        "Promocion"
    )

    # Fecha en la que se realizó el pedido
    FechaPedido: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False
    )

    # Subtotal del pedido
    Subtotal: Mapped[float] = mapped_column(
        Numeric(18, 2),
        nullable=False
    )

    # Descuento aplicado al pedido
    Descuento: Mapped[float] = mapped_column(
        Numeric(18, 2),
        nullable=False
    )

    # IVA del pedido
    IVA: Mapped[float] = mapped_column(
        Numeric(18, 2),
        nullable=False
    )

    # Total final del pedido
    Total: Mapped[float] = mapped_column(
        Numeric(18, 2),
        nullable=False
    )

    # Estado actual del pedido
    Estado: Mapped[str] = mapped_column(
        String(30),
        nullable=False
    )