# Sistema de Formularios Institucionales

## Propósito

Aplicación web institucional para diseñar, publicar y administrar formularios digitales. Permite recibir respuestas públicas o internas, dar seguimiento mediante folios, consultar resultados y mantener trazabilidad de las acciones administrativas.

El sistema está pensado para centralizar formularios de distintas unidades o departamentos, manteniendo control de acceso por roles y una configuración institucional común.

## Módulos y funciones

| Módulo | Funciones principales |
| --- | --- |
| Inicio | Panel general con indicadores, accesos rápidos y resumen del estado de los formularios. |
| Formularios | Crear, editar, duplicar, publicar, despublicar, archivar y eliminar formularios. Incluye listado, búsqueda, filtros y vista pública. |
| Constructor | Definir preguntas, secciones, campos obligatorios, opciones, validaciones, apariencia, fechas de vigencia, límites de respuestas y configuración de captura. |
| Respuestas | Consultar respuestas recibidas, buscar por formulario o folio, revisar el detalle de cada envío y exportar información. |
| Reportes | Visualizar métricas y gráficos de los formularios; generar exportaciones y reportes en formatos de uso administrativo. |
| Plantillas | Guardar un formulario como plantilla compartida y crear nuevos formularios a partir de ella. Las plantillas almacenan la estructura, no las respuestas. |
| Usuarios y permisos | Crear usuarios, editar nombre, correo, departamento y contraseña, asignar roles y restablecer MFA cuando corresponda. |
| Auditoría | Registro consultable de inicios de sesión, cambios de formularios, usuarios, respuestas y configuración. |
| Configuración | Datos institucionales, departamentos, política MFA, CAPTCHA, correo SMTP, retención de datos y programación de reportes. |
| Formulario público | Publicación de formularios para personas respondedoras, validación de datos, CAPTCHA opcional, folio de seguimiento y restricciones de vigencia o cupo. |

## Roles

| Rol | Alcance |
| --- | --- |
| Administrador | Administración integral: usuarios, roles, configuración, auditoría y todos los formularios. |
| Creador | Creación, edición y publicación de sus propios formularios. |
| Analista | Consulta de respuestas, indicadores, reportes y exportaciones, sin administración global. |
| Respondedor | Llenado de formularios y seguimiento de los folios que le correspondan. |

## Seguridad implementada

- Inicio de sesión con contraseñas almacenadas mediante `bcrypt`.
- Sesión con JWT en cookie `HttpOnly`; la interfaz no guarda la credencial en el almacenamiento del navegador.
- Control de acceso por roles en la API.
- MFA/TOTP configurable y política institucional para exigirlo.
- Restablecimiento de MFA por un administrador autorizado.
- Protección contra ataques de fuerza bruta en inicio de sesión y validación MFA mediante límites de intentos.
- Validación de entradas en el servidor con Zod.
- CORS limitado al origen web configurado.
- Validación de origen para solicitudes que modifican datos cuando se autentican con cookie.
- Cabeceras de seguridad: CSP, `X-Frame-Options`, `X-Content-Type-Options` y políticas de referencia.
- Registro de auditoría de operaciones relevantes.
- Cifrado AES-256-GCM para secretos persistidos, como configuraciones SMTP y semillas MFA.
- Validaciones para publicación y recepción de respuestas: fechas, cupos, campos requeridos y CAPTCHA cuando esté habilitado.

## Arquitectura

```text
Navegador
    │
    ▼
Frontend React (SPA) ── /api y /health ──► nginx
                                              │
                                              ▼
                                      API Express / Node.js
                                              │
                                              ▼
                                        PostgreSQL 16
```

En producción, nginx sirve la aplicación estática y redirige internamente las solicitudes `/api` y `/health` al servicio backend. Esto mantiene frontend y API bajo el mismo origen y simplifica el manejo seguro de cookies.

## Tecnologías

| Capa | Tecnologías |
| --- | --- |
| Frontend | React 19, TypeScript, Vite 8, Tailwind CSS 4, Lucide React y Motion. |
| Backend | Node.js, Express 4, TypeScript y TSX. |
| Base de datos | PostgreSQL 16, con cliente `pg`. |
| Autenticación | JSON Web Token (`jsonwebtoken`), cookies `HttpOnly`, `bcryptjs` y `otplib` para MFA/TOTP. |
| Validación | Zod. |
| Correo | Nodemailer mediante SMTP. |
| Reportes | jsPDF y jsPDF-AutoTable; QR Code para enlaces de formularios. |
| Contenedores | Docker y Docker Compose para desarrollo local. |
| Producción | OpenShift/OKD, nginx no-root y registro de imágenes OSNexus. |

## Estructura principal del repositorio

```text
src/                 Interfaz React: vistas, componentes, servicios y tipos.
server/              API Express, autenticación, seguridad, correo, tareas y base de datos.
openshift/           Manifiestos para PostgreSQL, backend, frontend, servicios y ruta.
public/              Recursos estáticos y cabeceras de seguridad para hosting estático.
Dockerfile.backend   Imagen del servicio API.
Dockerfile.frontend  Imagen nginx que sirve la SPA y hace proxy a la API.
docker-compose.yml   PostgreSQL local para desarrollo.
```

## Operación local

Requisitos: Node.js 20 o superior, npm y Docker Desktop.

1. Copiar `.env.example` como `.env.local` y definir claves seguras, conexión de base de datos y usuario administrador inicial.
2. Ejecutar `npm install`.
3. Iniciar PostgreSQL con `docker compose --env-file .env.local up -d postgres`.
4. En una terminal, ejecutar `npm run dev:api` para iniciar la API en el puerto 4000.
5. En otra terminal, ejecutar `npm run dev` para iniciar la interfaz en el puerto 3000.
6. Abrir `http://localhost:3000`.

La API inicializa automáticamente las tablas y crea el administrador definido en las variables `ADMIN_*` cuando la base de datos está vacía.

## Despliegue en OpenShift/OKD

El despliegue se compone de PostgreSQL, API backend y frontend. Los manifiestos se aplican en este orden:

1. `01-secrets.yaml`
2. `02-postgresql.yaml`
3. `03-frontend-service.yaml`
4. `04-frontend-route.yaml`
5. Definir el host real de la Route en `WEB_ORIGIN` dentro de `05-backend-configmap.yaml`.
6. `05-backend-configmap.yaml`
7. `06-backend-service.yaml`
8. `07-backend-deployment.yaml`
9. `08-frontend-deployment.yaml`

Las imágenes se construyen y publican con `MakeImageBackend.bat` y `MakeImageFrontend.bat`. Antes del primer despliegue se deben crear los secretos, configurar el acceso al registro privado y verificar la clase de almacenamiento del PVC de PostgreSQL.

## Mantenimiento recomendado

- Mantener `.env.local` y `openshift/01-secrets.yaml` fuera del control de versiones.
- Usar contraseñas y `JWT_SECRET` largos y únicos por ambiente.
- Aplicar actualizaciones de dependencias y revisar periódicamente hallazgos de seguridad.
- Probar cambios con `npm run lint`, `npm run check:api` y `npm run build` antes de publicar imágenes.
- Revisar el registro de auditoría y las políticas de retención de datos de forma periódica.
- Realizar respaldos controlados de PostgreSQL antes de actualizaciones de infraestructura.
