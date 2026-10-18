
# ============================================================
# RUTAS DE PROMOCIONES Y CUPONES DE DESCUENTO - TECNOMEGA
# ============================================================

from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP
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
from services.auth_service import require_admin

router = APIRouter(
    prefix="/promociones",
    tags=["Promociones y Descuentos"],
)


# ============================================================
# ESQUEMAS PYDANTIC
# ============================================================

class PromocionEntrada(BaseModel):
    Nombre: str = Field(min_length=2, max_length=150)
    CodigoCupon: str | None = Field(default=None, max_length=50)
    TipoDescuento: str = Field(
        pattern="^(PORCENTAJE|MONTO_FIJO)$"
    )
    ValorDescuento: Decimal = Field(
        gt=0, max_digits=18, decimal_places=2
    )
    MontoMinimoCompra: Decimal = Field(
        default=Decimal("0.00"),
        ge=0,
        max_digits=18,
        decimal_places=2,
    )
    FechaInicio: datetime
    FechaFin: datetime
    ProductosIds: list[int] | None = None
    CategoriasIds: list[int] | None = None


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
    CodigoCupon: str = Field(min_length=1)
    Subtotal: Decimal = Field(ge=0)
    ProductosIds: list[int] | None = None


# ============================================================
# SERIALIZACIÓN
# ============================================================

def serializar_promocion(
    p: Promocion,
    db: Session,
) -> dict[str, Any]:

    prods = (
        db.query(PromocionProducto)
        .filter(
            PromocionProducto.PromocionId == p.PromocionId
        )
        .all()
    )

    cats = (
        db.query(PromocionCategoria)
        .filter(
            PromocionCategoria.PromocionId == p.PromocionId
        )
        .all()
    )

    return {
        "PromocionId": p.PromocionId,
        "Nombre": p.Nombre,
        "CodigoCupon": p.CodigoCupon,
        "TipoDescuento": p.TipoDescuento,
        "ValorDescuento": str(p.ValorDescuento),
        "MontoMinimoCompra": str(p.MontoMinimoCompra),
        "FechaInicio": (
            p.FechaInicio.isoformat()
            if p.FechaInicio else None
        ),
        "FechaFin": (
            p.FechaFin.isoformat()
            if p.FechaFin else None
        ),
        "Estado": p.Estado,
        "ProductosIds": [x.ProductoId for x in prods],
        "CategoriasIds": [x.CategoriaId for x in cats],
    }


# ============================================================
# LISTAR PROMOCIONES
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

    promos = (
        query.order_by(Promocion.PromocionId.desc())
        .offset(desde)
        .limit(limite)
        .all()
    )

    return [serializar_promocion(p, db) for p in promos]


# ============================================================
# OBTENER UNA PROMOCIÓN
# ============================================================

@router.get("/{promocion_id}", summary="Detalle de promoción")
def obtener_promocion(
    promocion_id: int,
    db: Session = Depends(get_db),
):
    promo = db.get(Promocion, promocion_id)

    if not promo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Promoción no encontrada.",
        )

    return serializar_promocion(promo, db)


# ============================================================
# CREAR PROMOCIÓN
# ============================================================

@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    summary="Crear promoción (Admin)",
)
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

    if (
        datos.TipoDescuento == "PORCENTAJE"
        and datos.ValorDescuento > Decimal("100.00")
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El porcentaje no puede superar el 100%.",
        )

    codigo_limpio = (
        datos.CodigoCupon.strip().upper()
        if datos.CodigoCupon else None
    )

    if codigo_limpio:
        existe = (
            db.query(Promocion)
            .filter(Promocion.CodigoCupon == codigo_limpio)
            .first()
        )

        if existe:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Ya existe una promoción con ese código.",
            )

    productos_ids = set(datos.ProductosIds or [])
    categorias_ids = set(datos.CategoriasIds or [])

    try:
        if productos_ids:
            existentes = {
                p.ProductoId
                for p in db.query(Producto)
                .filter(Producto.ProductoId.in_(productos_ids))
                .all()
            }

            if existentes != productos_ids:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Uno o más productos no existen.",
                )

        if categorias_ids:
            existentes = {
                c.CategoriaId
                for c in db.query(Categoria)
                .filter(Categoria.CategoriaId.in_(categorias_ids))
                .all()
            }

            if existentes != categorias_ids:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Una o más categorías no existen.",
                )

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

        for pid in productos_ids:
            db.add(
                PromocionProducto(
                    PromocionId=promo.PromocionId,
                    ProductoId=pid,
                )
            )

        for cid in categorias_ids:
            db.add(
                PromocionCategoria(
                    PromocionId=promo.PromocionId,
                    CategoriaId=cid,
                )
            )

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


# ============================================================
# ACTUALIZAR PROMOCIÓN
# ============================================================

