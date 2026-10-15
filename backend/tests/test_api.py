# ============================================================
# TECNOMEGA - PRUEBAS AUTOMATIZADAS DE INTEGRACIÓN Y AUDITORÍA
# Archivo: backend/tests/test_api.py
# ============================================================

from datetime import datetime, timedelta
from decimal import Decimal
import uuid
import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


# ------------------------------------------------------------
# 1. SALUD Y BASE DE DATOS
# ------------------------------------------------------------

def test_salud_api():
    """Valida que la raíz del API responda con estado Operativo."""
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["estado"] == "Operativo"
    assert "version" in data


def test_conexion_base_datos():
    """Valida la conectividad directa con SQL Server TECNOMEGA."""
    response = client.get("/database")
    assert response.status_code == 200
    assert response.json()["base_de_datos"] == "TECNOMEGA"


# ------------------------------------------------------------
# 2. AUTENTICACIÓN, REGISTRO Y ROLES
# ------------------------------------------------------------

def test_autenticacion_login_y_me():
    """Valida login de administrador, generación de JWT y endpoint /auth/me."""
    login_res = client.post("/auth/login", json={
        "Email": "admin@tecnomega.com",
        "Password": "Admin123!",
    })
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]
    assert token is not None

    headers = {"Authorization": f"Bearer {token}"}
    me_res = client.get("/auth/me", headers=headers)
    assert me_res.status_code == 200
    me_data = me_res.json()
    assert me_data["Rol"] == "Administrador"
    assert me_data["Email"] == "admin@tecnomega.com"


def test_login_credenciales_invalidas():
    """Valida que credenciales inválidas retornen 401 Unauthorized."""
    res = client.post("/auth/login", json={
        "Email": "no_existe@tecnomega.com",
        "Password": "clave_incorrecta",
    })
    assert res.status_code == 401


def test_registro_nuevo_cliente_y_login():
    """Valida registro dinámico de cliente con hash seguro y posterior login."""
    unique_suffix = uuid.uuid4().hex[:6]
    test_email = f"audit_user_{unique_suffix}@tecnomega.com"
    test_cedula = f"09{uuid.uuid4().int % 100000000:08d}"

    reg_res = client.post("/auth/register", json={
        "Nombres": "Auditoria",
        "Apellidos": "Prueba",
        "Email": test_email,
        "Password": "PasswordAudit123!",
        "Telefono": "0991234567",
        "Identificacion": test_cedula,
    })
    assert reg_res.status_code == 201
    reg_data = reg_res.json()
    assert "access_token" in reg_data

    # Login con el usuario creado
    login_res = client.post("/auth/login", json={
        "Email": test_email,
        "Password": "PasswordAudit123!",
    })
    assert login_res.status_code == 200
    cliente_token = login_res.json()["access_token"]

    headers_cliente = {"Authorization": f"Bearer {cliente_token}"}
    me_res = client.get("/auth/me", headers=headers_cliente)
    assert me_res.status_code == 200
    assert me_res.json()["Rol"] == "Cliente"


