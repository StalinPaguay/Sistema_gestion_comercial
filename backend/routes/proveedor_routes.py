# ============================================================
# RUTAS DE PROVEEDORES - TECNOMEGA
# ============================================================

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session

from config.database import get_db
from models.proveedor import Proveedor
from services.auth_service import get_current_user, require_admin

router = APIRouter(
    prefix="/proveedores",
    tags=["Proveedores"],
)


# ============================================================
# ESQUEMAS PYDANTIC
# ============================================================

class ProveedorEntrada(BaseModel):
    NombreEmpresa: str = Field(min_length=2, max_length=150)
    RUC: str = Field(min_length=10, max_length=20)
    Contacto: str | None = Field(default=None, max_length=100)
    Telefono: str | None = Field(default=None, max_length=20)
    Email: str | None = Field(default=None, max_length=150)
    Direccion: str | None = Field(default=None, max_length=250)


class ProveedorActualizacion(BaseModel):
    model_config = ConfigDict(extra="forbid")
    NombreEmpresa: str | None = None
    RUC: str | None = None
    Contacto: str | None = None
    Telefono: str | None = None
    Email: str | None = None
    Direccion: str | None = None
    Estado: bool | None = None


def serializar_proveedor(p: Proveedor) -> dict[str, Any]:
    return {
        "ProveedorId": p.ProveedorId,
        "NombreEmpresa": p.NombreEmpresa,
        "RUC": p.RUC,
        "Contacto": p.Contacto,
        "Telefono": p.Telefono,
        "Email": p.Email,
        "Direccion": p.Direccion,
        "Estado": p.Estado,
    }


# ============================================================
# ENDPOINTS
# ============================================================

@router.get("", summary="Listar proveedores")
def listar_proveedores(
    limite: int = Query(default=50, ge=1, le=200),
    desde: int = Query(default=0, ge=0),
    buscar: str | None = Query(default=None),
    incluir_inactivos: bool = Query(default=False),
    db: Session = Depends(get_db),
    _user: Any = Depends(get_current_user),
):
    query = db.query(Proveedor)
    if not incluir_inactivos:
        query = query.filter(Proveedor.Estado == True)
    if buscar:
        termino = f"%{buscar}%"
        query = query.filter(
            (Proveedor.NombreEmpresa.ilike(termino))
            | (Proveedor.RUC.ilike(termino))
            | (Proveedor.Contacto.ilike(termino))
        )

    total = query.count()
    proveedores = query.order_by(Proveedor.NombreEmpresa.asc()).offset(desde).limit(limite).all()

    return {
        "total": total,
        "limite": limite,
        "desde": desde,
        "proveedores": [serializar_proveedor(p) for p in proveedores],
    }


@router.get("/{proveedor_id}", summary="Obtener detalle de proveedor por ID")
def obtener_proveedor(
    proveedor_id: int,
    db: Session = Depends(get_db),
    _user: Any = Depends(get_current_user),
):
    prov = db.get(Proveedor, proveedor_id)
    if not prov:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Proveedor no encontrado.")
    return serializar_proveedor(prov)


@router.post("", status_code=status.HTTP_201_CREATED, summary="Crear nuevo proveedor")
def crear_proveedor(
    datos: ProveedorEntrada,
    db: Session = Depends(get_db),
    _user: Any = Depends(require_admin),
):
    if db.query(Proveedor).filter(Proveedor.RUC == datos.RUC).first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe un proveedor registrado con ese RUC.",
        )

    prov = Proveedor(**datos.model_dump(), Estado=True)
    db.add(prov)
    db.commit()
    db.refresh(prov)
    return serializar_proveedor(prov)


@router.patch("/{proveedor_id}", summary="Actualizar proveedor")
def actualizar_proveedor(
    proveedor_id: int,
    datos: ProveedorActualizacion,
    db: Session = Depends(get_db),
    _user: Any = Depends(require_admin),
):
    prov = db.get(Proveedor, proveedor_id)
    if not prov:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Proveedor no encontrado.")

    campos = datos.model_dump(exclude_unset=True)
    if not campos:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="No se enviaron campos.")

    for campo, valor in campos.items():
        setattr(prov, campo, valor)

    db.commit()
    db.refresh(prov)
    return serializar_proveedor(prov)


@router.delete("/{proveedor_id}", summary="Desactivar proveedor (baja lógica)")
def desactivar_proveedor(
    proveedor_id: int,
    db: Session = Depends(get_db),
    _user: Any = Depends(require_admin),
):
    prov = db.get(Proveedor, proveedor_id)
    if not prov:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Proveedor no encontrado.")

    prov.Estado = False
    db.commit()
    return {"message": "Proveedor desactivado correctamente."}
