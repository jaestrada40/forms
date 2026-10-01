# Sistema de Formularios Institucionales

Aplicación para crear formularios, recibir respuestas y consultar reportes. La interfaz React funciona como prototipo y la carpeta `server/` contiene la primera API funcional con PostgreSQL, JWT, roles y auditoría.

## Ejecutar localmente

**Requisitos:** Node.js 20+, npm y Docker Desktop (para PostgreSQL). Docker Desktop debe estar abierto y corriendo antes del paso 3.

1. Clone o actualice el repositorio y entre a la carpeta del proyecto:
   ```bash
   git clone https://github.com/jaestrada40/forms.git
   cd forms
   ```
   (Si ya lo tiene clonado, simplemente `git pull`.)
2. Instale las dependencias:
   ```bash
   npm install
   ```
3. Cree su archivo de variables de entorno local a partir del ejemplo:
   ```bash
   cp .env.example .env.local
   ```
   Abra `.env.local` y reemplace todas las claves de ejemplo, especialmente `POSTGRES_PASSWORD`, `DATABASE_URL` (debe usar la misma contraseña que `POSTGRES_PASSWORD`), `JWT_SECRET` (mínimo 32 caracteres aleatorios) y `ADMIN_PASSWORD`. Este archivo no se sube al repositorio.
4. Levante PostgreSQL con Docker:
   ```bash
   docker compose up -d postgres
   ```
   Esto crea el contenedor `formularios-postgres` con un volumen persistente (`postgres_data`), así que sus datos no se pierden al apagar el contenedor. Puede verificar que esté sano con `docker compose ps`.
5. En una terminal, inicie la API (se reinicia sola al guardar cambios en `server/`):
   ```bash
   npm run dev:api
   ```
   La primera vez que corre contra una base vacía, crea automáticamente las tablas y el usuario administrador definido en las variables `ADMIN_*` de `.env.local`.
6. En otra terminal (dejando la anterior corriendo), inicie la interfaz:
   ```bash
   npm run dev
   ```
7. Abra `http://localhost:3000` en el navegador. La API queda expuesta en `http://localhost:4000`.

**Para detener todo:** cierre las dos terminales (`Ctrl+C`) y luego `docker compose stop`. Para apagar el contenedor y además borrar los datos guardados, use `docker compose down -v` (irreversible).

## API inicial

- `POST /api/auth/login`: inicio de sesión y token JWT.
- `GET /api/forms`, `POST /api/forms`, `PATCH /api/forms/:id`: administración de formularios protegida por roles.
- `GET /api/public/forms/:id`: formulario publicado para personas respondedoras.
- `POST /api/public/forms/:id/responses`: recepción de respuestas públicas.
- `GET /health`: verificación del servicio.

La siguiente etapa es reemplazar progresivamente los datos de muestra de la interfaz por `src/services/api.ts`, comenzando con el listado, creación y edición de formularios.
