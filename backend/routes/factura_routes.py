# ============================================================
# RUTAS DE FACTURACIÓN Y PAGOS - TECNOMEGA
# ============================================================

from datetime import datetime
from decimal import Decimal
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
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
from services.auth_service import get_current_user, require_admin
from services.pdf_service import generar_pdf_factura

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
    anio = datetime.now().year
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

    fecha_iso = fac.Fecha.isoformat() if fac.Fecha else None
    pagos = db.query(Pago).filter(Pago.PedidoId == fac.PedidoId).all() if fac.PedidoId else []

    return {
        "FacturaId": fac.FacturaId,
        "Numero": fac.Numero,
        "NumeroFactura": fac.Numero,
        "PedidoId": fac.PedidoId,
        "ClienteId": fac.ClienteId,
        "Cliente": cli_info,
        "Fecha": fecha_iso,
        "FechaEmision": fecha_iso,
        "Subtotal": str(fac.Subtotal),
        "Descuento": str(fac.Descuento),
        "DescuentoTotal": str(fac.Descuento),
        "Impuesto": str(fac.Impuesto),
        "IVA": str(fac.Impuesto),
        "Total": str(fac.Total),
        "Estado": fac.Estado,
        "Pagos": [
            {
                "PagoId": pago.PagoId,
                "MetodoPagoId": pago.MetodoPagoId,
                "MetodoPago": pago.MetodoPago.Nombre if pago.MetodoPago else "",
                "FechaPago": pago.FechaPago.isoformat() if pago.FechaPago else None,
                "Monto": str(pago.Monto),
                "Estado": pago.Estado,
                "TransaccionId": pago.TransaccionId,
            }
            for pago in pagos
        ],
        "Items": items,
        "detalles": items,
    }


def emitir_factura_logica(pedido: Pedido, usuario_id: int, db: Session) -> Factura | None:
    """Emite una factura para un pedido dado, evitando duplicados."""
    pagos_confirmados = db.query(Pago).filter(
        Pago.PedidoId == pedido.PedidoId,
        Pago.Estado == "Pagado",
    ).all()
    total_pagado = sum((pago.Monto for pago in pagos_confirmados), Decimal("0.00"))

    factura_existente = (
        db.query(Factura)
        .filter(Factura.PedidoId == pedido.PedidoId, Factura.Estado != "Anulada")
        .first()
    )
    if factura_existente:
        nuevo_estado = "Pagada" if total_pagado >= factura_existente.Total else "Emitida"
        if factura_existente.Estado != nuevo_estado:
            factura_existente.Estado = nuevo_estado
            db.flush()
        return factura_existente

    detalles_pedido = db.query(PedidoDetalle).filter(PedidoDetalle.PedidoId == pedido.PedidoId).all()
    if not detalles_pedido:
        return None

    numero = generar_numero_factura(db)
    estado_factura = "Pagada" if total_pagado >= pedido.Total else "Emitida"

    factura = Factura(
        Numero=numero,
        PedidoId=pedido.PedidoId,
        ClienteId=pedido.ClienteId,
        UsuarioId=usuario_id,
        Fecha=datetime.now(),
        Subtotal=Decimal("0.00"),
        Descuento=Decimal("0.00"),
        Impuesto=Decimal("0.00"),
        Total=Decimal("0.00"),
        Estado=estado_factura,
    )
    db.add(factura)
    db.flush()

    # Se conserva el cálculo y el porcentaje con que nació el pedido, aunque el IVA
    # general se actualice antes de emitir la factura.
    factura.Subtotal = pedido.Subtotal
    factura.Descuento = pedido.Descuento
    factura.Impuesto = pedido.IVA
    factura.Total = pedido.Total
    db.flush()

    for d in detalles_pedido:
        desc_val = d.Descuento if d.Descuento else Decimal("0.00")
        desc_pct = round((desc_val / d.Subtotal) * Decimal("100.0"), 2) if d.Subtotal > 0 else Decimal("0.00")
        line_total = max(Decimal("0.00"), d.Subtotal - desc_val)
        det_fac = DetalleFactura(
            FacturaId=factura.FacturaId,
            ProductoId=d.ProductoId,
            Cantidad=d.Cantidad,
            PrecioUnitario=d.PrecioUnitario,
            DescuentoPorcentaje=desc_pct,
            DescuentoValor=desc_val,
            Subtotal=d.Subtotal,
            Total=line_total,
        )
        db.add(det_fac)

    db.flush()
    factura.Subtotal = pedido.Subtotal
    factura.Descuento = pedido.Descuento
    factura.Impuesto = pedido.IVA
    factura.Total = pedido.Total
    db.flush()
    db.refresh(factura)
    return factura


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
    # Solo la consulta administrativa puede emitir facturas como efecto secundario.
    pedidos_entregados_sin_fac = []
    if usuario.Rol and usuario.Rol.Nombre == "Administrador":
        pedidos_entregados_sin_fac = (
            db.query(Pedido)
            .filter(
                Pedido.Estado == "Entregado",
                ~Pedido.PedidoId.in_(
                    db.query(Factura.PedidoId).filter(Factura.PedidoId != None, Factura.Estado != "Anulada")
                ),
            )
            .all()
        )
    if pedidos_entregados_sin_fac:
        for ped in pedidos_entregados_sin_fac:
            emitir_factura_logica(ped, ped.UsuarioId, db)
        db.commit()

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


