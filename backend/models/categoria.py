# ============================================================
# MODELO DE CATEGORÍAS
# ============================================================

from sqlalchemy import Boolean, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from config.database import Base


# ============================================================
# CLASE CATEGORIA
# ============================================================

class Categoria(Base):
    # Nombre de la tabla en SQL Server
    __tablename__ = "Categorias"

    # Identificador único de la categoría
    CategoriaId: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True
    )

    # Nombre de la categoría
    Nombre: Mapped[str] = mapped_column(
        String(100),
        unique=True,
        nullable=False
    )

    # Descripción de la categoría
    Descripcion: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True
    )

    # Estado de la categoría
    Estado: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False
    )