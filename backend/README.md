# Backend — Sistema de Gestión Comercial TECNOMEGA

## 1. Descripción del proyecto

Backend desarrollado con **Python, FastAPI, SQLAlchemy y SQL Server** para el sistema de gestión comercial TECNOMEGA.

La API permite consultar y gestionar el catálogo de productos, categorías y marcas. La conexión a la base de datos se configura mediante variables de entorno.

## 2. Tecnologías

- Python 3.14 en la imagen Docker actual.
- FastAPI para la API REST.
- SQLAlchemy para el acceso a SQL Server.
- pyodbc para la conexión con SQL Server.
- Microsoft ODBC Driver 18.
- SQL Server 2022.
- Docker y Docker Compose.

Las dependencias de Python se encuentran en `backend/requirements.txt`.

## 3. Estructura del backend

```text
backend/
├── config/
│   └── database.py
├── controllers/
│   └── database_controller.py
├── models/
│   ├── categoria.py
│   ├── marca.py
│   ├── producto.py
│   └── ...
├── routes/
│   ├── catalogo_routes.py
│   └── database_routes.py
├── services/
├── views/
├── Dockerfile
├── .dockerignore
├── .gitignore
├── main.py
└── requirements.txt
```

- `config/database.py`: configura la conexión y las sesiones de SQLAlchemy.
- `models/`: contiene los modelos ORM.
- `routes/catalogo_routes.py`: implementa las operaciones del catálogo.
- `routes/database_routes.py`: expone la comprobación de conexión.
- `controllers/database_controller.py`: consulta el nombre de la base de datos conectada.
- `main.py`: crea la aplicación FastAPI y registra los routers.
- `Dockerfile`: define la imagen del backend.

## 4. Requisitos previos

Para ejecutar el proyecto con Docker se necesita:

- Git.
- Docker Desktop con Docker Compose.
- Acceso al repositorio Git del proyecto.

Los puertos utilizados por la configuración actual son:

| Servicio | Puerto |
|---|---:|
| Backend | 8000 |
| SQL Server | 1433 |
| Frontend | 4200 |

Los puertos deben estar disponibles en el equipo.

## 5. Clonar y configurar el proyecto

Clonar el repositorio y entrar en la carpeta del proyecto:

```bash
git clone https://github.com/StalinPaguay/Sistema_gestion_comercial.git
```

Crear el archivo local de variables de entorno:

```bash
cp .env.example .env
```

Editar `.env` y establecer una contraseña válida para SQL Server, junto con las demás variables requeridas.

Variables previstas en `.env`:

```dotenv
MSSQL_SA_PASSWORD=CAMBIAR_POR_UNA_CONTRASENA_SEGURA
MSSQL_DATABASE=TECNOMEGA
MSSQL_PID=Developer
BACKEND_PORT=8000
FRONTEND_PORT=4200
```

Estos valores son una plantilla, no credenciales listas para producción. La contraseña real no debe compartirse ni subirse al repositorio.

**Nota:** la configuración actual de `docker-compose.yml` publica los puertos 8000, 1433 y 4200 de forma fija. Las variables `BACKEND_PORT` y `FRONTEND_PORT` no cambian esos puertos hasta que el archivo Compose se adapte para utilizarlas.

## 6. Construir e iniciar los servicios

Desde la raíz del repositorio, construir la imagen del backend:

```bash
docker compose build backend
```

Iniciar los servicios:

```bash
docker compose up -d
```

Consultar el estado:

```bash
docker compose ps
```

Consultar los registros del backend:

```bash
docker compose logs --tail=100 backend
```

Si se modifican las dependencias o el código incorporado a la imagen, reconstruir el backend y reiniciarlo:

```bash
docker compose build backend
docker compose up -d backend
```

## 7. Comprobar el funcionamiento

Comprobar la conexión del backend a la base de datos:

```bash
curl -i http://localhost:8000/database
```

La respuesta esperada, cuando la conexión funciona, es HTTP 200 con un JSON similar a:

```json
{
  "base_de_datos": "TECNOMEGA"
}
```

Consultar los catálogos:

```bash
curl -i http://localhost:8000/productos
curl -i http://localhost:8000/categorias
curl -i http://localhost:8000/marcas
```

Abrir la documentación interactiva de FastAPI:

- Swagger UI: http://localhost:8000/docs
- OpenAPI JSON: http://localhost:8000/openapi.json

