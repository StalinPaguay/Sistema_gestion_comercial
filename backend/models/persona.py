# ============================================================
# MODELO DE PERSONAS - TECNOMEGA
# ============================================================

from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from config.database import Base


class Persona(Base):
    """
    Representa los datos básicos y de contacto de una persona física
    (asociada a un Usuario, Cliente o ambos).
    """

    __tablename__ = "Personas"

    PersonaId: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
        comment="Identificador único de la persona",
    )

    Nombres: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        comment="Nombres de la persona",
    )

    Apellidos: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        comment="Apellidos de la persona",
    )

    Email: Mapped[str | None] = mapped_column(
        String(150),
        nullable=True,
        unique=True,
        comment="Correo electrónico de contacto",
    )

    Telefono: Mapped[str | None] = mapped_column(
        String(20),
        nullable=True,
        comment="Teléfono de contacto",
    )
