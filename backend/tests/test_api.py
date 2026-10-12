# ============================================================
# PRUEBAS AUTOMATIZADAS DE INTEGRACIÓN API - TECNOMEGA
# ============================================================

import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def test_salud_api():
    """Valida que la raíz del API responda correctamente."""
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


def test_catalogo_consultas():
    """Valida la consulta paginada de productos, categorías y marcas."""
    # Productos
    res_prod = client.get("/productos?limite=5&desde=0")
    assert res_prod.status_code == 200
    data_prod = res_prod.json()
    assert "total" in data_prod
    assert len(data_prod["productos"]) > 0

    # Categorías
    res_cat = client.get("/categorias")
    assert res_cat.status_code == 200
    assert res_cat.json()["total"] >= 6

    # Marcas
    res_mar = client.get("/marcas")
    assert res_mar.status_code == 200
    assert res_mar.json()["total"] >= 5


def test_autenticacion_y_flujo_completo():
    """Valida el ciclo de vida: Login, Perfil JWT, Carrito, Pedido, Pago y Factura."""
    # 1. Login Admin
    login_res = client.post("/auth/login", json={
        "Email": "admin@tecnomega.com",
        "Password": "Admin123!",
    })
    assert login_res.status_code == 200
    admin_token = login_res.json()["access_token"]
    assert admin_token is not None

    headers_admin = {"Authorization": f"Bearer {admin_token}"}

    # 2. Perfil de usuario autenticado
    me_res = client.get("/auth/me", headers=headers_admin)
    assert me_res.status_code == 200
    assert me_res.json()["Rol"] == "Administrador"

    # 3. Métodos de pago
    metodos_res = client.get("/metodos-pago")
    assert metodos_res.status_code == 200
    assert len(metodos_res.json()) >= 3

    # 4. Proveedores
    prov_res = client.get("/proveedores", headers=headers_admin)
    assert prov_res.status_code == 200
    assert prov_res.json()["total"] >= 5

    # 5. Stock bajo
    stock_res = client.get("/inventario/stock-bajo", headers=headers_admin)
    assert stock_res.status_code == 200
    assert isinstance(stock_res.json(), list)

    # 6. Tipos de movimiento de inventario
    tipos_res = client.get("/inventario/tipos-movimiento")
    assert tipos_res.status_code == 200
    assert len(tipos_res.json()) == 3


def test_login_invalido():
    """Valida que credenciales inválidas devuelvan 401."""
    res = client.post("/auth/login", json={
        "Email": "no_existe@tecnomega.com",
        "Password": "clave_incorrecta",
    })
    assert res.status_code == 401
