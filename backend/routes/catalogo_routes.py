# ============================================================
# RUTAS DEL CATÁLOGO COMERCIAL - TECNOMEGA
# Archivo: backend/routes/catalogo_routes.py
#
# Descripción:
#   Expone los endpoints REST para administrar:
#       - Productos
#       - Categorías
#       - Marcas
#
# Características:
#   - Validación de datos mediante Pydantic.
#   - Acceso a SQL Server mediante SQLAlchemy.
#   - Paginación para el listado de productos.
#   - Validación de claves foráneas.
#   - Manejo de errores de integridad de la base de datos.
#   - Eliminación lógica mediante el campo Estado.
#   - Validación de solicitudes PATCH vacías.
#
# IMPORTANTE:
#   Este módulo no crea tablas ni modifica el esquema.
#   Las operaciones de escritura deben probarse primero
#   en una base de datos aislada.
# ============================================================

from decimal import Decimal
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from config.database import get_db
from models.categoria import Categoria
from models.marca import Marca
from models.producto import Producto
from services.auth_service import require_admin


# ============================================================
# 1. CONFIGURACIÓN DEL ROUTER
# ============================================================

# Este router se registra en main.py mediante include_router().
# No se define un prefijo general porque los endpoints utilizan
# las rutas /productos, /categorias y /marcas.
router = APIRouter(
    tags=["Catálogo comercial"],
)


# ============================================================
# 2. ESQUEMAS PYDANTIC: CATEGORÍAS
# ============================================================

class CategoriaEntrada(BaseModel):
    """
    Datos obligatorios para crear una categoría.

    Nombre debe ser único en la tabla Categorias.
    Descripcion admite un valor nulo.
    Estado se establece como activo por defecto.
    """

    Nombre: str = Field(
        min_length=1,
        max_length=100,
        description="Nombre de la categoría",
    )
    Descripcion: str | None = Field(
        default=None,
        max_length=500,
        description="Descripción opcional de la categoría",
    )
    Estado: bool = Field(
        default=True,
        description="Indica si la categoría está activa",
    )


class CategoriaActualizacion(BaseModel):
    """
    Campos opcionales para actualizar una categoría.

    Al utilizar model_dump(exclude_unset=True), solo se procesan
    los campos enviados explícitamente en la solicitud.
    """

    model_config = ConfigDict(extra="forbid")

    Nombre: str | None = Field(
        default=None,
        max_length=100,
        description="Nuevo nombre de la categoría",
    )
    Descripcion: str | None = Field(
        default=None,
        max_length=500,
        description="Nueva descripción",
    )
    Estado: bool | None = Field(
        default=None,
        description="Nuevo estado de la categoría",
    )


# ============================================================
# 3. ESQUEMAS PYDANTIC: MARCAS
# ============================================================

class MarcaEntrada(BaseModel):
    """Datos necesarios para crear una marca."""

    Nombre: str = Field(
        min_length=1,
        max_length=100,
        description="Nombre de la marca",
    )
    Estado: bool = Field(
        default=True,
        description="Indica si la marca está activa",
    )


class MarcaActualizacion(BaseModel):
    """Campos opcionales para actualizar una marca."""

    model_config = ConfigDict(extra="forbid")

    Nombre: str | None = Field(
        default=None,
        max_length=100,
        description="Nuevo nombre de la marca",
    )
    Estado: bool | None = Field(
        default=None,
        description="Nuevo estado de la marca",
    )


# ============================================================
# 4. ESQUEMAS PYDANTIC: PRODUCTOS
# ============================================================