def test_cambiar_password_flujo_completo():
    """Valida el cambio seguro de contraseña, rechazo de errores y login posterior."""
    unique_suffix = uuid.uuid4().hex[:6]
    test_email = f"pwd_user_{unique_suffix}@tecnomega.com"
    clave_original = "PasswordOriginal123!"
    clave_nueva = "PasswordNueva456!"

    # 1. Registrar usuario de prueba
    reg_res = client.post("/auth/register", json={
        "Nombres": "Usuario",
        "Apellidos": "Password",
        "Email": test_email,
        "Password": clave_original,
        "Identificacion": f"08{uuid.uuid4().int % 100000000:08d}",
    })
    assert reg_res.status_code == 201
    token = reg_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Sin token -> 401 Unauthorized
    res_no_auth = client.patch("/auth/cambiar-password", json={
        "currentPassword": clave_original,
        "newPassword": clave_nueva,
    })
    assert res_no_auth.status_code == 401

    # 3. Contraseña actual incorrecta -> 400 Bad Request
    res_bad_current = client.patch("/auth/cambiar-password", headers=headers, json={
        "currentPassword": "ClaveIncorrecta!",
        "newPassword": clave_nueva,
    })
    assert res_bad_current.status_code == 400
    assert "actual no es correcta" in res_bad_current.json()["detail"]

    # 4. Misma contraseña -> 400 Bad Request
    res_same = client.patch("/auth/cambiar-password", headers=headers, json={
        "currentPassword": clave_original,
        "newPassword": clave_original,
    })
    assert res_same.status_code == 400
    assert "diferente" in res_same.json()["detail"] or "idéntica" in res_same.json()["detail"]

    # 5. Cambio exitoso utilizando camelCase (lo que envía el frontend Angular)
    res_ok = client.patch("/auth/cambiar-password", headers=headers, json={
        "currentPassword": clave_original,
        "newPassword": clave_nueva,
    })
    assert res_ok.status_code == 200
    assert "exitosa" in res_ok.json()["message"]

    # 6. Validar que la clave antigua ya NO funciona
    res_login_old = client.post("/auth/login", json={
        "Email": test_email,
        "Password": clave_original,
    })
    assert res_login_old.status_code == 401

    # 7. Validar que la nueva clave SÍ funciona
    res_login_new = client.post("/auth/login", json={
        "Email": test_email,
        "Password": clave_nueva,
    })
    assert res_login_new.status_code == 200
    assert "access_token" in res_login_new.json()


# ------------------------------------------------------------
# 3. CATÁLOGO COMERCIAL: PERMISOS Y PROTECCIÓN RBAC
# ------------------------------------------------------------

def test_catalogo_lectura_publica():
    """Cualquier usuario anónimo puede consultar el catálogo."""
    res_prod = client.get("/productos?limite=5&desde=0")
    assert res_prod.status_code == 200
    assert "productos" in res_prod.json()

    res_cat = client.get("/categorias")
    assert res_cat.status_code == 200
    assert len(res_cat.json()["categorias"]) >= 5

    res_mar = client.get("/marcas")
    assert res_mar.status_code == 200
    assert len(res_mar.json()["marcas"]) >= 5


def test_catalogo_proteccion_escritura_rbac():
    """Crear producto sin token o con rol Cliente debe ser rechazado."""
    prod_payload = {
        "SKU": f"SKU-TEST-{uuid.uuid4().hex[:4]}",
        "Nombre": "Auditoría Test",
        "Precio": 100.0,
        "Stock": 10,
        "CategoriaId": 1,
        "MarcaId": 1,
    }

    # Sin token -> 401
    res_no_auth = client.post("/productos", json=prod_payload)
    assert res_no_auth.status_code == 401

    # Con token de cliente -> 403 Forbidden
    unique_suffix = uuid.uuid4().hex[:6]
    cliente_res = client.post("/auth/register", json={
        "Nombres": "Cliente",
        "Apellidos": "Restringido",
        "Email": f"cliente_rbac_{unique_suffix}@tecnomega.com",
        "Password": "Password123!",
        "Identificacion": f"17{uuid.uuid4().int % 100000000:08d}",
    })
    cli_token = cliente_res.json()["access_token"]
    res_cliente = client.post("/productos", json=prod_payload, headers={"Authorization": f"Bearer {cli_token}"})
    assert res_cliente.status_code == 403


# ------------------------------------------------------------
# 4. CLIENTES Y GESTIÓN DE DIRECCIONES
# ------------------------------------------------------------

