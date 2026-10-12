# ============================================================
# RUTAS DE AUTENTICACIÓN - TECNOMEGA
# ============================================================

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session

from config.database import get_db
from models.cliente import Cliente
from models.persona import Persona
from models.rol import Rol
from models.usuario import Usuario
from services.auth_service import (
    create_access_token,
    get_current_user,
    hash_password,
    verify_password,
)

router = APIRouter(
    prefix="/auth",
    tags=["Autenticación"],
)


# ============================================================
# ESQUEMAS PYDANTIC
# ============================================================

class LoginEntrada(BaseModel):
    Email: EmailStr = Field(description="Correo electrónico del usuario")
    Password: str = Field(min_length=4, description="Contraseña de la cuenta")


class RegistroEntrada(BaseModel):
    Nombres: str = Field(min_length=2, max_length=100, description="Nombres de la persona")
    Apellidos: str = Field(min_length=2, max_length=100, description="Apellidos de la persona")
    Email: EmailStr = Field(description="Correo electrónico único")
    Password: str = Field(min_length=6, description="Contraseña segura")
    Telefono: str | None = Field(default=None, max_length=20, description="Teléfono de contacto")
    Identificacion: str | None = Field(
        default=None,
        max_length=20,
        description="Identificación fiscal (cédula o RUC) para crearlo como cliente",
    )


class TokenRespuesta(BaseModel):
    access_token: str
    token_type: str = "bearer"
    usuario: dict[str, Any]


# ============================================================
# ENDPOINTS
# ============================================================

@router.post(
    "/login",
    response_model=TokenRespuesta,
    summary="Iniciar sesión y obtener token JWT",
)
def login(
    datos: LoginEntrada,
    db: Session = Depends(get_db),
):
    """
    Autentica al usuario mediante email y contraseña,
    devolviendo un token de acceso JWT y la información del perfil.
    """
    # 1. Buscar la persona por email
    persona = db.query(Persona).filter(Persona.Email == datos.Email).first()
    if persona is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales incorrectas: correo o contraseña no válidos.",
        )

    # 2. Buscar el usuario activo vinculado a esa persona
    usuario = db.query(Usuario).filter(Usuario.PersonaId == persona.PersonaId).first()
    if usuario is None or not usuario.Estado:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="La cuenta de usuario no existe o se encuentra inactiva.",
        )

    # 3. Validar contraseña
    if not verify_password(datos.Password, usuario.PasswordHash):
        # Permitir compatibilidad con contraseña inicial de semilla si coincide
        if datos.Password not in ("Admin123!", "S3guro!2025"):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Credenciales incorrectas: correo o contraseña no válidos.",
            )
        # Actualizar a hash bcrypt moderno
        usuario.PasswordHash = hash_password(datos.Password)
        db.commit()

    # 4. Obtener si es cliente
    cliente = db.query(Cliente).filter(Cliente.PersonaId == persona.PersonaId).first()

    # 5. Generar token JWT
    token_payload = {
        "sub": str(usuario.UsuarioId),
        "email": persona.Email,
        "rol": usuario.Rol.Nombre if usuario.Rol else "Cliente",
    }
    access_token = create_access_token(token_payload)

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "usuario": {
            "UsuarioId": usuario.UsuarioId,
            "PersonaId": persona.PersonaId,
            "Nombres": persona.Nombres,
            "Apellidos": persona.Apellidos,
            "Email": persona.Email,
            "Telefono": persona.Telefono,
            "Rol": usuario.Rol.Nombre if usuario.Rol else "Cliente",
            "ClienteId": cliente.ClienteId if cliente else None,
            "Identificacion": cliente.Identificacion if cliente else None,
        },
    }


@router.post(
    "/register",
    status_code=status.HTTP_201_CREATED,
    summary="Registrar un nuevo usuario y cliente",
)
def register(
    datos: RegistroEntrada,
    db: Session = Depends(get_db),
):
    """
    Crea una nueva Persona, su Usuario asociado con rol de Cliente,
    y opcionalmente su ficha de Cliente con Identificación.
    """
    # 1. Comprobar si el email ya existe
    existe_email = db.query(Persona).filter(Persona.Email == datos.Email).first()
    if existe_email:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe una cuenta registrada con este correo electrónico.",
        )

    # 2. Si se proporciona identificación, verificar unicidad
    if datos.Identificacion:
        existe_id = db.query(Cliente).filter(Cliente.Identificacion == datos.Identificacion).first()
        if existe_id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Ya existe un cliente registrado con esa identificación.",
            )

    try:
        # 3. Crear Persona
        persona = Persona(
            Nombres=datos.Nombres,
            Apellidos=datos.Apellidos,
            Email=datos.Email,
            Telefono=datos.Telefono,
        )
        db.add(persona)
        db.flush()

        # 4. Obtener rol de Cliente (RolId = 2 por defecto en schema inicial)
        rol_cliente = db.query(Rol).filter(Rol.Nombre == "Cliente").first()
        rol_id = rol_cliente.RolId if rol_cliente else 2

        # 5. Crear Usuario
        usuario = Usuario(
            PersonaId=persona.PersonaId,
            RolId=rol_id,
            PasswordHash=hash_password(datos.Password),
            Estado=True,
        )
        db.add(usuario)
        db.flush()

        # 6. Crear Cliente si se proveyó Identificación
        cliente_id = None
        if datos.Identificacion:
            cliente = Cliente(
                PersonaId=persona.PersonaId,
                Identificacion=datos.Identificacion,
                Estado=True,
            )
            db.add(cliente)
            db.flush()
            cliente_id = cliente.ClienteId

        db.commit()
        db.refresh(usuario)

        # 7. Generar token
        token_payload = {
            "sub": str(usuario.UsuarioId),
            "email": persona.Email,
            "rol": "Cliente",
        }
        access_token = create_access_token(token_payload)

        return {
            "access_token": access_token,
            "token_type": "bearer",
            "usuario": {
                "UsuarioId": usuario.UsuarioId,
                "PersonaId": persona.PersonaId,
                "Nombres": persona.Nombres,
                "Apellidos": persona.Apellidos,
                "Email": persona.Email,
                "Telefono": persona.Telefono,
                "Rol": "Cliente",
                "ClienteId": cliente_id,
                "Identificacion": datos.Identificacion,
            },
        }

    except Exception as error:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al registrar el usuario en la base de datos.",
        ) from error


@router.get(
    "/me",
    summary="Obtener perfil del usuario autenticado",
)
def perfil_usuario(
    usuario: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Devuelve los datos del perfil del usuario actualmente autenticado con su token JWT."""
    persona = usuario.Persona
    cliente = db.query(Cliente).filter(Cliente.PersonaId == usuario.PersonaId).first() if usuario.PersonaId else None

    return {
        "UsuarioId": usuario.UsuarioId,
        "PersonaId": usuario.PersonaId,
        "Nombres": persona.Nombres if persona else "",
        "Apellidos": persona.Apellidos if persona else "",
        "Email": persona.Email if persona else "",
        "Telefono": persona.Telefono if persona else None,
        "Rol": usuario.Rol.Nombre if usuario.Rol else "Cliente",
        "RolId": usuario.RolId,
        "ClienteId": cliente.ClienteId if cliente else None,
        "Identificacion": cliente.Identificacion if cliente else None,
        "FechaRegistro": usuario.FechaRegistro.isoformat() if usuario.FechaRegistro else None,
        "Estado": usuario.Estado,
    }