class ProductoEntrada(BaseModel):
    """
    Datos para crear un producto.

    Las columnas corresponden al esquema existente de SQL Server:
        ProductoId, CategoriaId, MarcaId, SKU, Nombre,
        Descripcion, Precio, Stock, StockMinimo y Estado.

    No se incluye ProveedorId ni FechaCreacion porque no son
    columnas de la tabla Productos que revisamos.
    """

    CategoriaId: int = Field(
        gt=0,
        description="Identificador de la categoría",
    )
    MarcaId: int = Field(
        gt=0,
        description="Identificador de la marca",
    )
    SKU: str = Field(
        min_length=1,
        max_length=50,
        description="Código único del producto",
    )
    Nombre: str = Field(
        min_length=1,
        max_length=150,
        description="Nombre comercial del producto",
    )
    Descripcion: str | None = Field(
        default=None,
        max_length=500,
        description="Descripción opcional",
    )
    Precio: Decimal = Field(
        ge=0,
        max_digits=18,
        decimal_places=2,
        description="Precio del producto",
    )
    Stock: int = Field(
        ge=0,
        description="Cantidad disponible",
    )
    StockMinimo: int = Field(
        ge=0,
        description="Nivel mínimo de inventario",
    )
    Estado: bool = Field(
        default=True,
        description="Indica si el producto está activo",
    )


class ProductoActualizacion(BaseModel):
    """
    Campos opcionales para actualizar un producto.

    Se utiliza ConfigDict(extra='forbid') para rechazar propiedades
    que no pertenecen al esquema de actualización.
    """

    model_config = ConfigDict(extra="forbid")

    CategoriaId: int | None = Field(
        default=None,
        gt=0,
        description="Nueva categoría",
    )
    MarcaId: int | None = Field(
        default=None,
        gt=0,
        description="Nueva marca",
    )
    SKU: str | None = Field(
        default=None,
        max_length=50,
        description="Nuevo código único",
    )
    Nombre: str | None = Field(
        default=None,
        max_length=150,
        description="Nuevo nombre",
    )
    Descripcion: str | None = Field(
        default=None,
        max_length=500,
        description="Nueva descripción",
    )
    Precio: Decimal | None = Field(
        default=None,
        ge=0,
        max_digits=18,
        decimal_places=2,
        description="Nuevo precio",
    )
    Stock: int | None = Field(
        default=None,
        ge=0,
        description="Nuevo stock",
    )
    StockMinimo: int | None = Field(
        default=None,
        ge=0,
        description="Nuevo stock mínimo",
    )
    Estado: bool | None = Field(
        default=None,
        description="Nuevo estado",
    )


# ============================================================
# 5. FUNCIONES AUXILIARES DE VALIDACIÓN
# ============================================================

def validar_campos_actualizacion(
    cambios: dict[str, Any],
    campos_que_admiten_null: set[str],
) -> None:
    """
    Comprueba que los campos no anulables no reciban None.

    Los campos que admiten NULL deben indicarse expresamente
    en campos_que_admiten_null.

    Nota:
        La comprobación de un diccionario vacío se realiza
        en cada endpoint PATCH, antes de llamar a esta función.
    """

    for campo, valor in cambios.items():
        if valor is None and campo not in campos_que_admiten_null:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"El campo '{campo}' no admite valores nulos.",
            )

        # Los campos de texto obligatorios no deben quedar vacíos
        # ni contener únicamente espacios.
        if isinstance(valor, str) and not valor.strip():
            if campo in {"Nombre", "SKU"}:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=f"El campo '{campo}' no puede estar vacío.",
                )

        # Evita valores negativos en los campos de inventario.
        if campo in {"Stock", "StockMinimo"}:
            if isinstance(valor, int) and valor < 0:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=f"El campo '{campo}' no puede ser negativo.",
                )

        # Los precios negativos no son válidos para este catálogo.
        if campo == "Precio" and valor is not None and valor < 0:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="El precio no puede ser negativo.",
            )


def validar_categoria(db: Session, categoria_id: int) -> Categoria:
    """
    Comprueba que la categoría indicada exista.

    Esta versión comprueba existencia, no actividad. Si las reglas
    del negocio prohíben asignar categorías inactivas, debe añadirse
    esa condición expresamente.
    """

    categoria = db.get(Categoria, categoria_id)

    if categoria is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="La categoría indicada no existe.",
        )

    return categoria


def validar_marca(db: Session, marca_id: int) -> Marca:
    """Comprueba que la marca indicada exista."""

    marca = db.get(Marca, marca_id)

    if marca is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="La marca indicada no existe.",
        )

    return marca


