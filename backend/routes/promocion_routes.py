# ============================================================
# RUTAS DE PROMOCIONES Y CUPONES DE DESCUENTO - TECNOMEGA
# ============================================================

from datetime import datetime
from decimal import Decimal
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session

from config.database import get_db
from models.categoria import Categoria
from models.producto import Producto
from models.promocion import Promocion
from models.promocion_categoria import PromocionCategoria
from models.promocion_producto import PromocionProducto
from services.auth_service import get_current_user, require_admin

router = APIRouter(
    prefix="/promociones",
    tags=["Promociones y Descuentos"],
)


# ============================================================
# ESQUEMAS PYDANTIC
# ============================================================

class PromocionEntrada(BaseModel):
    Nombre: str = Field(min_length=2, max_length=150, description="Nombre de la promoción")
    CodigoCupon: str | None = Field(default=None, max_length=50, description="Código de cupón opcional (ej: VERANO15)")
    TipoDescuento: str = Field(
        pattern="^(PORCENTAJE|MONTO_FIJO)$",
        description="Tipo de descuento: PORCENTAJE o MONTO_FIJO",
    )
    ValorDescuento: Decimal = Field(gt=0, max_digits=18, decimal_places=2, description="Valor del descuento")
    MontoMinimoCompra: Decimal = Field(default=Decimal("0.00"), ge=0, max_digits=18, decimal_places=2)
    FechaInicio: datetime = Field(description="Fecha de inicio de vigencia")
    FechaFin: datetime = Field(description="Fecha de fin de vigencia")
    ProductosIds: list[int] | None = Field(default=None, description="Productos específicos a los que aplica")
    CategoriasIds: list[int] | None = Field(default=None, description="Categorías específicas a las que aplica")


class PromocionActualizacion(BaseModel):
    model_config = ConfigDict(extra="forbid")
    Nombre: str | None = None
    CodigoCupon: str | None = None
    TipoDescuento: str | None = None
    ValorDescuento: Decimal | None = None
    MontoMinimoCompra: Decimal | None = None
    FechaInicio: datetime | None = None
    FechaFin: datetime | None = None
    Estado: bool | None = None


class ValidarCuponEntrada(BaseModel):
    CodigoCupon: str = Field(min_length=1, description="Código del cupón a validar")
    Subtotal: Decimal = Field(ge=0, description="Subtotal de la compra para validar monto mínimo")
    ProductosIds: list[int] | None = Field(default=None, description="Lista de IDs de productos en el carrito")


def serializar_promocion(p: Promocion, db: Session) -> dict[str, Any]:
    prods = db.query(PromocionProducto).filter(PromocionProducto.PromocionId == p.PromocionId).all()
    cats = db.query(PromocionCategoria).filter(PromocionCategoria.PromocionId == p.PromocionId).all()

    return {
        "PromocionId": p.PromocionId,
        "Nombre": p.Nombre,
        "CodigoCupon": p.CodigoCupon,
        "TipoDescuento": p.TipoDescuento,
        "ValorDescuento": str(p.ValorDescuento),
        "MontoMinimoCompra": str(p.MontoMinimoCompra),
        "FechaInicio": p.FechaInicio.isoformat() if p.FechaInicio else None,
        "FechaFin": p.FechaFin.isoformat() if p.FechaFin else None,
        "Estado": p.Estado,
        "ProductosIds": [x.ProductoId for x in prods],
        "CategoriasIds": [x.CategoriaId for x in cats],
    }


# ============================================================
# ENDPOINTS
# ============================================================

@router.get("", summary="Listar promociones")
def listar_promociones(
    limite: int = Query(default=50, ge=1, le=200),
    desde: int = Query(default=0, ge=0),
    incluir_inactivas: bool = Query(default=False),
    db: Session = Depends(get_db),
):
    query = db.query(Promocion)
    if not incluir_inactivas:
        now = datetime.now()
        query = query.filter(
            Promocion.Estado == True,
            Promocion.FechaInicio <= now,
            Promocion.FechaFin >= now,
        )

    promos = query.order_by(Promocion.PromocionId.desc()).offset(desde).limit(limite).all()
    return [serializar_promocion(p, db) for p in promos]


@router.get("/{promocion_id}", summary="Detalle de una promoción por ID")
def obtener_promocion(
    promocion_id: int,
    db: Session = Depends(get_db),
):
    promo = db.get(Promocion, promocion_id)
    if not promo:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Promoción no encontrada.")
    return serializar_promocion(promo, db)


