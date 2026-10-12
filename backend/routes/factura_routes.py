# ============================================================
# RUTAS DE FACTURACIÓN Y PAGOS - TECNOMEGA
# ============================================================

from datetime import datetime
from decimal import Decimal
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from config.database import get_db
from models.cliente import Cliente
from models.detalle_factura import DetalleFactura
from models.factura import Factura
from models.metodo_pago import MetodoPago
from models.pago import Pago
from models.pedido import Pedido
from models.pedido_detalle import PedidoDetalle
from models.usuario import Usuario
from services.auth_service import get_current_user

router = APIRouter(
    tags=["Facturación y Pagos"],
)


# ============================================================
# ESQUEMAS PYDANTIC
# ============================================================

class EmitirFacturaEntrada(BaseModel):
    PedidoId: int = Field(gt=0, description="Identificador del pedido a facturar")


class PagoEntrada(BaseModel):
    PedidoId: int = Field(gt=0, description="Identificador del pedido")
    MetodoPagoId: int = Field(gt=0, description="Identificador del método de pago")
    Monto: Decimal = Field(gt=0, max_digits=18, decimal_places=2, description="Monto del pago")
    TransaccionId: str | None = Field(default=None, max_length=100, description="Referencia bancaria o ID de pasarela")


def generar_numero_factura(db: Session) -> str:
    """Genera un secuencial para la factura (ej: FAC-2026-000001)."""
    anio = datetime.utcnow().year
    ultimo = db.query(Factura).order_by(Factura.FacturaId.desc()).first()
    siguiente_id = (ultimo.FacturaId + 1) if ultimo else 1
    return f"FAC-{anio}-{siguiente_id:06d}"


def serializar_factura(fac: Factura, db: Session) -> dict[str, Any]:
    detalles = db.query(DetalleFactura).filter(DetalleFactura.FacturaId == fac.FacturaId).all()

    items = []
    for d in detalles:
        prod = d.Producto
        items.append({
            "DetalleFacturaId": d.DetalleFacturaId,
            "ProductoId": d.ProductoId,
            "Nombre": prod.Nombre if prod else "",
            "SKU": prod.SKU if prod else "",
            "Cantidad": d.Cantidad,
            "PrecioUnitario": str(d.PrecioUnitario),
            "DescuentoPorcentaje": str(d.DescuentoPorcentaje),
            "DescuentoValor": str(d.DescuentoValor),
            "Subtotal": str(d.Subtotal),
            "Total": str(d.Total),
        })

    cli = fac.Cliente
    cli_info = None
    if cli and cli.Persona:
        cli_info = {
            "ClienteId": cli.ClienteId,
            "Identificacion": cli.Identificacion,
            "Nombres": cli.Persona.Nombres,
            "Apellidos": cli.Persona.Apellidos,
            "Email": cli.Persona.Email,
        }

    return {
        "FacturaId": fac.FacturaId,
        "Numero": fac.Numero,
        "PedidoId": fac.PedidoId,
        "ClienteId": fac.ClienteId,
        "Cliente": cli_info,
        "Fecha": fac.Fecha.isoformat() if fac.Fecha else None,
        "Subtotal": str(fac.Subtotal),
        "Descuento": str(fac.Descuento),
        "Impuesto": str(fac.Impuesto),
        "Total": str(fac.Total),
        "Estado": fac.Estado,
        "Items": items,
    }


# ============================================================
# ENDPOINTS DE FACTURACIÓN
# ============================================================

@router.get("/facturas", summary="Listar facturas")
def listar_facturas(
    cliente_id: int | None = Query(default=None),
    estado: str | None = Query(default=None),
    limite: int = Query(default=50, ge=1, le=200),
    desde: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_current_user),
):
    query = db.query(Factura)

    if usuario.Rol and usuario.Rol.Nombre == "Cliente":
        cliente = db.query(Cliente).filter(Cliente.PersonaId == usuario.PersonaId).first()
        if not cliente:
            return {"total": 0, "facturas": []}
        query = query.filter(Factura.ClienteId == cliente.ClienteId)
    elif cliente_id:
        query = query.filter(Factura.ClienteId == cliente_id)

    if estado:
        query = query.filter(Factura.Estado == estado)

    total = query.count()
    facturas = query.order_by(Factura.FacturaId.desc()).offset(desde).limit(limite).all()

    return {
        "total": total,
        "limite": limite,
        "desde": desde,
        "facturas": [serializar_factura(f, db) for f in facturas],
    }


@router.get("/facturas/{factura_id}", summary="Detalle de una factura por ID")
def obtener_factura(
    factura_id: int,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_current_user),
):
    fac = db.get(Factura, factura_id)
    if not fac:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Factura no encontrada.")

    if usuario.Rol and usuario.Rol.Nombre == "Cliente":
        cliente = db.query(Cliente).filter(Cliente.PersonaId == usuario.PersonaId).first()
        if not cliente or fac.ClienteId != cliente.ClienteId:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No autorizado para ver esta factura.")

    return serializar_factura(fac, db)


