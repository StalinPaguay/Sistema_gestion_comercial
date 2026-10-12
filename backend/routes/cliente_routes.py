# ============================================================
# RUTAS DE CLIENTES Y DIRECCIONES - TECNOMEGA
# ============================================================

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session

from config.database import get_db
from models.cliente import Cliente
from models.direccion_cliente import DireccionCliente
from models.persona import Persona
from services.auth_service import get_current_user

router = APIRouter(
    prefix="/clientes",
    tags=["Clientes y Direcciones"],
)


# ============================================================
# ESQUEMAS PYDANTIC
# ============================================================

class DireccionEntrada(BaseModel):
    Provincia: str | None = Field(default=None, max_length=100)
    Ciudad: str | None = Field(default=None, max_length=100)
    Direccion: str = Field(min_length=3, max_length=250)
    Referencia: str | None = Field(default=None, max_length=250)
    CodigoPostal: str | None = Field(default=None, max_length=20)
    EsPrincipal: bool = Field(default=False)


class DireccionActualizacion(BaseModel):
    model_config = ConfigDict(extra="forbid")
    Provincia: str | None = None
    Ciudad: str | None = None
    Direccion: str | None = None
    Referencia: str | None = None
    CodigoPostal: str | None = None
    EsPrincipal: bool | None = None
    Estado: bool | None = None


class ClienteCreacion(BaseModel):
    Nombres: str = Field(min_length=2, max_length=100)
    Apellidos: str = Field(min_length=2, max_length=100)
    Identificacion: str = Field(min_length=5, max_length=20)
    Email: str | None = Field(default=None, max_length=150)
    Telefono: str | None = Field(default=None, max_length=20)


class ClienteActualizacion(BaseModel):
    model_config = ConfigDict(extra="forbid")
    Nombres: str | None = None
    Apellidos: str | None = None
    Email: str | None = None
    Telefono: str | None = None
    Estado: bool | None = None


def serializar_cliente(cliente: Cliente) -> dict[str, Any]:
    persona = cliente.Persona
    return {
        "ClienteId": cliente.ClienteId,
        "PersonaId": cliente.PersonaId,
        "Identificacion": cliente.Identificacion,
        "Nombres": persona.Nombres if persona else "",
        "Apellidos": persona.Apellidos if persona else "",
        "Email": persona.Email if persona else None,
        "Telefono": persona.Telefono if persona else None,
        "Estado": cliente.Estado,
        "FechaRegistro": cliente.FechaRegistro.isoformat() if cliente.FechaRegistro else None,
    }


def serializar_direccion(dir_: DireccionCliente) -> dict[str, Any]:
    return {
        "DireccionId": dir_.DireccionId,
        "ClienteId": dir_.ClienteId,
        "Provincia": dir_.Provincia,
        "Ciudad": dir_.Ciudad,
        "Direccion": dir_.Direccion,
        "Referencia": dir_.Referencia,
        "CodigoPostal": dir_.CodigoPostal,
        "EsPrincipal": dir_.EsPrincipal,
        "Estado": dir_.Estado,
    }


# ============================================================
# ENDPOINTS DE CLIENTES
# ============================================================

@router.get("", summary="Listar clientes paginados")
def listar_clientes(
    limite: int = Query(default=50, ge=1, le=200),
    desde: int = Query(default=0, ge=0),
    buscar: str | None = Query(default=None),
    db: Session = Depends(get_db),
    _user: Any = Depends(get_current_user),
):
    query = db.query(Cliente).join(Persona)
    if buscar:
        termino = f"%{buscar}%"
        query = query.filter(
            (Cliente.Identificacion.ilike(termino))
            | (Persona.Nombres.ilike(termino))
            | (Persona.Apellidos.ilike(termino))
            | (Persona.Email.ilike(termino))
        )

    total = query.count()
    clientes = query.order_by(Cliente.ClienteId.desc()).offset(desde).limit(limite).all()

    return {
        "total": total,
        "limite": limite,
        "desde": desde,
        "clientes": [serializar_cliente(c) for c in clientes],
    }


@router.get("/{cliente_id}", summary="Obtener detalle de cliente por ID")
def obtener_cliente(
    cliente_id: int,
    db: Session = Depends(get_db),
    _user: Any = Depends(get_current_user),
):
    cliente = db.get(Cliente, cliente_id)
    if not cliente:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cliente no encontrado.")
    return serializar_cliente(cliente)


