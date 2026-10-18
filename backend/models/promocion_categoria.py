# ============================================================
# MODELO DE PROMOCIONES Y CATEGORÍAS
# ============================================================

from sqlalchemy import ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship

from config.database import Base
from models.promocion import Promocion
from models.categoria import Categoria


# ============================================================
# CLASE PROMOCION CATEGORIA
# ============================================================

class PromocionCategoria(Base):
    # Nombre de la tabla en SQL Server
    __tablename__ = "PromocionCategoria"

    # Identificador de la promoción
    PromocionId: Mapped[int] = mapped_column(
        ForeignKey("Promociones.PromocionId"),
        primary_key=True
    )

    # Relación con el modelo de promociones
    Promocion: Mapped["Promocion"] = relationship(
        "Promocion"
    )

    # Identificador de la categoría
    CategoriaId: Mapped[int] = mapped_column(
        ForeignKey("Categorias.CategoriaId"),
        primary_key=True
    )

    # Relación con el modelo de categorías
    Categoria: Mapped["Categoria"] = relationship(
        "Categoria"
    )