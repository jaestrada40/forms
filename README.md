<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Sistema de Formularios Institucionales

Aplicación para crear formularios, recibir respuestas y consultar reportes. La interfaz React funciona como prototipo y la carpeta `server/` contiene la primera API funcional con PostgreSQL, JWT, roles y auditoría.

View your app in AI Studio: https://ai.studio/apps/91c59569-7b23-42b6-8096-54412c347e78

## Ejecutar localmente

**Requisitos:** Node.js 20+ y Docker Desktop (para PostgreSQL).

1. Copie `.env.example` a `.env.local` y reemplace todas las claves de ejemplo, especialmente `POSTGRES_PASSWORD`, `DATABASE_URL`, `JWT_SECRET` y `ADMIN_PASSWORD`.
2. Inicie PostgreSQL: `docker compose up -d postgres`.
3. En una terminal, inicie la API: `npm run dev:api`.
4. En otra terminal, inicie la interfaz: `npm run dev`.
5. Abra `http://localhost:3000`.

La API se expone en `http://localhost:4000`. Al arrancar con una base vacía crea el administrador definido en las variables `ADMIN_*`.

## API inicial

- `POST /api/auth/login`: inicio de sesión y token JWT.
- `GET /api/forms`, `POST /api/forms`, `PATCH /api/forms/:id`: administración de formularios protegida por roles.
- `GET /api/public/forms/:id`: formulario publicado para personas respondedoras.
- `POST /api/public/forms/:id/responses`: recepción de respuestas públicas.
- `GET /health`: verificación del servicio.

La siguiente etapa es reemplazar progresivamente los datos de muestra de la interfaz por `src/services/api.ts`, comenzando con el listado, creación y edición de formularios.
