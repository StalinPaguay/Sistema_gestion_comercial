# Sistema de Gestión Comercial - TECNOMEGA

## Registro de Actividad y Cambios
- **Fecha:** 02 de Octubre de 2026
- **Hora:** 08:30 (GMT-5)
- **Rama de Trabajo:** `feature/database`
- **Autor / Desarrollador:** Ariel (`Ariel147852`)
- **Mensaje de Commit:** `CREACION DE LA BASE DE DATOS` (Commit: `9a3c414`)

## Resumen de lo Realizado

### 1. Configuración del Entorno (`.env`)
- Se creó y validó el archivo de configuración local `.env` basado en `.env.example`.
- Configuración de SQL Server 2022 en Docker (`sa`, puerto `1433`, base `TECNOMEGA`).
- Mapeo de puertos para Backend (`8000`) y Frontend (`4200`).
- Verificación del `.gitignore` para garantizar que las credenciales no sean expuestas en el repositorio remoto.

## Guía para el Equipo (Siguientes Pasos)

### Para el encargado del Repositorio / Merge a `main`:
1. Revisar la rama `feature/database` y el script `database/scripts/01_create_database.sql`.
2. Aprobar el Pull Request y realizar el Merge hacia la rama `main`.

### Para continuar con el Backend:
1. **Actualizar el repositorio local:**
   ```bash
   git checkout main
   git pull origin main
   ```
2. **Crear archivo `.env`:**
   Copiar `.env.example` a `.env` con las variables correspondientes.
3. **Levantar el contenedor de Base de Datos:**
   ```bash
   docker compose up -d database
   ```
4. **Ejecutar el script SQL:**
   Cargar `database/scripts/01_create_database.sql` en SQL Server (`localhost:1433`).
5. **Desarrollar servicios y endpoints:**
   Conectar el backend (FastAPI) a la base de datos `TECNOMEGA`.