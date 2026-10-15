# ============================================================
# RUTAS DE INTERACCIÓN: FAVORITOS Y RESEÑAS - TECNOMEGA
# ============================================================

from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import AliasChoices, BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session

from config.database import get_db
from models.favorito import Favorito
from models.producto import Producto
from models.resena import Resena
from models.usuario import Usuario
from services.auth_service import get_current_user

router = APIRouter(
    tags=["Favoritos y Reseñas"],
)


# ============================================================
# ESQUEMAS PYDANTIC
# ============================================================

class ResenaEntrada(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    Calificacion: int = Field(
        ge=1,
        le=5,
        description="Puntuación de 1 a 5 estrellas",
        validation_alias=AliasChoices("Calificacion", "calificacion", "rating"),
    )
    Comentario: str | None = Field(
        default=None,
        max_length=1000,
        description="Opinión del producto",
        validation_alias=AliasChoices("Comentario", "comentario", "comment"),
    )


class ResenaActualizacion(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    Calificacion: int | None = Field(
        default=None,
        ge=1,
        le=5,
        description="Puntuación de 1 a 5 estrellas",
        validation_alias=AliasChoices("Calificacion", "calificacion", "rating"),
    )
    Comentario: str | None = Field(
        default=None,
        max_length=1000,
        description="Opinión del producto",
        validation_alias=AliasChoices("Comentario", "comentario", "comment"),
    )


# ============================================================
# ENDPOINTS DE FAVORITOS (WISHLIST)
# ============================================================

@router.get("/favoritos", summary="Listar productos favoritos del usuario")
def listar_favoritos(
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_current_user),
):
    favoritos = (
        db.query(Favorito)
        .filter(Favorito.UsuarioId == usuario.UsuarioId)
        .order_by(Favorito.FavoritoId.desc())
        .all()
    )

    return [
        {
            "FavoritoId": f.FavoritoId,
            "ProductoId": f.ProductoId,
            "Nombre": f.Producto.Nombre if f.Producto else "",
            "SKU": f.Producto.SKU if f.Producto else "",
            "Precio": str(f.Producto.Precio) if f.Producto else "0.00",
            "Stock": f.Producto.Stock if f.Producto else 0,
            "Fecha": f.Fecha.isoformat() if f.Fecha else None,
        }
        for f in favoritos
    ]


@router.post("/favoritos/{producto_id}", status_code=status.HTTP_201_CREATED, summary="Agregar producto a favoritos")
def agregar_favorito(
    producto_id: int,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_current_user),
):
    producto = db.get(Producto, producto_id)
    if not producto or not producto.Estado:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Producto no encontrado o inactivo.")

    existe = (
        db.query(Favorito)
        .filter(Favorito.UsuarioId == usuario.UsuarioId, Favorito.ProductoId == producto_id)
        .first()
    )
    if existe:
        return {"message": "El producto ya se encuentra en sus favoritos.", "FavoritoId": existe.FavoritoId}

    fav = Favorito(
        UsuarioId=usuario.UsuarioId,
        ProductoId=producto_id,
        Fecha=datetime.now(),
    )
    db.add(fav)
    db.commit()
    db.refresh(fav)

    return {"message": "Producto agregado a favoritos correctamente.", "FavoritoId": fav.FavoritoId}


@router.delete("/favoritos/{producto_id}", summary="Quitar producto de favoritos")
def eliminar_favorito(
    producto_id: int,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_current_user),
):
    fav = (
        db.query(Favorito)
        .filter(Favorito.UsuarioId == usuario.UsuarioId, Favorito.ProductoId == producto_id)
        .first()
    )
    if not fav:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Producto no está en favoritos.")

    db.delete(fav)
    db.commit()
    return {"message": "Producto retirado de favoritos."}


# ============================================================
# ENDPOINTS DE RESEÑAS DE PRODUCTOS
# ============================================================

@router.get("/productos/{producto_id}/resenas", summary="Listar reseñas de un producto")
def listar_resenas(
    producto_id: int,
    db: Session = Depends(get_db),
):
    producto = db.get(Producto, producto_id)
    if not producto:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Producto no encontrado.")

    resenas = (
        db.query(Resena)
        .filter(Resena.ProductoId == producto_id, Resena.Estado == True)
        .order_by(Resena.ResenaId.desc())
        .all()
    )

    promedio = (
        round(sum(r.Calificacion for r in resenas) / len(resenas), 1)
        if len(resenas) > 0
        else 0.0
    )

    return {
        "ProductoId": producto_id,
        "TotalResenas": len(resenas),
        "CalificacionPromedio": promedio,
        "Resenas": [
            {
                "ResenaId": r.ResenaId,
                "Usuario": f"{r.Usuario.Persona.Nombres} {r.Usuario.Persona.Apellidos}" if r.Usuario and r.Usuario.Persona else "Usuario",
                "Calificacion": r.Calificacion,
                "Comentario": r.Comentario,
                "Fecha": r.Fecha.isoformat() if r.Fecha else None,
            }
            for r in resenas
        ],
    }