def test_direcciones_cliente_crud():
    """Valida gestión de direcciones para un cliente autenticado."""
    unique_suffix = uuid.uuid4().hex[:6]
    cliente_res = client.post("/auth/register", json={
        "Nombres": "Maria",
        "Apellidos": "Lopez",
        "Email": f"maria_{unique_suffix}@tecnomega.com",
        "Password": "Password123!",
        "Identificacion": f"01{uuid.uuid4().int % 100000000:08d}",
    })
    cli_token = cliente_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {cli_token}"}

    # Agregar dirección
    dir_res = client.post("/clientes/me/direcciones", headers=headers, json={
        "Provincia": "Pichincha",
        "Ciudad": "Quito",
        "Direccion": "Av. Amazonas y Naciones Unidas",
        "Referencia": "Frente al parque La Carolina",
        "EsPrincipal": True,
    })
    assert dir_res.status_code == 201
    dir_id = dir_res.json()["DireccionId"]
    assert dir_id > 0

    # Listar direcciones
    list_res = client.get("/clientes/me/direcciones", headers=headers)
    assert list_res.status_code == 200
    assert len(list_res.json()) >= 1


def test_actualizar_identificacion_perfil_cliente():
    """Valida actualización de identificación y datos del perfil mediante PATCH /clientes/{id} y PATCH /clientes/me."""
    unique_suffix = uuid.uuid4().hex[:6]
    orig_ident = f"10{uuid.uuid4().int % 100000000:08d}"
    cliente_res = client.post("/auth/register", json={
        "Nombres": "Carlos",
        "Apellidos": "Andrade",
        "Email": f"carlos_{unique_suffix}@tecnomega.com",
        "Password": "Password123!",
        "Identificacion": orig_ident,
    })
    assert cliente_res.status_code == 201
    cli_data = cliente_res.json()["usuario"]
    cli_token = cliente_res.json()["access_token"]
    cliente_id = cli_data["ClienteId"]
    headers = {"Authorization": f"Bearer {cli_token}"}

    # 1. Actualizar identificación y nombres mediante PATCH /clientes/{cliente_id}
    nueva_ident = f"11{uuid.uuid4().int % 100000000:08d}"
    patch_res = client.patch(f"/clientes/{cliente_id}", headers=headers, json={
        "Identificacion": nueva_ident,
        "Nombres": "Carlos Alberto",
        "Telefono": "0987654321",
    })
    assert patch_res.status_code == 200
    updated_data = patch_res.json()
    assert updated_data["Identificacion"] == nueva_ident
    assert updated_data["Nombres"] == "Carlos Alberto"
    assert updated_data["Telefono"] == "0987654321"

    # Verificar que /auth/me refleja la nueva identificación
    me_res = client.get("/auth/me", headers=headers)
    assert me_res.status_code == 200
    assert me_res.json()["Identificacion"] == nueva_ident

    # 2. Actualizar identificación mediante PATCH /clientes/me con alias en minúsculas (identificacion)
    otra_ident = f"12{uuid.uuid4().int % 100000000:08d}"
    patch_me_res = client.patch("/clientes/me", headers=headers, json={
        "identificacion": otra_ident,
        "nombres": "Carlos Roberto",
    })
    assert patch_me_res.status_code == 200
    assert patch_me_res.json()["Identificacion"] == otra_ident
    assert patch_me_res.json()["Nombres"] == "Carlos Roberto"

    # 3. Registrar un segundo cliente con identificación propia
    segundo_ident = f"99{uuid.uuid4().int % 100000000:08d}"
    client.post("/auth/register", json={
        "Nombres": "Segundo",
        "Apellidos": "Cliente",
        "Email": f"segundo_{unique_suffix}@tecnomega.com",
        "Password": "Password123!",
        "Identificacion": segundo_ident,
    })

    # 4. Intentar actualizar a la identificación del segundo cliente -> Debe responder 409 Conflict
    dup_res = client.patch(f"/clientes/{cliente_id}", headers=headers, json={
        "Identificacion": segundo_ident,
    })
    assert dup_res.status_code == 409


# ------------------------------------------------------------
# 5. CARRITO DE COMPRAS
# ------------------------------------------------------------