@router.post("/facturas", status_code=status.HTTP_201_CREATED, summary="Emitir factura a partir de un pedido")
def emitir_factura(
    datos: EmitirFacturaEntrada,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_current_user),
):
    pedido = db.get(Pedido, datos.PedidoId)
    if not pedido:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pedido no encontrado.")

    # Verificar si ya tiene factura válida
    factura_existente = (
        db.query(Factura)
        .filter(Factura.PedidoId == pedido.PedidoId, Factura.Estado != "Anulada")
        .first()
    )
    if factura_existente:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"El pedido ya tiene una factura activa asignada (#{factura_existente.Numero}).",
        )

    detalles_pedido = db.query(PedidoDetalle).filter(PedidoDetalle.PedidoId == pedido.PedidoId).all()
    if not detalles_pedido:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El pedido no contiene detalles para facturar.",
        )

    try:
        numero = generar_numero_factura(db)

        factura = Factura(
            Numero=numero,
            PedidoId=pedido.PedidoId,
            ClienteId=pedido.ClienteId,
            UsuarioId=usuario.UsuarioId,
            Fecha=datetime.utcnow(),
            Subtotal=Decimal("0.00"),
            Descuento=Decimal("0.00"),
            Impuesto=Decimal("0.00"),
            Total=Decimal("0.00"),
            Estado="Emitida",
        )
        db.add(factura)
        db.flush()

        for d in detalles_pedido:
            det_fac = DetalleFactura(
                FacturaId=factura.FacturaId,
                ProductoId=d.ProductoId,
                Cantidad=d.Cantidad,
                PrecioUnitario=d.PrecioUnitario,
                DescuentoPorcentaje=Decimal("0.00"),
                DescuentoValor=Decimal("0.00"),
                Subtotal=d.Subtotal,
                Total=d.Total,
            )
            db.add(det_fac)

        db.flush()
        db.commit()
        db.refresh(factura)

        return serializar_factura(factura, db)

    except Exception as error:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al emitir factura: {str(error)}",
        ) from error


@router.patch("/facturas/{factura_id}/anular", summary="Anular factura")
def anular_factura(
    factura_id: int,
    db: Session = Depends(get_db),
    _user: Any = Depends(get_current_user),
):
    fac = db.get(Factura, factura_id)
    if not fac:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Factura no encontrada.")

    fac.Estado = "Anulada"
    db.commit()
    db.refresh(fac)
    return serializar_factura(fac, db)


# ============================================================
# ENDPOINTS DE MÉTODOS DE PAGO Y PAGOS
# ============================================================

@router.get("/metodos-pago", summary="Listar métodos de pago disponibles")
def listar_metodos_pago(
    db: Session = Depends(get_db),
):
    metodos = db.query(MetodoPago).filter(MetodoPago.Estado == True).all()
    return [
        {
            "MetodoPagoId": m.MetodoPagoId,
            "Nombre": m.Nombre,
            "Estado": m.Estado,
        }
        for m in metodos
    ]


@router.post("/pagos", status_code=status.HTTP_201_CREATED, summary="Registrar un pago para un pedido")
def registrar_pago(
    datos: PagoEntrada,
    db: Session = Depends(get_db),
    _user: Any = Depends(get_current_user),
):
    pedido = db.get(Pedido, datos.PedidoId)
    if not pedido:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pedido no encontrado.")

    metodo = db.get(MetodoPago, datos.MetodoPagoId)
    if not metodo or not metodo.Estado:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Método de pago no válido o inactivo.")

    try:
        pago = Pago(
            PedidoId=datos.PedidoId,
            MetodoPagoId=datos.MetodoPagoId,
            FechaPago=datetime.utcnow(),
            Monto=datos.Monto,
            Estado="Pagado",
            TransaccionId=datos.TransaccionId,
        )
        db.add(pago)

        # Si el monto cubre el total del pedido, actualizar el estado del pedido a 'Procesando'
        # Esto además dispara el trigger TR_Pedidos_ActualizarInventario para descontar stock!
        pagos_previos = db.query(Pago).filter(Pago.PedidoId == pedido.PedidoId, Pago.Estado == "Pagado").all()
        total_pagado = sum((p.Monto for p in pagos_previos), Decimal("0.00")) + datos.Monto

        if total_pagado >= pedido.Total and pedido.Estado == "Pendiente":
            pedido.Estado = "Procesando"

        db.commit()
        db.refresh(pago)

        return {
            "PagoId": pago.PagoId,
            "PedidoId": pago.PedidoId,
            "MetodoPago": metodo.Nombre,
            "FechaPago": pago.FechaPago.isoformat(),
            "Monto": str(pago.Monto),
            "Estado": pago.Estado,
            "TransaccionId": pago.TransaccionId,
            "TotalPedido": str(pedido.Total),
            "TotalPagado": str(total_pagado),
            "EstadoPedido": pedido.Estado,
        }
    except Exception as error:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al registrar pago: {str(error)}",
        ) from error


@router.get("/pagos/pedido/{pedido_id}", summary="Consultar pagos de un pedido")
def pagos_por_pedido(
    pedido_id: int,
    db: Session = Depends(get_db),
    _user: Any = Depends(get_current_user),
):
    pagos = db.query(Pago).filter(Pago.PedidoId == pedido_id).all()
    return [
        {
            "PagoId": p.PagoId,
            "PedidoId": p.PedidoId,
            "MetodoPagoId": p.MetodoPagoId,
            "MetodoPago": p.MetodoPago.Nombre if p.MetodoPago else "",
            "FechaPago": p.FechaPago.isoformat() if p.FechaPago else None,
            "Monto": str(p.Monto),
            "Estado": p.Estado,
            "TransaccionId": p.TransaccionId,
        }
        for p in pagos
    ]