# ============================================================
# 6. FUNCIONES AUXILIARES DE SERIALIZACIÓN
# ============================================================

def producto_json(producto: Producto) -> dict[str, Any]:
    """
    Convierte un producto ORM en un diccionario serializable.

    Los importes Decimal se convierten a texto para evitar
    pérdida de precisión en la representación del precio.
    """

    return {
        "ProductoId": producto.ProductoId,
        "CategoriaId": producto.CategoriaId,
        "MarcaId": producto.MarcaId,
        "SKU": producto.SKU,
        "Nombre": producto.Nombre,
        "Descripcion": producto.Descripcion,
        "Precio": (
            str(producto.Precio)
            if producto.Precio is not None
            else None
        ),
        "Stock": producto.Stock,
        "StockMinimo": producto.StockMinimo,
        "Estado": producto.Estado,
    }


def categoria_json(categoria: Categoria) -> dict[str, Any]:
    """Convierte una categoría ORM en un diccionario."""

    return {
        "CategoriaId": categoria.CategoriaId,
        "Nombre": categoria.Nombre,
        "Descripcion": categoria.Descripcion,
        "Estado": categoria.Estado,
    }


def marca_json(marca: Marca) -> dict[str, Any]:
    """Convierte una marca ORM en un diccionario."""

    return {
        "MarcaId": marca.MarcaId,
        "Nombre": marca.Nombre,
        "Estado": marca.Estado,
    }


# ============================================================
# 7. FUNCIÓN AUXILIAR PARA GUARDAR TRANSACCIONES
# ============================================================

def guardar(db: Session, registro: Any) -> None:
    """
    Agrega y confirma un registro dentro de una transacción.

    Si SQL Server rechaza la operación, se revierte la transacción
    para que la sesión no quede en estado fallido.

    Los conflictos de integridad se devuelven como HTTP 409.
    Otros errores de SQLAlchemy se devuelven como HTTP 500.

    No se exponen detalles internos ni credenciales al cliente.
    """

    try:
        db.add(registro)
        db.commit()
        db.refresh(registro)

    except IntegrityError as error:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "No se pudo guardar el registro porque existe "
                "un conflicto de integridad o una clave duplicada."
            ),
        ) from error

    except SQLAlchemyError as error:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Ocurrió un error al guardar el registro.",
        ) from error


# ============================================================
# 8. ENDPOINTS DE PRODUCTOS
# ============================================================