def test_carrito_compras_flujo():
    """Valida agregar items, actualizar cantidad, listar y vaciar carrito."""
    unique_suffix = uuid.uuid4().hex[:6]
    cliente_res = client.post("/auth/register", json={
        "Nombres": "Carlos",
        "Apellidos": "Perez",
        "Email": f"carlos_{unique_suffix}@tecnomega.com",
        "Password": "Password123!",
        "Identificacion": f"11{uuid.uuid4().int % 100000000:08d}",
    })
    headers = {"Authorization": f"Bearer {cliente_res.json()['access_token']}"}

    # Obtener un producto activo
    prod = client.get("/productos?limite=1").json()["productos"][0]
    prod_id = prod["ProductoId"]

    # Agregar al carrito
    add_res = client.post("/carrito/items", headers=headers, json={
        "ProductoId": prod_id,
        "Cantidad": 2,
    })
    assert add_res.status_code == 201

    # Ver carrito
    cart_res = client.get("/carrito", headers=headers)
    assert cart_res.status_code == 200
    cart_data = cart_res.json()
    assert cart_data["TotalItems"] >= 2
    assert Decimal(cart_data["Subtotal"]) > 0

    # Modificar cantidad
    detalle_id = cart_data["Items"][0]["DetalleCarritoId"]
    upd_res = client.patch(f"/carrito/items/{detalle_id}", headers=headers, json={"Cantidad": 1})
    assert upd_res.status_code == 200
    assert client.get("/carrito", headers=headers).json()["TotalItems"] == 1

    # Vaciar carrito
    del_res = client.delete("/carrito", headers=headers)
    assert del_res.status_code == 200
    assert client.get("/carrito", headers=headers).json()["TotalItems"] == 0


# ------------------------------------------------------------
# 6. PROMOCIONES Y VALIDACIÓN DE CUPONES
# ------------------------------------------------------------

def test_promociones_y_validacion_cupon():
    """Valida creación de promoción por Admin y validación de cupón."""
    admin_login = client.post("/auth/login", json={"Email": "admin@tecnomega.com", "Password": "Admin123!"})
    headers_admin = {"Authorization": f"Bearer {admin_login.json()['access_token']}"}

    cupon_code = f"AUDIT{uuid.uuid4().hex[:4].upper()}"
    now = datetime.now()

    # Crear promoción con cupón 15%
    promo_res = client.post("/promociones", headers=headers_admin, json={
        "Nombre": f"Descuento Auditoria {cupon_code}",
        "CodigoCupon": cupon_code,
        "TipoDescuento": "PORCENTAJE",
        "ValorDescuento": 15.00,
        "MontoMinimoCompra": 50.00,
        "FechaInicio": (now - timedelta(days=1)).isoformat(),
        "FechaFin": (now + timedelta(days=30)).isoformat(),
    })
    assert promo_res.status_code == 201

    # Validar cupón con subtotal suficiente
    val_res = client.post("/promociones/validar-cupon", json={
        "CodigoCupon": cupon_code,
        "Subtotal": 100.00,
    })
    assert val_res.status_code == 200
    val_data = val_res.json()
    assert val_data["valido"] is True
    assert Decimal(val_data["monto_descuento"]) == Decimal("15.00")
    assert Decimal(val_data["subtotal_con_descuento"]) == Decimal("85.00")

    # Validar cupón con subtotal inferior al mínimo -> debe fallar 400
    fail_res = client.post("/promociones/validar-cupon", json={
        "CodigoCupon": cupon_code,
        "Subtotal": 20.00,
    })
    assert fail_res.status_code == 400


# ------------------------------------------------------------
# 7. FAVORITOS Y RESEÑAS
# ------------------------------------------------------------

