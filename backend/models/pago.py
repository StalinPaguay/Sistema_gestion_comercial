# ============================================================
# MODELO DE PAGOS
# ============================================================

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from config.database import Base
from models.pedido import Pedido
from models.metodo_pago import MetodoPago


# ============================================================
# CLASE PAGO
# ============================================================

class Pago(Base):
    # Nombre de la tabla en SQL Server
    __tablename__ = "Pagos"

    # Identificador único del pago
    PagoId: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True
    )

    # Identificador del pedido
    PedidoId: Mapped[int] = mapped_column(
        ForeignKey("Pedidos.PedidoId"),
        nullable=False
    )

    # Relación con el modelo de pedidos
    Pedido: Mapped["Pedido"] = relationship(
        "Pedido"
    )

    # Identificador del método de pago
    MetodoPagoId: Mapped[int] = mapped_column(
        ForeignKey("MetodosPago.MetodoPagoId"),
        nullable=False
    )

    # Relación con el modelo de métodos de pago
    MetodoPago: Mapped["MetodoPago"] = relationship(
        "MetodoPago"
    )

    # Fecha en la que se realizó el pago
    FechaPago: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False
    )

    # Monto pagado
    Monto: Mapped[float] = mapped_column(
        Numeric(18, 2),
        nullable=False
    )

    # Estado actual del pago
    Estado: Mapped[str] = mapped_column(
        String(30),
        nullable=False
    )

    # Identificador de la transacción
    TransaccionId: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True
    )