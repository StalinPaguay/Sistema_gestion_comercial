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

    try:
        # 5. Crear cabecera del Pedido con valores iniciales
        # El trigger TR_PedidoDetalle_ActualizarTotales recalculará con IVA
        pedido = Pedido(
            UsuarioId=usuario.UsuarioId,
            ClienteId=cliente.ClienteId,
            DireccionId=datos.DireccionId,
            PromocionId=datos.PromocionId,
            FechaPedido=datetime.utcnow(),
            Subtotal=subtotal_calculado,
            Descuento=Decimal("0.00"),
            IVA=Decimal("0.00"),
            Total=subtotal_calculado,
            Estado="Pendiente",
        )
        db.add(pedido)
        db.flush()

        # 6. Crear detalles del pedido
        for prod, cant, subtotal_linea in detalles_para_crear:
            det = PedidoDetalle(
                PedidoId=pedido.PedidoId,
                ProductoId=prod.ProductoId,
                Cantidad=cant,
                PrecioUnitario=prod.Precio,
                Subtotal=subtotal_linea,
                Descuento=Decimal("0.00"),
                Total=subtotal_linea,
            )
            db.add(det)

        db.flush()

        # 7. Si vino del carrito, vaciar el carrito
        if desde_carrito:
            carrito = db.query(Carrito).filter(Carrito.ClienteId == cliente.ClienteId).first()
            if carrito:
                db.query(DetalleCarrito).filter(DetalleCarrito.CarritoId == carrito.CarritoId).delete()

        db.commit()
        db.refresh(pedido)

        return serializar_pedido(pedido, db)

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