@router.post("", status_code=status.HTTP_201_CREATED, summary="Crear nueva promoción (Admin)")
def crear_promocion(
    datos: PromocionEntrada,
    db: Session = Depends(get_db),
    _user: Any = Depends(require_admin),
):
    if datos.FechaFin < datos.FechaInicio:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La fecha de fin no puede ser anterior a la fecha de inicio.",
        )

    if datos.TipoDescuento == "PORCENTAJE" and datos.ValorDescuento > Decimal("100.00"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El porcentaje de descuento no puede ser superior al 100%.",
        )

    codigo_limpio = datos.CodigoCupon.strip().upper() if datos.CodigoCupon else None
    if codigo_limpio:
        existe = db.query(Promocion).filter(Promocion.CodigoCupon == codigo_limpio).first()
        if existe:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Ya existe una promoción registrada con ese código de cupón.",
            )

    try:
        promo = Promocion(
            Nombre=datos.Nombre.strip(),
            CodigoCupon=codigo_limpio,
            TipoDescuento=datos.TipoDescuento,
            ValorDescuento=datos.ValorDescuento,
            MontoMinimoCompra=datos.MontoMinimoCompra,
            FechaInicio=datos.FechaInicio,
            FechaFin=datos.FechaFin,
            Estado=True,
        )
        db.add(promo)
        db.flush()

        if datos.ProductosIds:
            for pid in datos.ProductosIds:
                db.add(PromocionProducto(PromocionId=promo.PromocionId, ProductoId=pid))

        if datos.CategoriasIds:
            for cid in datos.CategoriasIds:
                db.add(PromocionCategoria(PromocionId=promo.PromocionId, CategoriaId=cid))

        db.commit()
        db.refresh(promo)
        return serializar_promocion(promo, db)

    except HTTPException:
        db.rollback()
        raise
    except Exception as error:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al crear promoción: {str(error)}",
        ) from error


@router.patch("/{promocion_id}", summary="Actualizar promoción (Admin)")
def actualizar_promocion(
    promocion_id: int,
    datos: PromocionActualizacion,
    db: Session = Depends(get_db),
    _user: Any = Depends(require_admin),
):
    promo = db.get(Promocion, promocion_id)
    if not promo:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Promoción no encontrada.")

    campos = datos.model_dump(exclude_unset=True)
    if not campos:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="No se enviaron campos.")

    for k, v in campos.items():
        if k == "CodigoCupon" and v:
            setattr(promo, k, v.strip().upper())
        else:
            setattr(promo, k, v)

    db.commit()
    db.refresh(promo)
    return serializar_promocion(promo, db)


@router.delete("/{promocion_id}", summary="Desactivar promoción (Admin)")
def desactivar_promocion(
    promocion_id: int,
    db: Session = Depends(get_db),
    _user: Any = Depends(require_admin),
):
    promo = db.get(Promocion, promocion_id)
    if not promo:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Promoción no encontrada.")

    promo.Estado = False
    db.commit()
    return {"message": "Promoción desactivada correctamente."}


@router.post("/validar-cupon", summary="Validar código de cupón y calcular descuento aplicable")
def validar_cupon(
    datos: ValidarCuponEntrada,
    db: Session = Depends(get_db),
):
    """
    Endpoint utilizado por el Frontend para verificar si un cupón es válido
    y calcular el ahorro antes de confirmar la compra.
    """
    codigo = datos.CodigoCupon.strip().upper()
    now = datetime.now()

    promo = db.query(Promocion).filter(Promocion.CodigoCupon == codigo, Promocion.Estado == True).first()
    if not promo:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cupón no encontrado o inactivo.")

    if now < promo.FechaInicio or now > promo.FechaFin:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El cupón está fuera de su fecha de vigencia.")

    if datos.Subtotal < promo.MontoMinimoCompra:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"El subtotal (${datos.Subtotal}) no alcanza el monto mínimo requerido para este cupón (${promo.MontoMinimoCompra}).",
        )

    # Calcular monto de descuento
    if promo.TipoDescuento == "PORCENTAJE":
        descuento = round(datos.Subtotal * (promo.ValorDescuento / Decimal("100.0")), 2)
    else:
        descuento = min(promo.ValorDescuento, datos.Subtotal)

    total_con_descuento = max(Decimal("0.00"), datos.Subtotal - descuento)

    return {
        "valido": True,
        "promocion_id": promo.PromocionId,
        "nombre": promo.Nombre,
        "codigo_cupon": promo.CodigoCupon,
        "tipo_descuento": promo.TipoDescuento,
        "valor_descuento": str(promo.ValorDescuento),
        "monto_descuento": str(descuento),
        "subtotal_original": str(datos.Subtotal),
        "subtotal_con_descuento": str(total_con_descuento),
    }