def test_favoritos_y_resenas():
    """Valida gestión de lista de deseos y reseñas de productos."""
    unique_suffix = uuid.uuid4().hex[:6]
    cliente_res = client.post("/auth/register", json={
        "Nombres": "Ana",
        "Apellidos": "Morales",
        "Email": f"ana_{unique_suffix}@tecnomega.com",
        "Password": "Password123!",
        "Identificacion": f"12{uuid.uuid4().int % 100000000:08d}",
    })
    headers = {"Authorization": f"Bearer {cliente_res.json()['access_token']}"}

    prod = client.get("/productos?limite=1").json()["productos"][0]
    prod_id = prod["ProductoId"]

    # Agregar a favoritos
    fav_res = client.post(f"/favoritos/{prod_id}", headers=headers)
    assert fav_res.status_code in (200, 201)

    # Listar favoritos
    list_fav = client.get("/favoritos", headers=headers)
    assert list_fav.status_code == 200
    assert any(f["ProductoId"] == prod_id for f in list_fav.json())

    # Agregar reseña inicial
    review_res = client.post(f"/productos/{prod_id}/resenas", headers=headers, json={
        "Calificacion": 5,
        "Comentario": "Excelente producto, 100% recomendado.",
    })
    assert review_res.status_code in (200, 201)
    resena_id = review_res.json()["ResenaId"]
    assert resena_id > 0

    # Consultar reseñas del producto
    reviews_get = client.get(f"/productos/{prod_id}/resenas")
    assert reviews_get.status_code == 200
    assert reviews_get.json()["TotalResenas"] >= 1

    # Consultar mi reseña específica
    my_review_get = client.get(f"/productos/{prod_id}/resenas/me", headers=headers)
    assert my_review_get.status_code == 200
    assert my_review_get.json()["Calificacion"] == 5

    # Recalificar / actualizar reseña mediante PUT en ruta de producto
    put_res = client.put(f"/productos/{prod_id}/resenas", headers=headers, json={
        "Calificacion": 4,
        "Comentario": "Actualización: Muy bueno, pero llegó con un día de retraso.",
    })
    assert put_res.status_code == 200
    assert put_res.json()["Calificacion"] == 4
    assert put_res.json()["ResenaId"] == resena_id

    # Actualizar reseña mediante PATCH por ID de reseña
    patch_res = client.patch(f"/resenas/{resena_id}", headers=headers, json={
        "calificacion": 3,
        "comentario": "Actualización final de reseña.",
    })
    assert patch_res.status_code == 200
    assert patch_res.json()["Calificacion"] == 3

    # Enviar nuevo POST del mismo usuario para el mismo producto -> debe actualizar en lugar de duplicar
    post_again = client.post(f"/productos/{prod_id}/resenas", headers=headers, json={
        "Calificacion": 5,
        "Comentario": "El soporte me atendió excelente, cambio a 5 estrellas.",
    })
    assert post_again.status_code in (200, 201)
    assert post_again.json()["ResenaId"] == resena_id
    assert post_again.json()["Calificacion"] == 5


# ------------------------------------------------------------
# 8. INVENTARIO Y MOVIMIENTOS
# ------------------------------------------------------------

def test_inventario_movimiento_y_stock():
    """Valida registro de movimiento de entrada y actualización de stock."""
    admin_login = client.post("/auth/login", json={"Email": "admin@tecnomega.com", "Password": "Admin123!"})
    headers_admin = {"Authorization": f"Bearer {admin_login.json()['access_token']}"}

    prod = client.get("/productos?limite=1").json()["productos"][0]
    prod_id = prod["ProductoId"]
    stock_inicial = prod["Stock"]

    # Registrar movimiento de Entrada (TipoMovimientoId = 1)
    mov_res = client.post("/inventario/movimientos", headers=headers_admin, json={
        "ProductoId": prod_id,
        "TipoMovimientoId": 1,
        "Cantidad": 10,
        "Motivo": "Prueba de auditoria de entrada de inventario",
    })
    assert mov_res.status_code == 201

    # Verificar que el producto refleje el stock incrementado
    prod_updated = client.get(f"/productos/{prod_id}").json()
    assert prod_updated["Stock"] == stock_inicial + 10


# ------------------------------------------------------------
# 9. FLUJO INTEGRAL: PEDIDO CON DESCUENTO, FACTURA Y PAGO
# ------------------------------------------------------------