@router.post("/productos/{producto_id}/resenas", status_code=status.HTTP_201_CREATED, summary="Agregar reseña y calificación a un producto")
def agregar_resena(
    producto_id: int,
    datos: ResenaEntrada,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_current_user),
):
    producto = db.get(Producto, producto_id)
    if not producto or not producto.Estado:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Producto no encontrado o inactivo.")

    # Si el usuario ya calificó este producto, actualizamos la reseña existente
    resena = (
        db.query(Resena)
        .filter(Resena.UsuarioId == usuario.UsuarioId, Resena.ProductoId == producto_id)
        .first()
    )
    if resena:
        resena.Calificacion = datos.Calificacion
        resena.Comentario = datos.Comentario
        resena.Fecha = datetime.now()
        resena.Estado = True
        db.commit()
        db.refresh(resena)
        return {
            "ResenaId": resena.ResenaId,
            "ProductoId": resena.ProductoId,
            "Calificacion": resena.Calificacion,
            "Comentario": resena.Comentario,
            "Fecha": resena.Fecha.isoformat(),
        }

    resena = Resena(
        UsuarioId=usuario.UsuarioId,
        ProductoId=producto_id,
        Calificacion=datos.Calificacion,
        Comentario=datos.Comentario,
        Fecha=datetime.now(),
        Estado=True,
    )
    db.add(resena)
    db.commit()
    db.refresh(resena)

    return {
        "ResenaId": resena.ResenaId,
        "ProductoId": resena.ProductoId,
        "Calificacion": resena.Calificacion,
        "Comentario": resena.Comentario,
        "Fecha": resena.Fecha.isoformat(),
    }


@router.put("/productos/{producto_id}/resenas", summary="Actualizar o recalificar reseña de un producto")
@router.patch("/productos/{producto_id}/resenas", summary="Actualizar o recalificar reseña de un producto")
def actualizar_resena_producto(
    producto_id: int,
    datos: ResenaActualizacion,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_current_user),
):
    producto = db.get(Producto, producto_id)
    if not producto or not producto.Estado:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Producto no encontrado o inactivo.")

    resena = (
        db.query(Resena)
        .filter(Resena.UsuarioId == usuario.UsuarioId, Resena.ProductoId == producto_id)
        .first()
    )
    if not resena:
        if datos.Calificacion is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Debe proporcionar una calificación de 1 a 5 estrellas para crear la reseña.",
            )
        resena = Resena(
            UsuarioId=usuario.UsuarioId,
            ProductoId=producto_id,
            Calificacion=datos.Calificacion,
            Comentario=datos.Comentario,
            Fecha=datetime.now(),
            Estado=True,
        )
        db.add(resena)
    else:
        if datos.Calificacion is not None:
            resena.Calificacion = datos.Calificacion
        if datos.Comentario is not None:
            resena.Comentario = datos.Comentario
        resena.Fecha = datetime.now()
        resena.Estado = True

    db.commit()
    db.refresh(resena)

    return {
        "ResenaId": resena.ResenaId,
        "ProductoId": resena.ProductoId,
        "Calificacion": resena.Calificacion,
        "Comentario": resena.Comentario,
        "Fecha": resena.Fecha.isoformat(),
    }


@router.get("/productos/{producto_id}/resenas/me", summary="Obtener mi reseña de un producto")
def obtener_mi_resena_producto(
    producto_id: int,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_current_user),
):
    resena = (
        db.query(Resena)
        .filter(Resena.UsuarioId == usuario.UsuarioId, Resena.ProductoId == producto_id, Resena.Estado == True)
        .first()
    )
    if not resena:
        return {"resena": None}

    return {
        "ResenaId": resena.ResenaId,
        "ProductoId": resena.ProductoId,
        "Calificacion": resena.Calificacion,
        "Comentario": resena.Comentario,
        "Fecha": resena.Fecha.isoformat(),
    }


@router.put("/resenas/{resena_id}", summary="Actualizar reseña por ID")
@router.patch("/resenas/{resena_id}", summary="Actualizar reseña por ID")
def actualizar_resena_por_id(
    resena_id: int,
    datos: ResenaActualizacion,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_current_user),
):
    resena = db.get(Resena, resena_id)
    if not resena or not resena.Estado:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reseña no encontrada.")

    es_admin = bool(usuario.Rol and usuario.Rol.Nombre in ("Administrador", "Admin"))
    if resena.UsuarioId != usuario.UsuarioId and not es_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tiene permiso para modificar esta reseña.",
        )

    if datos.Calificacion is not None:
        resena.Calificacion = datos.Calificacion
    if datos.Comentario is not None:
        resena.Comentario = datos.Comentario

    resena.Fecha = datetime.now()
    db.commit()
    db.refresh(resena)

    return {
        "ResenaId": resena.ResenaId,
        "ProductoId": resena.ProductoId,
        "Calificacion": resena.Calificacion,
        "Comentario": resena.Comentario,
        "Fecha": resena.Fecha.isoformat(),
    }


@router.delete("/resenas/{resena_id}", summary="Eliminar reseña por ID")
def eliminar_resena_por_id(
    resena_id: int,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_current_user),
):
    resena = db.get(Resena, resena_id)
    if not resena:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reseña no encontrada.")

    es_admin = bool(usuario.Rol and usuario.Rol.Nombre in ("Administrador", "Admin"))
    if resena.UsuarioId != usuario.UsuarioId and not es_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tiene permiso para eliminar esta reseña.",
        )

    resena.Estado = False
    db.commit()
    return {"message": "Reseña eliminada correctamente."}
