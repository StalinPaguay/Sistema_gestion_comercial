# ============================================================
# RUTAS DE INVENTARIO - TECNOMEGA
# ============================================================

from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from config.database import get_db
from models.movimiento_inventario import MovimientoInventario
from models.producto import Producto
from models.proveedor import Proveedor
from models.tipo_movimiento_inventario import TipoMovimientoInventario
from models.usuario import Usuario
from services.auth_service import get_current_user, require_admin

router = APIRouter(
    prefix="/inventario",
    tags=["Inventario"],
)


# ============================================================
# ESQUEMAS PYDANTIC
# ============================================================

class MovimientoInventarioEntrada(BaseModel):
    ProductoId: int = Field(gt=0, description="Identificador del producto")
    TipoMovimientoId: int = Field(gt=0, description="1: Entrada, 2: Salida, 3: Ajuste")
    Cantidad: int = Field(gt=0, description="Cantidad del movimiento")
    ProveedorId: int | None = Field(default=None, description="Identificador de proveedor opcional para entradas")
    Motivo: str | None = Field(default=None, max_length=200, description="Motivo del movimiento")
    Observacion: str | None = Field(default=None, max_length=500, description="Observaciones adicionales")


# ============================================================
# ENDPOINTS
# ============================================================

@router.get("/tipos-movimiento", summary="Listar tipos de movimiento de inventario")
def listar_tipos_movimiento(db: Session = Depends(get_db)):
    tipos = db.query(TipoMovimientoInventario).all()
    return [
        {
            "TipoMovimientoId": t.TipoMovimientoId,
            "Nombre": t.Nombre,
            "Descripcion": t.Descripcion,
        }
        for t in tipos
    ]


@router.get("/movimientos", summary="Listar movimientos de inventario")
def listar_movimientos(
    producto_id: int | None = Query(default=None),
    tipo_id: int | None = Query(default=None),
    limite: int = Query(default=50, ge=1, le=200),
    desde: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    _user: Any = Depends(get_current_user),
):
    query = db.query(MovimientoInventario)
    if producto_id:
        query = query.filter(MovimientoInventario.ProductoId == producto_id)
    if tipo_id:
        query = query.filter(MovimientoInventario.TipoMovimientoId == tipo_id)

    total = query.count()
    movimientos = (
        query.order_by(MovimientoInventario.MovimientoId.desc())
        .offset(desde)
        .limit(limite)
        .all()
    )

    return {
        "total": total,
        "limite": limite,
        "desde": desde,
        "movimientos": [
            {
                "MovimientoId": m.MovimientoId,
                "ProductoId": m.ProductoId,
                "Producto": m.Producto.Nombre if m.Producto else "",
                "SKU": m.Producto.SKU if m.Producto else "",
                "TipoMovimientoId": m.TipoMovimientoId,
                "TipoMovimiento": m.TipoMovimiento.Nombre if m.TipoMovimiento else "",
                "Cantidad": m.Cantidad,
                "ProveedorId": m.ProveedorId,
                "Proveedor": m.Proveedor.NombreEmpresa if m.Proveedor else None,
                "UsuarioId": m.UsuarioId,
                "Fecha": m.Fecha.isoformat() if m.Fecha else None,
                "Motivo": m.Motivo,
                "Observacion": m.Observacion,
            }
            for m in movimientos
        ],
    }


@router.post("/movimientos", status_code=status.HTTP_201_CREATED, summary="Registrar movimiento de inventario")
def registrar_movimiento(
    datos: MovimientoInventarioEntrada,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(require_admin),
):
    """
    Registra un movimiento de Entrada, Salida o Ajuste.
    El trigger de SQL Server actualiza automáticamente el stock
    y valida existencias.
    """
    producto = db.get(Producto, datos.ProductoId)
    if not producto or not producto.Estado:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Producto no encontrado o inactivo.")

    tipo = db.get(TipoMovimientoInventario, datos.TipoMovimientoId)
    if not tipo:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tipo de movimiento no válido.")

    if datos.ProveedorId:
        prov = db.get(Proveedor, datos.ProveedorId)
        if not prov:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Proveedor no encontrado.")

    # Validar stock previo si es Salida
    if tipo.Nombre == "Salida" and producto.Stock < datos.Cantidad:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Stock insuficiente para salida. Disponible: {producto.Stock}, solicitado: {datos.Cantidad}.",
        )

    try:
        mov = MovimientoInventario(
            ProductoId=datos.ProductoId,
            ProveedorId=datos.ProveedorId,
            UsuarioId=usuario.UsuarioId,
            TipoMovimientoId=datos.TipoMovimientoId,
            Cantidad=datos.Cantidad,
            Fecha=datetime.now(),
            Motivo=datos.Motivo,
            Observacion=datos.Observacion,
        )
        db.add(mov)
        db.commit()
        db.refresh(mov)
        db.refresh(producto)

        return {
            "MovimientoId": mov.MovimientoId,
            "ProductoId": mov.ProductoId,
            "NombreProducto": producto.Nombre,
            "Tipo": tipo.Nombre,
            "Cantidad": mov.Cantidad,
            "NuevoStock": producto.Stock,
            "Fecha": mov.Fecha.isoformat(),
            "Motivo": mov.Motivo,
        }
    except Exception as error:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al registrar movimiento: {str(error)}",
        ) from error


@router.get("/stock-bajo", summary="Consultar productos con stock crítico o bajo")
def productos_stock_bajo(
    db: Session = Depends(get_db),
    _user: Any = Depends(get_current_user),
):
    """Devuelve los productos cuyo stock actual es menor o igual a su stock mínimo."""
    productos = (
        db.query(Producto)
        .filter(Producto.Estado == True, Producto.Stock <= Producto.StockMinimo)
        .order_by(Producto.Stock.asc())
        .all()
    )
    return [
        {
            "ProductoId": p.ProductoId,
            "Nombre": p.Nombre,
            "SKU": p.SKU,
            "Categoria": p.Categoria.Nombre if p.Categoria else "",
            "Marca": p.Marca.Nombre if p.Marca else "",
            "Stock": p.Stock,
            "StockMinimo": p.StockMinimo,
            "Diferencia": p.StockMinimo - p.Stock,
        }
        for p in productos
    ]
