# Plataforma de Transparencia Financiera CGPA

Este repositorio contiene la plataforma de transparencia financiera para el Centro General de Padres (CGPA), desarrollada utilizando una arquitectura de monorepo gestionada con **pnpm**.

El objetivo de este proyecto es permitir a la directiva del CGPA gestionar y publicar reportes financieros, mientras que los apoderados pueden visualizarlos en tiempo real y con total transparencia.

## 🚀 Stack Tecnológico

- **Gestor de Paquetes:** [pnpm](https://pnpm.io/) (Workspaces)
- **Frontend (Cliente):** [Vue 3](https://vuejs.org/) + [Vite](https://vitejs.dev/) + TypeScript + Tailwind CSS / DaisyUI
- **Backend (API):** [NestJS](https://nestjs.com/) + TypeScript
- **Base de Datos y Storage:** Google Cloud Firestore (NoSQL) y Firebase Storage
- **Autenticación:** Firebase Auth
- **Entorno de Desarrollo:** [Google Project IDX](https://idx.dev/) (Definido con Nix)
- **CI/CD:** GitHub Actions

## 📂 Estructura del Monorepo

```text
/
├── apps/
│   ├── client/       # Aplicación Vue 3 (SPA/PWA) a desplegar en Firebase Hosting.
│   └── api/          # Servidor NestJS a desplegar en Google Cloud Run.
├── packages/
│   └── shared/       # Lógica compartida, tipos de TypeScript y esquemas de validación Zod.
├── .idx/
│   └── dev.nix       # Entorno preconfigurado para Project IDX.
├── Dockerfile        # Build multi-stage para containerizar la API.
├── firebase.json     # Configuración para Firebase Hosting y Emuladores locales.
└── firestore.rules   # Reglas de Seguridad (Zero Trust).
```

---

## 🛠️ Puesta en Marcha (Desde Cero)

Sigue estos pasos para configurar el proyecto en un entorno local o de desarrollo.

### 1. Prerrequisitos
- **Node.js 24** o superior.
- **pnpm** instalado globalmente (`npm install -g pnpm`).
- **Java** (necesario para levantar los emuladores locales de Firebase).
- **Firebase CLI** instalado globalmente (`npm install -g firebase-tools`).

*(Nota: Si usas Google Project IDX, el entorno y las extensiones se configuran automáticamente).*

### 2. Instalación de Dependencias
Instala todas las dependencias del monorepo ejecutando el siguiente comando en la raíz del proyecto:
```bash
pnpm install
```

### 3. Configuración de Variables de Entorno
Copia el archivo de ejemplo de variables de entorno en el cliente y configúralo con las credenciales de tu proyecto de Firebase:
```bash
cp apps/client/.env.example apps/client/.env
```
Edita `apps/client/.env` y reemplaza los valores por las claves correspondientes de tu proyecto en la Consola de Firebase.

### 4. Iniciar Emuladores de Firebase (Desarrollo Local)
Para probar todo en local de forma aislada (sin afectar producción), inicia los emuladores:
```bash
firebase emulators:start --project demo-cgpa-platform
```
> **Nota:** Usar el prefijo `demo-` en el ID de proyecto permite trabajar 100% offline sin necesidad de tener credenciales de Google Cloud configuradas en local.

### 5. Levantar los Servicios (Frontend y Backend)
En una nueva terminal en la raíz del proyecto, ejecuta:
```bash
pnpm run dev
```
Este comando levantará en paralelo el backend (API en NestJS) y el frontend (Cliente en Vue).

---

## 🔑 Configuración del Primer Administrador (Producción)

El sistema utiliza una arquitectura **Zero Trust** validando no solo en la base de datos, sino también mediante **Custom Claims** de Firebase Auth. Por defecto, los nuevos registros quedan en estado `PENDIENTE`.

Para asignar el rol de Administrador Principal (`ADMIN`) a la primera cuenta y poder gestionar la plataforma:

1. Levanta la plataforma y **regístrate** en la ruta `/registro-interno-agb` o en la vista de registro.
2. Abre una terminal en la carpeta `apps/api`.
3. Configura tus credenciales de servicio de Google Cloud para apuntar a producción y ejecuta el script `set-admin.ts`:
   ```bash
   # Exporta la variable apuntando a tu archivo de clave de servicio JSON
   export GOOGLE_APPLICATION_CREDENTIALS="/ruta/a/tu/firebase-adminsdk.json"
   
   # Ejecuta el script pasándole tu correo electrónico registrado
   npx ts-node set-admin.ts tu_correo@ejemplo.com
   ```
4. Recibirás un mensaje confirmando: `✅ Roles asignados exitosamente`.
5. **Inicia Sesión** de nuevo en el Frontend. A partir de ahora tendrás acceso completo como `ADMIN` y podrás aprobar a futuros usuarios desde el panel de "Usuarios Pendientes".

---

## 🔒 Seguridad y Consistencia

- **Zero Trust en Firestore:** Por defecto, las reglas de Firestore (`firestore.rules`) bloquean cualquier intento de escritura directa desde el cliente web.
- **Backend Centralizado:** Toda la creación, modificación y subida de archivos se realiza mediante el backend `apps/api`, donde NestJS utiliza el *Firebase Admin SDK* y valida los Custom Claims.
- **Tipos Compartidos:** El paquete `packages/shared` actúa como la única fuente de la verdad para las interfaces (por ejemplo, esquemas de transacciones), impidiendo desajustes entre la API y el Frontend.

---

## 🧪 Tests

El backend (`apps/api`) cuenta con una suite de tests completa ejecutada con **Jest** y **ts-jest**.

### Estrategia

| Tipo | Herramientas | Ubicación |
|------|-------------|-----------|
| Unitarios | Jest + `jest-mock-extended` | `apps/api/src/**/*.spec.ts` |
| E2E / Integración | Jest + Supertest | `apps/api/test/**/*.e2e-spec.ts` |

### Cobertura mínima exigida (gate del pipeline)

| Métrica | Umbral |
|---------|--------|
| Líneas | ≥ 80 % |
| Ramas | ≥ 75 % |
| Funciones | ≥ 80 % |
| Sentencias | ≥ 80 % |

### Tests E2E disponibles

- **`proyectos.e2e-spec.ts`** — CRUD completo de proyectos con validación de presupuesto.
- **`transactions.e2e-spec.ts`** — Creación, listado y filtrado de transacciones financieras.
- **`usuarios.e2e-spec.ts`** — Registro, aprobación y gestión de roles de usuarios.
- **`app.e2e-spec.ts`** — Salud del servidor (`/health`).

### Ejecutar los tests localmente

```bash
# Desde la raíz del monorepo

# Tests unitarios (con cobertura)
pnpm --filter @cgpa/api test:cov

# Tests E2E
pnpm --filter @cgpa/api test:e2e

# Tests en modo watch (desarrollo)
pnpm --filter @cgpa/api test:watch
```

> Los umbrales de cobertura están configurados en el campo `"jest"` del `apps/api/package.json`. Si no se alcanzan, el comando retorna código de salida ≠ 0 y bloquea el pipeline de CI.

---

## 🚀 Despliegue (CI/CD)

Todo el despliegue del proyecto está automatizado con tres flujos de trabajo de **GitHub Actions**.

### Diagrama de flujo

```
Pull Request abierto
       │
       ▼
┌─────────────────────────────────┐
│  PR — Verify & Preview          │
│  1. Unit Tests & Coverage ≥80%  │
│  2. Firebase Hosting Preview    │   ← URL de preview en el PR
└─────────────────────────────────┘

Merge a master
       │
       ▼
┌─────────────────────────────────┐
│  CI — Merge to master           │
│  1. Build verification          │   ← sanity-check de compilación
└─────────────────────────────────┘

Push de tag vX.Y.Z
       │
       ▼
┌──────────────────────────────────────────────┐
│  Release — Deploy to Production              │
│  1. Unit Tests & Coverage ≥80%               │
│  2. Deploy Frontend → Firebase Hosting live  │
│  3. Deploy Backend  → Google Cloud Run       │
└──────────────────────────────────────────────┘
```

### `PR — Verify & Preview` (`firebase-hosting-pull-request.yml`)

Se ejecuta en cada **Pull Request** hacia cualquier rama.

1. **Unit Tests & Coverage** — Corre `pnpm test:cov --ci` en `apps/api`. Falla si algún umbral no se alcanza. El reporte de cobertura se sube como artefacto de GitHub Actions (retención 7 días).
2. **Firebase Hosting Preview** — Si los tests pasan, despliega el frontend en un canal temporal de Firebase Hosting y publica la URL de preview como comentario en el PR.

### `CI — Merge to master` (`firebase-hosting-merge.yml`)

Se ejecuta en cada **push directo a `master`**.

1. **Build verification** — Instala dependencias y compila todo el monorepo (`pnpm install && pnpm run build`). Sirve como sanity-check; el despliegue a producción lo gestiona el flujo de Release.

### `Release — Deploy to Production` (`release-deploy.yml`)

Se ejecuta al hacer **push de un tag semántico** (`v*.*.*`).

1. **Unit Tests & Coverage** — Gate de calidad previo al deploy. El reporte de cobertura se guarda como artefacto de GitHub Actions durante 30 días.
2. **Deploy Frontend → Firebase Hosting (live)** — Construye el cliente con Vite y lo publica en el canal `live` de Firebase Hosting.
3. **Deploy Backend → Cloud Run** — Despliega la imagen del backend en Google Cloud Run (`southamerica-west1`) usando `gcloud run deploy --source .` autenticado con `GCP_CREDENTIALS`. El tag de Cloud Run replica el semver del release (`.` → `-`, ej: `v1.2.3` → `v1-2-3`).

> Los jobs 2 y 3 del flujo de Release corren **en paralelo** una vez que el job de tests pasa (`needs: test`).

### Dockerfile (build multi-stage)

El backend se containeriza con un **Dockerfile multi-stage** en la raíz del monorepo para producir una imagen final mínima:

| Etapa | Base | Propósito |
|-------|------|-----------|
| `base` | `node:24-slim` | Activa `corepack` / pnpm |
| `build` | `base` | Instala deps, compila `shared` y `api`, crea bundle auto-contenido con `pnpm deploy --prod --legacy` |
| `prod` | `node:24-slim` | Imagen final mínima — sólo copia `/prod/api`, expone puerto 8080 |

```bash
# Build local de la imagen (desde la raíz del monorepo)
docker build -t cgpa-api .

# Ejecutar localmente
docker run -p 8080:8080 -e NODE_ENV=production cgpa-api
```

### Secretos requeridos en GitHub

| Secreto | Usado en |
|---------|----------|
| `VITE_FIREBASE_API_KEY` | PR Preview, CI Merge, Release |
| `VITE_FIREBASE_AUTH_DOMAIN` | PR Preview, CI Merge, Release |
| `VITE_FIREBASE_PROJECT_ID` | PR Preview, CI Merge, Release |
| `VITE_FIREBASE_STORAGE_BUCKET` | PR Preview, CI Merge, Release |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | PR Preview, CI Merge, Release |
| `VITE_FIREBASE_APP_ID` | PR Preview, CI Merge, Release |
| `FIREBASE_SERVICE_ACCOUNT_CGPA_LICEO_AGB` | PR Preview, Release (Hosting) |
| `GCP_CREDENTIALS` | Release (Cloud Run) |