@router.patch("/{promocion_id}", summary="Actualizar promoción (Admin)")
def actualizar_promocion(
    promocion_id: int,
    datos: PromocionActualizacion,
    db: Session = Depends(get_db),
    _user: Any = Depends(require_admin),
):
    promo = db.get(Promocion, promocion_id)

    if not promo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Promoción no encontrada.",
        )

    campos = datos.model_dump(exclude_unset=True)

    if not campos:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="No se enviaron campos.",
        )

    tipo = campos.get("TipoDescuento", promo.TipoDescuento)
    valor = campos.get("ValorDescuento", promo.ValorDescuento)

    if tipo not in ("PORCENTAJE", "MONTO_FIJO"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El tipo de descuento no es válido.",
        )

    if valor is not None and valor <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El valor del descuento debe ser mayor que cero.",
        )

    if (
        tipo == "PORCENTAJE"
        and valor is not None
        and valor > Decimal("100.00")
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El porcentaje no puede superar el 100%.",
        )

    minimo = campos.get("MontoMinimoCompra", promo.MontoMinimoCompra)
    if minimo is not None and minimo < 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El monto mínimo no puede ser negativo.",
        )

    nuevo_inicio = campos.get("FechaInicio", promo.FechaInicio)
    nuevo_fin = campos.get("FechaFin", promo.FechaFin)

    if nuevo_inicio and nuevo_fin and nuevo_fin < nuevo_inicio:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La fecha de fin no puede ser anterior a la de inicio.",
        )

    if "Nombre" in campos and campos["Nombre"] is not None:
        campos["Nombre"] = campos["Nombre"].strip()
        if len(campos["Nombre"]) < 2:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El nombre debe tener al menos 2 caracteres.",
            )

    if "CodigoCupon" in campos:
        codigo = campos["CodigoCupon"]
        codigo = codigo.strip().upper() if codigo else None

        if codigo:
            duplicado = (
                db.query(Promocion)
                .filter(
                    Promocion.CodigoCupon == codigo,
                    Promocion.PromocionId != promocion_id,
                )
                .first()
            )

            if duplicado:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Ya existe una promoción con ese código.",
                )

        campos["CodigoCupon"] = codigo

    try:
        for campo, valor_campo in campos.items():
            setattr(promo, campo, valor_campo)

        db.commit()
        db.refresh(promo)

        return serializar_promocion(promo, db)

    except Exception:
        db.rollback()
        raise


# ============================================================
# DESACTIVAR PROMOCIÓN
# ============================================================

@router.delete("/{promocion_id}", summary="Desactivar promoción (Admin)")
def desactivar_promocion(
    promocion_id: int,
    db: Session = Depends(get_db),
    _user: Any = Depends(require_admin),
):
    promo = db.get(Promocion, promocion_id)

    if not promo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Promoción no encontrada.",
        )

    promo.Estado = False
    db.commit()

    return {"message": "Promoción desactivada correctamente."}


# ============================================================
# VALIDAR CUPÓN
# ============================================================

@router.post(
    "/validar-cupon",
    summary="Validar cupón y calcular descuento",
)
def validar_cupon(
    datos: ValidarCuponEntrada,
    db: Session = Depends(get_db),
):
    codigo = datos.CodigoCupon.strip().upper()
    subtotal = datos.Subtotal.quantize(
        Decimal("0.01"),
        rounding=ROUND_HALF_UP,
    )
    now = datetime.now()

    if not codigo:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ingresa un código de cupón.",
        )

    if subtotal <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El subtotal debe ser mayor que cero.",
        )

    promo = (
        db.query(Promocion)
        .filter(
            Promocion.CodigoCupon == codigo,
            Promocion.Estado == True,
        )
        .first()
    )

    if not promo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cupón no encontrado o inactivo.",
        )

    if (
        not promo.FechaInicio
        or not promo.FechaFin
        or now < promo.FechaInicio
        or now > promo.FechaFin
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El cupón está fuera de su fecha de vigencia.",
        )

    if subtotal < promo.MontoMinimoCompra:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"El subtotal (${subtotal}) no alcanza "
                f"el mínimo requerido (${promo.MontoMinimoCompra})."
            ),
        )

    ids_carrito = set(datos.ProductosIds or [])

    if not ids_carrito:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Agrega productos al carrito antes de aplicar el cupón.",
        )

    productos_carrito = (
        db.query(Producto)
        .filter(Producto.ProductoId.in_(ids_carrito))
        .all()
    )

    if len(productos_carrito) != len(ids_carrito):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uno o más productos del carrito no existen.",
        )

    productos_promo = {
        x.ProductoId
        for x in db.query(PromocionProducto)
        .filter(
            PromocionProducto.PromocionId == promo.PromocionId
        )
        .all()
    }

    categorias_promo = {
        x.CategoriaId
        for x in db.query(PromocionCategoria)
        .filter(
            PromocionCategoria.PromocionId == promo.PromocionId
        )
        .all()
    }

    if productos_promo or categorias_promo:
        aplica = any(
            producto.ProductoId in productos_promo
            or producto.CategoriaId in categorias_promo
            for producto in productos_carrito
        )

        if not aplica:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "Este cupón no aplica a los productos "
                    "o categorías de tu carrito."
                ),
            )

    if promo.TipoDescuento == "PORCENTAJE":
        descuento = (
            subtotal * promo.ValorDescuento / Decimal("100")
        ).quantize(
            Decimal("0.01"),
            rounding=ROUND_HALF_UP,
        )

    elif promo.TipoDescuento == "MONTO_FIJO":
        descuento = min(
            promo.ValorDescuento,
            subtotal,
        ).quantize(
            Decimal("0.01"),
            rounding=ROUND_HALF_UP,
        )

    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El tipo de descuento configurado no es válido.",
        )

    subtotal_con_descuento = max(
        Decimal("0.00"),
        subtotal - descuento,
    ).quantize(
        Decimal("0.01"),
        rounding=ROUND_HALF_UP,
    )

    return {
        "valido": True,
        "promocion_id": promo.PromocionId,
        "nombre": promo.Nombre,
        "codigo_cupon": promo.CodigoCupon,
        "tipo_descuento": promo.TipoDescuento,
        "valor_descuento": str(promo.ValorDescuento),
        "monto_descuento": str(descuento),
        "subtotal_original": str(subtotal),
        "subtotal_con_descuento": str(subtotal_con_descuento),
    }
