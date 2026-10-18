# ============================================================
# MODELO DE USUARIOS - TECNOMEGA
# ============================================================

from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from config.database import Base
from models.persona import Persona
from models.rol import Rol


class Usuario(Base):
    """
    Representa una cuenta de acceso al sistema, vinculada
    a una Persona y a un Rol de autorización.
    """

    __tablename__ = "Usuarios"

    UsuarioId: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
        comment="Identificador único del usuario",
    )

    PersonaId: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("Personas.PersonaId"),
        nullable=False,
        unique=True,
        comment="Identificador de la persona asociada",
    )

    RolId: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("Roles.RolId"),
        nullable=False,
        comment="Identificador del rol del usuario",
    )

    PasswordHash: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="Hash seguro de la contraseña",
    )

    FechaRegistro: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
        comment="Fecha y hora de creación de la cuenta",
    )

    Estado: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
        comment="Indica si la cuenta está activa",
    )

    # Relaciones ORM
    Persona: Mapped["Persona"] = relationship("Persona")
    Rol: Mapped["Rol"] = relationship("Rol")
