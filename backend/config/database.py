# ============================================================
# CONFIGURACIÓN DE CONEXIÓN CON SQL SERVER
# Proyecto: TECNOMEGA
# Descripción:
#   Configura la conexión con SQL Server mediante SQLAlchemy,
#   administra el motor de conexión y proporciona sesiones
#   de base de datos para los endpoints de FastAPI.
# ============================================================

import os

from sqlalchemy import URL, create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker


# ============================================================
# 1. LECTURA Y VALIDACIÓN DE VARIABLES DE ENTORNO
# ============================================================
# Las credenciales y el nombre de la base de datos se obtienen
# del entorno para evitar escribir información sensible
# directamente en el código fuente.

MSSQL_SA_PASSWORD = os.getenv("MSSQL_SA_PASSWORD")
MSSQL_DATABASE = os.getenv("MSSQL_DATABASE")

# Verifica que la contraseña esté configurada.
if not MSSQL_SA_PASSWORD:
    raise RuntimeError(
        "La variable de entorno MSSQL_SA_PASSWORD "
        "no está configurada."
    )

# Verifica que el nombre de la base de datos esté configurado.
if not MSSQL_DATABASE:
    raise RuntimeError(
        "La variable de entorno MSSQL_DATABASE "
        "no está configurada."
    )


# ============================================================
# 2. CONSTRUCCIÓN DE LA URL DE CONEXIÓN
# ============================================================
# URL.create() permite gestionar correctamente los caracteres
# especiales de la contraseña, sin concatenarla manualmente.
#
# Se conserva la configuración existente de SQL Server:
#   - Servidor: database
#   - Puerto: 1433
#   - Usuario: sa
#   - Control del certificado: TrustServerCertificate
#   - Cifrado: Encrypt
#
# Nota:
# TrustServerCertificate=yes cifra la conexión, pero no valida
# la identidad del servidor mediante una cadena de confianza.

DATABASE_URL = URL.create(
    drivername="mssql+pyodbc",
    username="sa",
    password=MSSQL_SA_PASSWORD,
    host="database",
    port=1433,
    database=MSSQL_DATABASE,
    query={
        "driver": "ODBC Driver 18 for SQL Server",
        "TrustServerCertificate": "yes",
        "Encrypt": "yes",
    },
)


# ============================================================
# 3. CREACIÓN DEL MOTOR DE SQLALCHEMY
# ============================================================
# El motor administra las conexiones que utiliza la aplicación
# para comunicarse con SQL Server.
#
# pool_pre_ping=True comprueba que una conexión siga disponible
# antes de reutilizarla desde el pool de conexiones.
#
# Este proceso no crea tablas ni modifica registros.

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
)


# ============================================================
# 4. CLASE BASE DE LOS MODELOS ORM
# ============================================================
# Todos los modelos declarativos del proyecto heredan de Base.
# Esta clase permite que SQLAlchemy registre sus tablas y
# configure sus mapeos y relaciones ORM.
#
# La definición de Base no ejecuta operaciones de creación
# ni modificación del esquema de SQL Server.

class Base(DeclarativeBase):
    """Clase base común para los modelos ORM de TECNOMEGA."""

    pass


# ============================================================
# 5. CONFIGURACIÓN DE SESIONES
# ============================================================
# SessionLocal es la fábrica de sesiones utilizada por FastAPI.
#
# autocommit=False:
#   Las transacciones requieren confirmación explícita.
#
# autoflush=False:
#   Evita el envío automático de cambios pendientes antes
#   de determinadas consultas ORM.
#
# bind=engine:
#   Asocia las sesiones con el motor de SQL Server.

SessionLocal = sessionmaker(
    bind=engine,
    autocommit=False,
    autoflush=False,
)


# ============================================================
# 6. DEPENDENCIA DE SESIÓN PARA FASTAPI
# ============================================================
# get_db() proporciona una sesión a cada endpoint que la
# solicita mediante Depends(get_db).
#
# El bloque finally garantiza el cierre de la sesión incluso
# si ocurre una excepción durante el procesamiento.
#
# El cierre libera los recursos asociados a la sesión; no
# sustituye el commit() o rollback() de las transacciones.

def get_db():
    """Proporciona una sesión de SQLAlchemy y la cierra al finalizar."""

    db = SessionLocal()

    try:
        # Entrega la sesión al endpoint que la necesita.
        yield db

    finally:
        # Libera los recursos de la sesión.
        db.close()
