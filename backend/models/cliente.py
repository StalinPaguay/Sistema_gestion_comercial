# ============================================================
# MODELO DE CLIENTES - TECNOMEGA
# ============================================================

from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from config.database import Base
from models.persona import Persona


class Cliente(Base):
    """
    Representa un cliente comercial en el sistema,
    vinculado a una Persona física con su identificación única.
    """

    __tablename__ = "Clientes"

    ClienteId: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
        comment="Identificador único del cliente",
    )

    PersonaId: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("Personas.PersonaId"),
        nullable=False,
        unique=True,
        comment="Identificador de los datos personales",
    )

    Identificacion: Mapped[str] = mapped_column(
        String(20),
        unique=True,
        nullable=False,
        comment="Cédula, RUC o pasaporte del cliente",
    )

    Estado: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
        comment="Indica si el cliente está activo",
    )

    FechaRegistro: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
        comment="Fecha y hora de registro",
    )

    # Relación ORM
    Persona: Mapped["Persona"] = relationship("Persona")