@router.post("", status_code=status.HTTP_201_CREATED, summary="Crear un nuevo cliente")
def crear_cliente(
    datos: ClienteCreacion,
    db: Session = Depends(get_db),
    _user: Any = Depends(get_current_user),
):
    # Validar cédula única
    if db.query(Cliente).filter(Cliente.Identificacion == datos.Identificacion).first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe un cliente con esa identificación.",
        )

    try:
        # Crear Persona
        persona = Persona(
            Nombres=datos.Nombres,
            Apellidos=datos.Apellidos,
            Email=datos.Email,
            Telefono=datos.Telefono,
        )
        db.add(persona)
        db.flush()

        # Crear Cliente
        cliente = Cliente(
            PersonaId=persona.PersonaId,
            Identificacion=datos.Identificacion,
            Estado=True,
        )
        db.add(cliente)
        db.commit()
        db.refresh(cliente)

        return serializar_cliente(cliente)
    except Exception as error:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al registrar el cliente.",
        ) from error


@router.patch("/{cliente_id}", summary="Actualizar datos del cliente")
def actualizar_cliente(
    cliente_id: int,
    datos: ClienteActualizacion,
    db: Session = Depends(get_db),
    _user: Any = Depends(get_current_user),
):
    cliente = db.get(Cliente, cliente_id)
    if not cliente:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cliente no encontrado.")

    campos = datos.model_dump(exclude_unset=True)
    if not campos:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="No se enviaron campos.")

    persona = cliente.Persona
    if "Nombres" in campos:
        persona.Nombres = campos["Nombres"]
    if "Apellidos" in campos:
        persona.Apellidos = campos["Apellidos"]
    if "Email" in campos:
        persona.Email = campos["Email"]
    if "Telefono" in campos:
        persona.Telefono = campos["Telefono"]
    if "Estado" in campos:
        cliente.Estado = campos["Estado"]

    db.commit()
    db.refresh(cliente)
    return serializar_cliente(cliente)


# ============================================================
# ENDPOINTS DE DIRECCIONES
# ============================================================

@router.get("/{cliente_id}/direcciones", summary="Listar direcciones de un cliente")
def listar_direcciones(
    cliente_id: int,
    db: Session = Depends(get_db),
    _user: Any = Depends(get_current_user),
):
    cliente = db.get(Cliente, cliente_id)
    if not cliente:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cliente no encontrado.")

    direcciones = (
        db.query(DireccionCliente)
        .filter(DireccionCliente.ClienteId == cliente_id, DireccionCliente.Estado == True)
        .all()
    )
    return [serializar_direccion(d) for d in direcciones]


@router.post("/{cliente_id}/direcciones", status_code=status.HTTP_201_CREATED, summary="Agregar dirección a un cliente")
def agregar_direccion(
    cliente_id: int,
    datos: DireccionEntrada,
    db: Session = Depends(get_db),
    _user: Any = Depends(get_current_user),
):
    cliente = db.get(Cliente, cliente_id)
    if not cliente:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cliente no encontrado.")

    # Si es principal, desmarcar anteriores
    if datos.EsPrincipal:
        db.query(DireccionCliente).filter(
            DireccionCliente.ClienteId == cliente_id,
            DireccionCliente.EsPrincipal == True,
        ).update({"EsPrincipal": False})

    nueva_dir = DireccionCliente(
        ClienteId=cliente_id,
        Provincia=datos.Provincia,
        Ciudad=datos.Ciudad,
        Direccion=datos.Direccion,
        Referencia=datos.Referencia,
        CodigoPostal=datos.CodigoPostal,
        EsPrincipal=datos.EsPrincipal,
        Estado=True,
    )
    db.add(nueva_dir)
    db.commit()
    db.refresh(nueva_dir)

    return serializar_direccion(nueva_dir)


@router.patch("/direcciones/{direccion_id}", summary="Actualizar dirección")
def actualizar_direccion(
    direccion_id: int,
    datos: DireccionActualizacion,
    db: Session = Depends(get_db),
    _user: Any = Depends(get_current_user),
):
    dir_ = db.get(DireccionCliente, direccion_id)
    if not dir_:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dirección no encontrada.")

    campos = datos.model_dump(exclude_unset=True)
    if not campos:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="No se enviaron campos.")

    if campos.get("EsPrincipal"):
        db.query(DireccionCliente).filter(
            DireccionCliente.ClienteId == dir_.ClienteId,
            DireccionCliente.EsPrincipal == True,
        ).update({"EsPrincipal": False})

    for campo, valor in campos.items():
        setattr(dir_, campo, valor)

    db.commit()
    db.refresh(dir_)
    return serializar_direccion(dir_)


@router.delete("/direcciones/{direccion_id}", summary="Desactivar dirección")
def desactivar_direccion(
    direccion_id: int,
    db: Session = Depends(get_db),
    _user: Any = Depends(get_current_user),
):
    dir_ = db.get(DireccionCliente, direccion_id)
    if not dir_:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dirección no encontrada.")

    dir_.Estado = False
    dir_.EsPrincipal = False
    db.commit()
    return {"message": "Dirección desactivada correctamente."}