@router.get("/productos")
def listar_productos(
    limite: int = Query(default=100, ge=1, le=500),
    desde: int = Query(default=0, ge=0),
    incluir_inactivos: bool = Query(default=False),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """
    Lista productos con paginación.

    Parámetros:
        limite: máximo de registros devueltos, entre 1 y 500.
        desde: cantidad de registros que se omiten.
        incluir_inactivos: incluye productos con Estado=False.

    Ejemplo:
        GET /productos?limite=50&desde=0
    """

    consulta = db.query(Producto)

    if not incluir_inactivos:
        consulta = consulta.filter(Producto.Estado == True)  # noqa: E712

    total = consulta.count()

    productos = (
        consulta
        .order_by(Producto.ProductoId)
        .offset(desde)
        .limit(limite)
        .all()
    )

    return {
        "total": total,
        "limite": limite,
        "desde": desde,
        "productos": [
            producto_json(producto)
            for producto in productos
        ],
    }


@router.get("/productos/{producto_id}")
def obtener_producto(
    producto_id: int,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Obtiene un producto por su identificador."""

    producto = db.get(Producto, producto_id)

    if producto is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Producto no encontrado.",
        )

    return producto_json(producto)


@router.post(
    "/productos",
    status_code=status.HTTP_201_CREATED,
)
def crear_producto(
    datos: ProductoEntrada,
    db: Session = Depends(get_db),
    _user: Any = Depends(require_admin),
) -> dict[str, Any]:
    """Crea un producto después de validar sus referencias."""

    validar_categoria(db, datos.CategoriaId)
    validar_marca(db, datos.MarcaId)

    producto = Producto(**datos.model_dump())

    guardar(db, producto)

    return producto_json(producto)


@router.patch("/productos/{producto_id}")
def actualizar_producto(
    producto_id: int,
    datos: ProductoActualizacion,
    db: Session = Depends(get_db),
    _user: Any = Depends(require_admin),
) -> dict[str, Any]:
    """
    Actualiza únicamente los campos enviados por el cliente.

    Una solicitud PATCH vacía devuelve HTTP 422 y no ejecuta
    ninguna operación de escritura.
    """

    producto = db.get(Producto, producto_id)

    if producto is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Producto no encontrado.",
        )

    cambios = datos.model_dump(exclude_unset=True)

    # No aceptar solicitudes PATCH sin campos para actualizar.
    if not cambios:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Debe enviar al menos un campo para actualizar.",
        )

    validar_campos_actualizacion(
        cambios,
        campos_que_admiten_null={"Descripcion"},
    )

    # Si cambia la categoría, debe existir en la base de datos.
    if "CategoriaId" in cambios:
        validar_categoria(db, cambios["CategoriaId"])

    # Si cambia la marca, debe existir en la base de datos.
    if "MarcaId" in cambios:
        validar_marca(db, cambios["MarcaId"])

    # Aplica exclusivamente los campos incluidos en la petición.
    for campo, valor in cambios.items():
        setattr(producto, campo, valor)

    guardar(db, producto)

    return producto_json(producto)


@router.delete("/productos/{producto_id}")
def eliminar_producto(
    producto_id: int,
    db: Session = Depends(get_db),
    _user: Any = Depends(require_admin),
) -> dict[str, str]:
    """
    Realiza una eliminación lógica del producto.

    El registro permanece en SQL Server; únicamente se establece
    Estado=False. No se utiliza db.delete().
    """

    producto = db.get(Producto, producto_id)

    if producto is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Producto no encontrado.",
        )

    if not producto.Estado:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="El producto ya está inactivo.",
        )

    producto.Estado = False

    guardar(db, producto)

    return {
        "message": "Producto desactivado correctamente.",
    }


# ============================================================
# 9. ENDPOINTS DE CATEGORÍAS
# ============================================================

@router.get("/categorias")
def listar_categorias(
    limite: int = Query(default=100, ge=1, le=500),
    desde: int = Query(default=0, ge=0),
    incluir_inactivas: bool = Query(default=False),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Lista las categorías con soporte de paginación."""

    consulta = db.query(Categoria)

    if not incluir_inactivas:
        consulta = consulta.filter(Categoria.Estado == True)  # noqa: E712

    total = consulta.count()
    categorias = (
        consulta
        .order_by(Categoria.CategoriaId)
        .offset(desde)
        .limit(limite)
        .all()
    )

    return {
        "total": total,
        "limite": limite,
        "desde": desde,
        "categorias": [
            categoria_json(categoria)
            for categoria in categorias
        ],
    }


@router.get("/categorias/{categoria_id}")
def obtener_categoria(
    categoria_id: int,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Obtiene una categoría por su identificador."""

    categoria = db.get(Categoria, categoria_id)

    if categoria is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Categoría no encontrada.",
        )

    return categoria_json(categoria)


@router.post(
    "/categorias",
    status_code=status.HTTP_201_CREATED,
)
def crear_categoria(
    datos: CategoriaEntrada,
    db: Session = Depends(get_db),
    _user: Any = Depends(require_admin),
) -> dict[str, Any]:
    """Crea una categoría."""

    categoria = Categoria(**datos.model_dump())

    guardar(db, categoria)

    return categoria_json(categoria)


@router.patch("/categorias/{categoria_id}")
def actualizar_categoria(
    categoria_id: int,
    datos: CategoriaActualizacion,
    db: Session = Depends(get_db),
    _user: Any = Depends(require_admin),
) -> dict[str, Any]:
    """
    Actualiza los campos enviados de una categoría.

    Una petición vacía se rechaza con HTTP 422.
    """

    categoria = db.get(Categoria, categoria_id)

    if categoria is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Categoría no encontrada.",
        )

    cambios = datos.model_dump(exclude_unset=True)

    # Rechaza un PATCH vacío antes de modificar el registro.
    if not cambios:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Debe enviar al menos un campo para actualizar.",
        )

    validar_campos_actualizacion(
        cambios,
        campos_que_admiten_null={"Descripcion"},
    )

    for campo, valor in cambios.items():
        setattr(categoria, campo, valor)

    guardar(db, categoria)

    return categoria_json(categoria)


@router.delete("/categorias/{categoria_id}")
def eliminar_categoria(
    categoria_id: int,
    db: Session = Depends(get_db),
    _user: Any = Depends(require_admin),
) -> dict[str, str]:
    """
    Desactiva una categoría sin borrar físicamente el registro.
    """

    categoria = db.get(Categoria, categoria_id)

    if categoria is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Categoría no encontrada.",
        )

    if not categoria.Estado:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="La categoría ya está inactiva.",
        )

    categoria.Estado = False

    guardar(db, categoria)

    return {
        "message": "Categoría desactivada correctamente.",
    }


# ============================================================
# 10. ENDPOINTS DE MARCAS
# ============================================================

@router.get("/marcas")
def listar_marcas(
    limite: int = Query(default=100, ge=1, le=500),
    desde: int = Query(default=0, ge=0),
    incluir_inactivas: bool = Query(default=False),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Lista las marcas con soporte de paginación."""

    consulta = db.query(Marca)

    if not incluir_inactivas:
        consulta = consulta.filter(Marca.Estado == True)  # noqa: E712

    total = consulta.count()
    marcas = (
        consulta
        .order_by(Marca.MarcaId)
        .offset(desde)
        .limit(limite)
        .all()
    )

    return {
        "total": total,
        "limite": limite,
        "desde": desde,
        "marcas": [
            marca_json(marca)
            for marca in marcas
        ],
    }


@router.get("/marcas/{marca_id}")
def obtener_marca(
    marca_id: int,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Obtiene una marca por su identificador."""

    marca = db.get(Marca, marca_id)

    if marca is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Marca no encontrada.",
        )

    return marca_json(marca)


@router.post(
    "/marcas",
    status_code=status.HTTP_201_CREATED,
)
def crear_marca(
    datos: MarcaEntrada,
    db: Session = Depends(get_db),
    _user: Any = Depends(require_admin),
) -> dict[str, Any]:
    """Crea una marca."""

    marca = Marca(**datos.model_dump())

    guardar(db, marca)

    return marca_json(marca)


@router.patch("/marcas/{marca_id}")
def actualizar_marca(
    marca_id: int,
    datos: MarcaActualizacion,
    db: Session = Depends(get_db),
    _user: Any = Depends(require_admin),
) -> dict[str, Any]:
    """
    Actualiza una marca.

    Una solicitud PATCH sin campos devuelve HTTP 422 y no
    intenta guardar ni confirmar una transacción.
    """

    marca = db.get(Marca, marca_id)

    if marca is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Marca no encontrada.",
        )

    cambios = datos.model_dump(exclude_unset=True)

    # Rechaza solicitudes vacías antes de modificar la marca.
    if not cambios:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Debe enviar al menos un campo para actualizar.",
        )

    validar_campos_actualizacion(
        cambios,
        campos_que_admiten_null=set(),
    )

    for campo, valor in cambios.items():
        setattr(marca, campo, valor)

    guardar(db, marca)

    return marca_json(marca)


@router.delete("/marcas/{marca_id}")
def eliminar_marca(
    marca_id: int,
    db: Session = Depends(get_db),
    _user: Any = Depends(require_admin),
) -> dict[str, str]:
    """
    Desactiva una marca sin borrar físicamente el registro.
    """

    marca = db.get(Marca, marca_id)

    if marca is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Marca no encontrada.",
        )

    if not marca.Estado:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="La marca ya está inactiva.",
        )

    marca.Estado = False

    guardar(db, marca)

    return {
        "message": "Marca desactivada correctamente.",
    }
