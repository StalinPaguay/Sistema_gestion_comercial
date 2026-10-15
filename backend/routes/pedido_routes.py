# ============================================================
# RUTAS DE PEDIDOS - TECNOMEGA
# ============================================================

from datetime import datetime
from decimal import Decimal
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from config.database import get_db
from models.carrito import Carrito
from models.carrito_detalle import DetalleCarrito
from models.cliente import Cliente
from models.direccion_cliente import DireccionCliente
from models.pedido import Pedido
from models.pedido_detalle import PedidoDetalle
from models.producto import Producto
from models.promocion import Promocion
from models.promocion_categoria import PromocionCategoria
from models.promocion_producto import PromocionProducto
from models.usuario import Usuario
from services.auth_service import get_current_user

router = APIRouter(
    prefix="/pedidos",
    tags=["Pedidos"],
)


# ============================================================
# ESQUEMAS PYDANTIC
# ============================================================

class ItemPedidoEntrada(BaseModel):
    ProductoId: int = Field(gt=0)
    Cantidad: int = Field(gt=0)


class CrearPedidoEntrada(BaseModel):
    DireccionId: int = Field(gt=0, description="Identificador de la dirección de entrega")
    PromocionId: int | None = Field(default=None, description="Identificador de promoción opcional")
    CodigoCupon: str | None = Field(default=None, description="Código de cupón opcional (ej: PROMO10)")
    Items: list[ItemPedidoEntrada] | None = Field(
        default=None,
        description="Lista de productos. Si no se envía o está vacía, se toma del carrito de compras.",
    )


class ActualizarEstadoPedido(BaseModel):
    Estado: str = Field(
        pattern="^(Pendiente|Procesando|Enviado|Entregado|Cancelado)$",
        description="Nuevo estado del pedido",
    )


def serializar_pedido(pedido: Pedido, db: Session) -> dict[str, Any]:
    detalles = db.query(PedidoDetalle).filter(PedidoDetalle.PedidoId == pedido.PedidoId).all()

    items = []
    for d in detalles:
        prod = d.Producto
        items.append({
            "PedidoDetalleId": d.PedidoDetalleId,
            "ProductoId": d.ProductoId,
            "Nombre": prod.Nombre if prod else "",
            "SKU": prod.SKU if prod else "",
            "Cantidad": d.Cantidad,
            "PrecioUnitario": str(d.PrecioUnitario),
            "Subtotal": str(d.Subtotal),
            "Descuento": str(d.Descuento),
            "Total": str(d.Total),
        })

    dir_ = pedido.Direccion
    dir_info = None
    if dir_:
        dir_info = {
            "DireccionId": dir_.DireccionId,
            "Direccion": dir_.Direccion,
            "Ciudad": dir_.Ciudad,
            "Provincia": dir_.Provincia,
            "Referencia": dir_.Referencia,
        }

    cli = pedido.Cliente
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
        "PedidoId": pedido.PedidoId,
        "UsuarioId": pedido.UsuarioId,
        "ClienteId": pedido.ClienteId,
        "Cliente": cli_info,
        "Direccion": dir_info,
        "FechaPedido": pedido.FechaPedido.isoformat() if pedido.FechaPedido else None,
        "Subtotal": str(pedido.Subtotal),
        "Descuento": str(pedido.Descuento),
        "IVA": str(pedido.IVA),
        "Total": str(pedido.Total),
        "Estado": pedido.Estado,
        "Items": items,
    }


# ============================================================
# ENDPOINTS
# ============================================================

@router.get("", summary="Listar pedidos")
def listar_pedidos(
    estado: str | None = Query(default=None),
    cliente_id: int | None = Query(default=None),
    limite: int = Query(default=50, ge=1, le=200),
    desde: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_current_user),
):
    query = db.query(Pedido)

    # Si es cliente, solo puede ver sus propios pedidos
    if usuario.Rol and usuario.Rol.Nombre == "Cliente":
        cliente = db.query(Cliente).filter(Cliente.PersonaId == usuario.PersonaId).first()
        if not cliente:
            return {"total": 0, "pedidos": []}
        query = query.filter(Pedido.ClienteId == cliente.ClienteId)
    elif cliente_id:
        query = query.filter(Pedido.ClienteId == cliente_id)

    if estado:
        query = query.filter(Pedido.Estado == estado)

    total = query.count()
    pedidos = query.order_by(Pedido.PedidoId.desc()).offset(desde).limit(limite).all()

    return {
        "total": total,
        "limite": limite,
        "desde": desde,
        "pedidos": [serializar_pedido(p, db) for p in pedidos],
    }


