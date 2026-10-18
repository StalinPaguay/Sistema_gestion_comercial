# ============================================================
# SERVICIO DE AUTENTICACIÓN Y SEGURIDAD JWT - TECNOMEGA
# ============================================================

from datetime import datetime, timedelta, timezone
import os
from typing import Any

import bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
import jwt
from sqlalchemy.orm import Session

from config.database import get_db
from models.cliente import Cliente
from models.persona import Persona
from models.rol import Rol
from models.usuario import Usuario

# Configuración JWT
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "tecnomega_super_secret_jwt_key_2025_commercial_systems_secure")
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24

security_bearer = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    """Genera un hash seguro para la contraseña con bcrypt."""
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Compara una contraseña en texto plano contra su hash bcrypt."""
    try:
        return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
    except Exception:
        return False


def create_access_token(data: dict[str, Any], expires_delta: timedelta | None = None) -> str:
    """Genera un token JWT firmado con fecha de expiración."""
    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)

    # El claim 'sub' debe ser un string según el estándar JWT
    if "sub" in to_encode:
        to_encode["sub"] = str(to_encode["sub"])

    to_encode.update({"iat": now, "exp": expire})
    return jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


def decode_access_token(token: str) -> dict[str, Any]:
    """Decodifica y valida la firma y expiración de un token JWT."""
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="El token de acceso ha expirado.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token de acceso inválido.",
            headers={"WWW-Authenticate": "Bearer"},
        )


def get_current_user(
    auth: HTTPAuthorizationCredentials | None = Depends(security_bearer),
    db: Session = Depends(get_db),
) -> Usuario:
    """
    Dependencia de FastAPI para obtener el usuario autenticado
    a partir del header Authorization: Bearer <token>.
    """
    if auth is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No se proporcionó un token de autorización.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = decode_access_token(auth.credentials)
    usuario_id_str = payload.get("sub")
    if not usuario_id_str:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token no contiene información de identidad válida.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        usuario_id = int(usuario_id_str)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Identificador de usuario inválido.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    usuario = db.get(Usuario, usuario_id)
    if usuario is None or not usuario.Estado:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="El usuario no existe o se encuentra inactivo.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return usuario


def require_admin(usuario: Usuario = Depends(get_current_user)) -> Usuario:
    """Verifica que el usuario autenticado tenga el rol de Administrador."""
    if not usuario.Rol or usuario.Rol.Nombre != "Administrador":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acceso restringido: requiere privilegios de Administrador.",
        )
    return usuario