def test_flujo_integral_pedido_descuento_factura_pago():
    """
    Prueba de punta a punta:
    1. Registro de cliente y dirección.
    2. Creación de pedido con cupón de descuento.
    3. Validación de stock y descuento en líneas de pedido.
    4. Emisión de factura con secuencia oficial FAC-YYYY-######.
    5. Verificación de cálculo de descuentos en detalle de factura.
    6. Registro de pago con estado 'Pagado'.
    7. Verificación de factura en estado 'Pagada'.
    """
    unique_suffix = uuid.uuid4().hex[:6]
    cli_email = f"comprador_{unique_suffix}@tecnomega.com"

    # 1. Registro y dirección
    reg_res = client.post("/auth/register", json={
        "Nombres": "Esteban",
        "Apellidos": "Quito",
        "Email": cli_email,
        "Password": "Password123!",
        "Identificacion": f"17{uuid.uuid4().int % 100000000:08d}",
    })
    headers_cli = {"Authorization": f"Bearer {reg_res.json()['access_token']}"}

    dir_res = client.post("/clientes/me/direcciones", headers=headers_cli, json={
        "Provincia": "Guayas",
        "Ciudad": "Guayaquil",
        "Direccion": "Malecón 2000 y 9 de Octubre",
        "EsPrincipal": True,
    })
    dir_id = dir_res.json()["DireccionId"]

    # Obtener producto para la compra
    prod = client.get("/productos?limite=1").json()["productos"][0]
    prod_id = prod["ProductoId"]

    # 2. Admin crea cupón de 10%
    admin_login = client.post("/auth/login", json={"Email": "admin@tecnomega.com", "Password": "Admin123!"})
    headers_admin = {"Authorization": f"Bearer {admin_login.json()['access_token']}"}

    cupon = f"DESC10_{uuid.uuid4().hex[:4].upper()}"
    now = datetime.now()
    client.post("/promociones", headers=headers_admin, json={
        "Nombre": f"Promocion {cupon}",
        "CodigoCupon": cupon,
        "TipoDescuento": "PORCENTAJE",
        "ValorDescuento": 10.00,
        "MontoMinimoCompra": 1.00,
        "FechaInicio": (now - timedelta(days=1)).isoformat(),
        "FechaFin": (now + timedelta(days=30)).isoformat(),
    })

    # 3. Crear pedido con el cupón
    pedido_res = client.post("/pedidos", headers=headers_cli, json={
        "DireccionId": dir_id,
        "CodigoCupon": cupon,
        "Items": [
            {"ProductoId": prod_id, "Cantidad": 1}
        ]
    })
    assert pedido_res.status_code == 201
    pedido_data = pedido_res.json()
    pedido_id = pedido_data["PedidoId"]
    assert pedido_id > 0
    assert Decimal(pedido_data["Descuento"]) > Decimal("0.00")

    # 4. Emitir factura a partir del pedido
    factura_res = client.post("/facturas", headers=headers_admin, json={"PedidoId": pedido_id})
    assert factura_res.status_code == 201
    factura_data = factura_res.json()
    factura_id = factura_data["FacturaId"]
    assert factura_data["NumeroFactura"].startswith("FAC-")
    assert factura_data["Estado"] == "Emitida"
    assert Decimal(factura_data["Descuento"]) > Decimal("0.00")

    # 5. Registrar pago
    metodo_id = client.get("/metodos-pago").json()[0]["MetodoPagoId"]
    total_factura = factura_data["Total"]

    pago_res = client.post("/pagos", headers=headers_admin, json={
        "PedidoId": pedido_id,
        "MetodoPagoId": metodo_id,
        "Monto": float(total_factura),
        "TransaccionId": f"TRX-{uuid.uuid4().hex[:8].upper()}",
    })
    assert pago_res.status_code == 201
    assert pago_res.json()["Estado"] == "Pagado"

    # 6. Validar que la factura ahora esté Pagada
    factura_final = client.get(f"/facturas/{factura_id}", headers=headers_admin).json()
    assert factura_final["Estado"] == "Pagada"


# ------------------------------------------------------------
# 10. AUDITORÍA Y REGRESIÓN DE ERRORES ERR-001 AL ERR-005
# ------------------------------------------------------------

