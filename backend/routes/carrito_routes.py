# ============================================================
# RUTAS DEL CARRITO DE COMPRAS - TECNOMEGA
# ============================================================

from datetime import datetime
from decimal import Decimal
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from config.database import get_db
from models.carrito import Carrito
from models.carrito_detalle import DetalleCarrito
from models.cliente import Cliente
from models.producto import Producto
from models.usuario import Usuario
from services.auth_service import get_current_user

router = APIRouter(
    prefix="/carrito",
    tags=["Carrito de compras"],
)


# ============================================================
# ESQUEMAS PYDANTIC
# ============================================================

class ItemCarritoEntrada(BaseModel):
    ProductoId: int = Field(gt=0, description="Identificador del producto")
    Cantidad: int = Field(gt=0, description="Cantidad deseada")


class ItemCarritoActualizacion(BaseModel):
    Cantidad: int = Field(gt=0, description="Nueva cantidad")


def obtener_o_crear_carrito(db: Session, usuario: Usuario) -> Carrito:
    """Obtiene el carrito activo del cliente o lo crea si no existe."""
    cliente = db.query(Cliente).filter(Cliente.PersonaId == usuario.PersonaId).first()
    if not cliente:
        # Si el usuario no tiene ficha de cliente, la creamos automáticamente
        cliente = Cliente(
            PersonaId=usuario.PersonaId,
            Identificacion=f"CLI-{usuario.UsuarioId:06d}",
            Estado=True,
        )
        db.add(cliente)
        db.flush()

    carrito = db.query(Carrito).filter(Carrito.ClienteId == cliente.ClienteId).first()
    if not carrito:
        carrito = Carrito(ClienteId=cliente.ClienteId, FechaActualizacion=datetime.now())
        db.add(carrito)
        db.commit()
        db.refresh(carrito)

    return carrito


def serializar_carrito(carrito: Carrito) -> dict[str, Any]:
    items = []
    subtotal_total = Decimal("0.00")

    for d in carrito.Detalles:
        prod = d.Producto
        precio = prod.Precio if prod else Decimal("0.00")
        subtotal_item = precio * d.Cantidad
        subtotal_total += subtotal_item

        items.append({
            "DetalleCarritoId": d.DetalleCarritoId,
            "ProductoId": d.ProductoId,
            "Nombre": prod.Nombre if prod else "",
            "SKU": prod.SKU if prod else "",
            "Precio": str(precio),
            "Cantidad": d.Cantidad,
            "StockDisponible": prod.Stock if prod else 0,
            "Subtotal": str(subtotal_item),
        })

    return {
        "CarritoId": carrito.CarritoId,
        "ClienteId": carrito.ClienteId,
        "FechaActualizacion": carrito.FechaActualizacion.isoformat() if carrito.FechaActualizacion else None,
        "TotalItems": sum(d.Cantidad for d in carrito.Detalles),
        "Subtotal": str(subtotal_total),
        "Items": items,
    }


# ============================================================
# ENDPOINTS
# ============================================================

@router.get("", summary="Obtener el carrito actual")
def ver_carrito(
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_current_user),
):
    carrito = obtener_o_crear_carrito(db, usuario)
    return serializar_carrito(carrito)


@router.post("/items", status_code=status.HTTP_201_CREATED, summary="Agregar un producto al carrito")
def agregar_item(
    datos: ItemCarritoEntrada,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_current_user),
):
    producto = db.get(Producto, datos.ProductoId)
    if not producto or not producto.Estado:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Producto no encontrado o inactivo.")

    if producto.Stock < datos.Cantidad:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Stock insuficiente. Solo quedan {producto.Stock} unidades disponibles.",
        )

    carrito = obtener_o_crear_carrito(db, usuario)

    # Buscar si ya está en el carrito
    detalle = (
        db.query(DetalleCarrito)
        .filter(DetalleCarrito.CarritoId == carrito.CarritoId, DetalleCarrito.ProductoId == datos.ProductoId)
        .first()
    )

    if detalle:
        nueva_cantidad = detalle.Cantidad + datos.Cantidad
        if producto.Stock < nueva_cantidad:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Stock insuficiente para agregar más. Total en carrito superaría las {producto.Stock} unidades.",
            )
        detalle.Cantidad = nueva_cantidad
    else:
        detalle = DetalleCarrito(
            CarritoId=carrito.CarritoId,
            ProductoId=datos.ProductoId,
            Cantidad=datos.Cantidad,
        )
        db.add(detalle)

    carrito.FechaActualizacion = datetime.now()
    db.commit()
    db.refresh(carrito)

    return serializar_carrito(carrito)


@router.patch("/items/{detalle_id}", summary="Actualizar cantidad de un item")
def actualizar_item(
    detalle_id: int,
    datos: ItemCarritoActualizacion,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_current_user),
):
    carrito = obtener_o_crear_carrito(db, usuario)
    detalle = db.get(DetalleCarrito, detalle_id)
    if not detalle or detalle.CarritoId != carrito.CarritoId:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item no encontrado en su carrito.")

    producto = detalle.Producto
    if producto.Stock < datos.Cantidad:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Stock insuficiente. Solo quedan {producto.Stock} unidades disponibles.",
        )

    detalle.Cantidad = datos.Cantidad
    carrito.FechaActualizacion = datetime.now()
    db.commit()
    db.refresh(carrito)

    return serializar_carrito(carrito)


@router.delete("/items/{detalle_id}", summary="Eliminar item del carrito")
def eliminar_item(
    detalle_id: int,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_current_user),
):
    carrito = obtener_o_crear_carrito(db, usuario)
    detalle = db.get(DetalleCarrito, detalle_id)
    if not detalle or detalle.CarritoId != carrito.CarritoId:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item no encontrado en su carrito.")

    db.delete(detalle)
    carrito.FechaActualizacion = datetime.now()
    db.commit()
    db.refresh(carrito)

    return serializar_carrito(carrito)


@router.delete("", summary="Vaciar carrito de compras")
def vaciar_carrito(
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_current_user),
):
    carrito = obtener_o_crear_carrito(db, usuario)
    db.query(DetalleCarrito).filter(DetalleCarrito.CarritoId == carrito.CarritoId).delete()
    carrito.FechaActualizacion = datetime.now()
    db.commit()
    db.refresh(carrito)

    return serializar_carrito(carrito)
