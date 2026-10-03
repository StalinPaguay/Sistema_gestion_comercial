# ============================================================
# CONFIGURACIÓN DE CONEXIÓN CON SQL SERVER
# ============================================================

import os

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.orm import DeclarativeBase, sessionmaker


# ============================================================
# VARIABLES DE ENTORNO
# ============================================================

MSSQL_SA_PASSWORD = os.getenv("MSSQL_SA_PASSWORD")
MSSQL_DATABASE = os.getenv("MSSQL_DATABASE")


# ============================================================
# CADENA DE CONEXIÓN
# ============================================================

DATABASE_URL = (
    "mssql+pyodbc://sa:"
    + MSSQL_SA_PASSWORD
    + "@database:1433/"
    + MSSQL_DATABASE
    + "?driver=ODBC+Driver+18+for+SQL+Server"
    + "&TrustServerCertificate=yes"
    + "&Encrypt=yes"
)


# ============================================================
# CREACIÓN DEL MOTOR DE SQLALCHEMY
# ============================================================

engine = create_engine(
    DATABASE_URL
)

# ============================================================
# CLASE BASE PARA LOS MODELOS
# ============================================================

class Base(DeclarativeBase):
    # Clase base para todos los modelos SQLAlchemy
    pass

# ============================================================
# CREACIÓN DE SESIONES
# ============================================================

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)
# ============================================================
# DEPENDENCIA DE SESIÓN PARA FASTAPI
# ============================================================

def get_db():
    # Crea una nueva sesión de base de datos
    db = SessionLocal()

    try:
        # Entrega la sesión al endpoint que la necesite
        yield db

    finally:
        # Cierra la sesión al finalizar la petición
        db.close()