La documentación interactiva permite inspeccionar las rutas y sus esquemas.

## 8. Endpoints disponibles

### Comprobación

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/` | Mensaje de estado de la API |
| GET | `/database` | Nombre de la base de datos conectada |

### Productos

| Método | Ruta | Operación |
|---|---|---|
| GET | `/productos` | Consultar productos |
| POST | `/productos` | Crear un producto |
| GET | `/productos/{producto_id}` | Consultar un producto por ID |
| PATCH | `/productos/{producto_id}` | Actualizar parcialmente un producto |
| DELETE | `/productos/{producto_id}` | Desactivar un producto |

La consulta de productos admite los parámetros de paginación `limite` y `desde`.

### Categorías

| Método | Ruta | Operación |
|---|---|---|
| GET | `/categorias` | Consultar categorías |
| POST | `/categorias` | Crear una categoría |
| GET | `/categorias/{categoria_id}` | Consultar una categoría por ID |
| PATCH | `/categorias/{categoria_id}` | Actualizar parcialmente una categoría |
| DELETE | `/categorias/{categoria_id}` | Desactivar una categoría |

### Marcas

| Método | Ruta | Operación |
|---|---|---|
| GET | `/marcas` | Consultar marcas |
| POST | `/marcas` | Crear una marca |
| GET | `/marcas/{marca_id}` | Consultar una marca por ID |
| PATCH | `/marcas/{marca_id}` | Actualizar parcialmente una marca |
| DELETE | `/marcas/{marca_id}` | Desactivar una marca |

Las operaciones POST, PATCH y DELETE deben probarse en una base de datos de pruebas aislada antes de considerarse validadas.

## 9. Base de datos y seguridad

El backend utiliza SQL Server y obtiene sus credenciales de variables de entorno.

La configuración actual conecta con el host `database`, nombre del servicio SQL Server dentro de la red de Docker Compose. Ejecutar el backend directamente en Windows, fuera de Docker, requiere adaptar la configuración del host y preparar el entorno de Python.

La configuración actual utiliza cifrado y `TrustServerCertificate=yes`. Esta opción es apropiada para ciertos entornos locales de desarrollo, pero en producción se debe validar correctamente el certificado del servidor.

**Precauciones importantes:**

- No subir `.env` al repositorio.
- No publicar contraseñas, tokens ni credenciales en capturas o registros.
- No ejecutar scripts de inicialización sobre una base de datos que contenga información que se deba conservar.
- No utilizar `Base.metadata.create_all()` para modificar la base de datos existente.
- No eliminar el volumen `sqlserver_data`.
- No ejecutar `docker compose down -v` en el entorno con datos que deban conservarse.
- Antes de realizar cambios de esquema, preparar y validar un procedimiento de migración y respaldo.

Los scripts SQL están en `database/scripts/`. Deben revisarse antes de utilizarlos y no deben considerarse automáticamente migraciones seguras para una base existente.

## 10. Estado de validación

En el entorno de desarrollo original se verificó:

- Construcción de la imagen Docker del backend.
- Inicio de los contenedores.
- Compilación de los módulos Python.
- Conexión a la base de datos `TECNOMEGA`.
- Respuestas HTTP 200 de `GET /database`, `GET /productos`, `GET /categorias` y `GET /marcas`.
- Consulta de 8 productos, 6 categorías y 5 marcas durante las comprobaciones realizadas.

Estas verificaciones corresponden al entorno actual; no demuestran todavía una instalación limpia en otro equipo.

No se encontraron archivos de pruebas automatizadas en el backend durante la revisión. Las operaciones de escritura tampoco se han validado contra una base de pruebas aislada.

## 11. Pendientes para continuar el desarrollo

1. Ejecutar el proyecto desde un clon limpio en otro equipo.
2. Preparar una base de datos de pruebas aislada para las operaciones de escritura.
3. Incorporar pruebas automatizadas para los endpoints.
4. Revisar los modelos y las relaciones del resto de las entidades.
5. Documentar y validar el procedimiento de inicialización o migración de la base de datos.
6. Confirmar las reglas de negocio de validación y desactivación de productos, categorías y marcas.
7. Revisar la configuración de producción antes de desplegar el servicio.

---

**Estado de la entrega:** el backend funciona en el entorno Docker actual y las consultas principales han sido verificadas. La entrega debe considerarse pendiente de las pruebas de escritura aisladas, la validación desde un clon limpio y la revisión final del repositorio.