@router.get("/{pedido_id}", summary="Detalle de un pedido por ID")
def obtener_pedido(
    pedido_id: int,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_current_user),
):
    pedido = db.get(Pedido, pedido_id)
    if not pedido:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pedido no encontrado.")

    # Validar permisos si es Cliente
    if usuario.Rol and usuario.Rol.Nombre == "Cliente":
        cliente = db.query(Cliente).filter(Cliente.PersonaId == usuario.PersonaId).first()
        if not cliente or pedido.ClienteId != cliente.ClienteId:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No autorizado para ver este pedido.")

    return serializar_pedido(pedido, db)


@router.post("", status_code=status.HTTP_201_CREATED, summary="Crear un nuevo pedido")
def crear_pedido(
    datos: CrearPedidoEntrada,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_current_user),
):
    try:
        # 1. Obtener o verificar Cliente
        cliente = db.query(Cliente).filter(Cliente.PersonaId == usuario.PersonaId).first()
        if not cliente:
            cliente = Cliente(
                PersonaId=usuario.PersonaId,
                Identificacion=f"CLI-{usuario.UsuarioId:06d}",
                Estado=True,
            )
            db.add(cliente)
            db.flush()

        # 2. Validar que la dirección pertenezca al cliente
        direccion = db.get(DireccionCliente, datos.DireccionId)
        if not direccion or direccion.ClienteId != cliente.ClienteId:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="La dirección seleccionada no pertenece al cliente.",
            )

        # 3. Determinar items (directos o desde el carrito)
        items_a_procesar: list[tuple[int, int]] = []
        desde_carrito = False

        if datos.Items and len(datos.Items) > 0:
            for it in datos.Items:
                items_a_procesar.append((it.ProductoId, it.Cantidad))
        else:
            # Tomar del carrito
            carrito = db.query(Carrito).filter(Carrito.ClienteId == cliente.ClienteId).first()
            if not carrito or not carrito.Detalles:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="El carrito de compras está vacío. Agregue productos o especifique items.",
                )
            for d in carrito.Detalles:
                items_a_procesar.append((d.ProductoId, d.Cantidad))
            desde_carrito = True

        # 4. Validar stock de cada producto
        detalles_para_crear = []
        subtotal_calculado = Decimal("0.00")

        for prod_id, cant in items_a_procesar:
            prod = db.get(Producto, prod_id)
            if not prod or not prod.Estado:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Producto #{prod_id} no encontrado o inactivo.")
            if prod.Stock < cant:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Stock insuficiente para '{prod.Nombre}'. Disponibles: {prod.Stock}, solicitados: {cant}.",
                )
            subtotal_linea = prod.Precio * cant
            subtotal_calculado += subtotal_linea
            detalles_para_crear.append((prod, cant, subtotal_linea))

        # 5. Validar y calcular descuento promocional si aplica
        promocion_aplicada = None
        if datos.CodigoCupon or datos.PromocionId:
            query_promo = db.query(Promocion).filter(Promocion.Estado == True)
            if datos.CodigoCupon:
                query_promo = query_promo.filter(Promocion.CodigoCupon == datos.CodigoCupon.strip().upper())
            elif datos.PromocionId:
                query_promo = query_promo.filter(Promocion.PromocionId == datos.PromocionId)
            promocion_aplicada = query_promo.first()

            now = datetime.now()
            if not promocion_aplicada:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cupón o promoción no encontrada o inactiva.")
            if now < promocion_aplicada.FechaInicio or now > promocion_aplicada.FechaFin:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="La promoción está fuera de su período de vigencia.")
            if subtotal_calculado < promocion_aplicada.MontoMinimoCompra:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"El subtotal (${subtotal_calculado}) no alcanza el monto mínimo de la promoción (${promocion_aplicada.MontoMinimoCompra}).",
                )

        descuentos_lineas: dict[int, Decimal] = {}
        if promocion_aplicada:
            prods_promo = [x.ProductoId for x in db.query(PromocionProducto).filter(PromocionProducto.PromocionId == promocion_aplicada.PromocionId).all()]
            cats_promo = [x.CategoriaId for x in db.query(PromocionCategoria).filter(PromocionCategoria.PromocionId == promocion_aplicada.PromocionId).all()]

            items_calificantes = []
            subtotal_calificante = Decimal("0.00")

            for prod, cant, subtotal_linea in detalles_para_crear:
                aplica = True
                if prods_promo and prod.ProductoId not in prods_promo:
                    aplica = False
                if cats_promo and prod.CategoriaId not in cats_promo:
                    aplica = False
                if aplica:
                    items_calificantes.append((prod, cant, subtotal_linea))
                    subtotal_calificante += subtotal_linea

            if promocion_aplicada.TipoDescuento == "PORCENTAJE":
                pct = promocion_aplicada.ValorDescuento / Decimal("100.0")
                for prod, cant, subtotal_linea in items_calificantes:
                    desc = round(subtotal_linea * pct, 2)
                    descuentos_lineas[prod.ProductoId] = desc
            elif promocion_aplicada.TipoDescuento == "MONTO_FIJO" and subtotal_calificante > 0:
                monto_fijo = min(promocion_aplicada.ValorDescuento, subtotal_calificante)
                for prod, cant, subtotal_linea in items_calificantes:
                    desc = min(round((subtotal_linea / subtotal_calificante) * monto_fijo, 2), subtotal_linea)
                    descuentos_lineas[prod.ProductoId] = desc

        # 6. Crear cabecera del Pedido con valores iniciales
        # El trigger TR_PedidoDetalle_ActualizarTotales recalculará automáticamente
        pedido = Pedido(
            UsuarioId=usuario.UsuarioId,
            ClienteId=cliente.ClienteId,
            DireccionId=datos.DireccionId,
            PromocionId=promocion_aplicada.PromocionId if promocion_aplicada else None,
            FechaPedido=datetime.now(),
            Subtotal=subtotal_calculado,
            Descuento=Decimal("0.00"),
            IVA=Decimal("0.00"),
            Total=subtotal_calculado,
            Estado="Pendiente",
        )
        db.add(pedido)
        db.flush()

        # 7. Crear detalles del pedido con sus descuentos
        for prod, cant, subtotal_linea in detalles_para_crear:
            desc_linea = descuentos_lineas.get(prod.ProductoId, Decimal("0.00"))
            total_linea = max(Decimal("0.00"), subtotal_linea - desc_linea)
            det = PedidoDetalle(
                PedidoId=pedido.PedidoId,
                ProductoId=prod.ProductoId,
                Cantidad=cant,
                PrecioUnitario=prod.Precio,
                Subtotal=subtotal_linea,
                Descuento=desc_linea,
                Total=total_linea,
            )
            db.add(det)

        db.flush()

        # 8. Si vino del carrito, vaciar el carrito
        if desde_carrito:
            carrito = db.query(Carrito).filter(Carrito.ClienteId == cliente.ClienteId).first()
            if carrito:
                db.query(DetalleCarrito).filter(DetalleCarrito.CarritoId == carrito.CarritoId).delete()

        db.commit()
        db.refresh(pedido)

        return serializar_pedido(pedido, db)

    except HTTPException:
        db.rollback()
        raise
    except Exception as error:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al registrar el pedido: {str(error)}",
        ) from error


@router.patch("/{pedido_id}/estado", summary="Actualizar estado del pedido")
def actualizar_estado(
    pedido_id: int,
    datos: ActualizarEstadoPedido,
    db: Session = Depends(get_db),
    _user: Any = Depends(get_current_user),
):
    pedido = db.get(Pedido, pedido_id)
    if not pedido:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pedido no encontrado.")

    pedido.Estado = datos.Estado
    db.commit()
    db.refresh(pedido)

    return serializar_pedido(pedido, db)