def test_err001_y_err004_excepciones_y_respuestas_estandar():
    """Valida control de excepciones en base de datos y formato estándar de errores JSON."""
    # ERR-001: Verificación de base de datos con respuesta estructurada
    db_res = client.get("/database")
    assert db_res.status_code == 200
    db_json = db_res.json()
    assert db_json["estado"] == "Conectado"
    assert db_json["base_de_datos"] == "TECNOMEGA"

    # ERR-004: Respuesta estándar ante recurso no encontrado (HTTP 404)
    res_404 = client.get("/productos/99999999")
    assert res_404.status_code == 404
    data_404 = res_404.json()
    assert data_404["error"] is True
    assert data_404["status_code"] == 404
    assert "detail" in data_404
    assert "mensaje" in data_404

    # ERR-003 & ERR-004: Respuesta estándar ante validación Pydantic (HTTP 422)
    admin_login = client.post("/auth/login", json={"Email": "admin@tecnomega.com", "Password": "Admin123!"})
    token = admin_login.json()["access_token"]
    res_422 = client.post("/carrito/items", headers={"Authorization": f"Bearer {token}"}, json={
        "ProductoId": -10,
        "Cantidad": -5,
    })
    assert res_422.status_code == 422
    data_422 = res_422.json()
    assert data_422["error"] is True
    assert data_422["status_code"] == 422
    assert "detail" in data_422


def test_err002_atomicidad_acid_sin_registros_huerfanos():
    """Valida atomicidad ACID: si falla la validación de un pedido, la transacción se revierte por completo."""
    unique_suffix = uuid.uuid4().hex[:6]
    cliente_res = client.post("/auth/register", json={
        "Nombres": "Test",
        "Apellidos": "ACID",
        "Email": f"acid_{unique_suffix}@tecnomega.com",
        "Password": "Password123!",
        "Identificacion": f"98{uuid.uuid4().int % 100000000:08d}",
    })
    token = cliente_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Crear dirección
    dir_res = client.post("/clientes/me/direcciones", headers=headers, json={
        "Direccion": "Calle Transaccional 123",
        "Ciudad": "Quito",
    })
    dir_id = dir_res.json()["DireccionId"]

    # Intentar crear un pedido solicitando stock astronómico (debe fallar 400 y hacer rollback)
    fail_res = client.post("/pedidos", headers=headers, json={
        "DireccionId": dir_id,
        "Items": [{"ProductoId": 1, "Cantidad": 9999999}],
    })
    assert fail_res.status_code == 400

    # Comprobar que no existe ningún pedido huérfano registrado
    pedidos_res = client.get("/pedidos", headers=headers)
    assert pedidos_res.status_code == 200
    assert len(pedidos_res.json()["pedidos"]) == 0


def test_err005_paginacion_y_sanitizacion_wildcards():
    """Valida paginación en categorías, marcas y promociones, y sanitización de caracteres comodín SQL."""
    # Paginación en Categorías
    cat_res = client.get("/categorias?limite=2&desde=0")
    assert cat_res.status_code == 200
    cat_data = cat_res.json()
    assert cat_data["limite"] == 2
    assert cat_data["desde"] == 0
    assert len(cat_data["categorias"]) <= 2
    assert cat_data["total"] >= 1

    # Paginación en Marcas
    marca_res = client.get("/marcas?limite=2&desde=0")
    assert marca_res.status_code == 200
    marca_data = marca_res.json()
    assert marca_data["limite"] == 2
    assert marca_data["desde"] == 0
    assert len(marca_data["marcas"]) <= 2
    assert marca_data["total"] >= 1

    # Paginación en Promociones
    promo_res = client.get("/promociones?limite=2&desde=0")
    assert promo_res.status_code == 200
    assert isinstance(promo_res.json(), list)
    assert len(promo_res.json()) <= 2

    # Sanitización de caracteres comodín de SQL (%, _, \) en búsqueda
    admin_login = client.post("/auth/login", json={"Email": "admin@tecnomega.com", "Password": "Admin123!"})
    token = admin_login.json()["access_token"]
    busqueda_res = client.get("/clientes?buscar=%25%25%5C%5F%5F", headers={"Authorization": f"Bearer {token}"})
    assert busqueda_res.status_code == 200
    assert "clientes" in busqueda_res.json()

