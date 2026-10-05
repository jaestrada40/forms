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
   docker compose --env-file .env.local up -d postgres
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

## Cabeceras de seguridad (despliegue)

- **API:** ya envía sus propias cabeceras (`X-Frame-Options: DENY`, CSP `default-src 'none'; frame-ancestors 'none'`, `nosniff`, etc.).
- **Frontend en producción:** `npm run build` inyecta una Content-Security-Policy en el `index.html`, pero **`frame-ancestors` solo funciona como cabecera HTTP**, no dentro de un `<meta>`. Configúrela en el servidor que sirva la carpeta `dist/`:
  - **Netlify / Cloudflare Pages:** ya está en `public/_headers` (se copia a `dist/`).
  - **nginx:**
    ```nginx
    add_header Content-Security-Policy "frame-ancestors 'self'" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    ```
  - **Servidor de desarrollo (`npm run dev`) y `npm run preview`:** las envía `vite.config.ts`.
- Para **incrustar** los formularios públicos en otro sitio, cambie `'self'` por `'self' https://su-sitio.gob.gt` en la cabecera.
- Sesión: cookie HttpOnly. Si el frontend y la API están en dominios distintos, use `COOKIE_SAMESITE="None"` (exige HTTPS); vea `.env.example`.

## API inicial

- `POST /api/auth/login`: inicio de sesión y token JWT.
- `GET /api/forms`, `POST /api/forms`, `PATCH /api/forms/:id`: administración de formularios protegida por roles.
- `GET /api/public/forms/:id`: formulario publicado para personas respondedoras.
- `POST /api/public/forms/:id/responses`: recepción de respuestas públicas.
- `GET /health`: verificación del servicio.

La siguiente etapa es reemplazar progresivamente los datos de muestra de la interfaz por `src/services/api.ts`, comenzando con el listado, creación y edición de formularios.

## Despliegue en OpenShift (imágenes en OSNexus)

Sigue el esquema de `rededes-minfin`. El frontend (nginx no-root) sirve la SPA y hace proxy de `/api` y `/health` al Service `portal-formularios-backend`, así la API queda en el mismo origen (sin problemas de cookies/CORS) y la imagen no depende de ninguna URL en build.

1. Publicar imágenes: `MakeImageBackend.bat` y `MakeImageFrontend.bat` (piden `docker login` al ejecutarse; usan `Dockerfile.backend` y `Dockerfile.frontend`). `postgres:16-alpine` se jala directo de Docker Hub, sin pasar por OSNexus (igual que en `enlaces-minfin` y `rededes-minfin`).
2. Crear el pull secret del registro (una sola vez por namespace) y enlazarlo a la cuenta de servicio por defecto — lo necesitan las imágenes de `backend` y `frontend`, que sí están en OSNexus:
   ```bash
   oc create secret docker-registry srv-osnexus01.minfin.gob.gt \
     --docker-server=srv-osnexus01.minfin.gob.gt:8006 \
     --docker-username=TU_USUARIO --docker-password=TU_PASSWORD
   oc secrets link default srv-osnexus01.minfin.gob.gt --for=pull
   ```
3. Copiar `openshift/01-secrets.example.yaml` a `openshift/01-secrets.yaml` (ignorado por git) y reemplazar los valores.
4. Confirmar el `storageClassName` en `00-postgresql.yaml` con `oc get storageclass` (si el PVC se queda "unbound", es casi siempre porque este valor no existe en el cluster).
5. Aplicar en este orden — el Route va antes que el ConfigMap porque `WEB_ORIGIN` depende de lo que genere el Route:
   ```bash
   oc apply -f openshift/01-secrets.yaml
   oc apply -f openshift/00-postgresql.yaml
   oc apply -f openshift/07-frontend-route.yaml
   oc apply -f openshift/05-frontend-deployment.yaml -f openshift/06-frontend-service.yaml
   ```
6. `07-frontend-route.yaml` no fija un host: cada cluster (OKD4, OCP4, el que sea) asigna su propio dominio wildcard. Leer el host real que quedó asignado:
   ```bash
   oc get route portal-formularios-frontend -o jsonpath="{.spec.host}"
   ```
7. Poner ese host exacto en `WEB_ORIGIN` de `02-backend-configmap.yaml` (con `https://`, sin `/` final) y aplicar el resto:
   ```bash
   oc apply -f openshift/02-backend-configmap.yaml
   oc apply -f openshift/03-backend-deployment.yaml -f openshift/04-backend-service.yaml
   ```