@router.get("/facturas/{factura_id}/pdf", summary="Visualizar o descargar factura en PDF")

def descargar_factura_pdf(
    factura_id: int,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_current_user),
):
    # Buscar la factura solicitada.
    fac = db.get(Factura, factura_id)

    if fac is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Factura no encontrada.",
        )

    # Solo los administradores y clientes autorizados pueden acceder.
    if not usuario.Rol or usuario.Rol.Nombre not in {"Administrador", "Cliente"}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tiene permisos para descargar facturas.",
        )

    # Un cliente solo puede descargar sus propias facturas.
    if usuario.Rol.Nombre == "Cliente":
        cliente = (
            db.query(Cliente)
            .filter(Cliente.PersonaId == usuario.PersonaId)
            .first()
        )

        if cliente is None or fac.ClienteId != cliente.ClienteId:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No autorizado para descargar esta factura.",
            )

    # Generar el PDF.
    pdf_bytes = generar_pdf_factura(fac, db)
    filename = f"Factura-{fac.FacturaId}.pdf"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'inline; filename="{filename}"',
            "Cache-Control": "no-store",
        },
    )



@router.post("/facturas", status_code=status.HTTP_201_CREATED, summary="Emitir factura a partir de un pedido")
def emitir_factura(
    datos: EmitirFacturaEntrada,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(require_admin),
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
        factura = emitir_factura_logica(pedido, usuario.UsuarioId, db)
        if not factura:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No se pudo emitir la factura.")
        db.commit()
        db.refresh(factura)
        return serializar_factura(factura, db)
    except HTTPException:
        db.rollback()
        raise
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
    _user: Any = Depends(require_admin),
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
    _user: Any = Depends(require_admin),
):
    pedido = db.get(Pedido, datos.PedidoId)
    if not pedido:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pedido no encontrado.")

    pagos_previos = db.query(Pago).filter(
        Pago.PedidoId == pedido.PedidoId,
        Pago.Estado == "Pagado",
    ).all()
    total_pagado_previo = sum((pago.Monto for pago in pagos_previos), Decimal("0.00"))
    saldo_pendiente = max(Decimal("0.00"), pedido.Total - total_pagado_previo)
    if datos.Monto > saldo_pendiente:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"El pago supera el saldo pendiente de ${saldo_pendiente}.",
        )

    metodo = db.get(MetodoPago, datos.MetodoPagoId)
    if not metodo or not metodo.Estado:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Método de pago no válido o inactivo.")

    try:
        pago = Pago(
            PedidoId=datos.PedidoId,
            MetodoPagoId=datos.MetodoPagoId,
            FechaPago=datetime.now(),
            Monto=datos.Monto,
            Estado="Pagado",
            TransaccionId=datos.TransaccionId,
        )
        db.add(pago)

        # Si el monto cubre el total del pedido, actualizar el estado del pedido a 'Procesando'
        # Esto además dispara el trigger TR_Pedidos_ActualizarInventario para descontar stock!
        total_pagado = total_pagado_previo + datos.Monto

        if total_pagado >= pedido.Total and pedido.Estado == "Pendiente":
            pedido.Estado = "Procesando"

        factura = db.query(Factura).filter(Factura.PedidoId == pedido.PedidoId, Factura.Estado != "Anulada").first()
        if factura and total_pagado >= factura.Total:
            factura.Estado = "Pagada"

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
