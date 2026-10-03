# ============================================================
# MODELO DE MARCAS
# ============================================================

from sqlalchemy import Boolean, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from config.database import Base


# ============================================================
# CLASE MARCA
# ============================================================

class Marca(Base):
    # Nombre de la tabla en SQL Server
    __tablename__ = "Marcas"

    # Identificador único de la marca
    MarcaId: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True
    )

    # Nombre de la marca
    Nombre: Mapped[str] = mapped_column(
        String(100),
        unique=True,
        nullable=False
    )

    # Estado de la marca
    Estado: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False
    )