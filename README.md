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

## 🌐 Sitio institucional (Google Workspace for Nonprofits)

El cliente dejó de ser solo el tablero de transparencia: ahora es el **sitio web institucional
oficial** del Centro General de Padres y Apoderados del Liceo Alexander Graham Bell, publicado en
`https://cgpagrahambell.cl`.

### Rutas públicas

| Ruta | Contenido |
|---|---|
| `/` | Portada institucional: nombre legal, personalidad jurídica, misión, programas, resumen de rendición de cuentas y últimos comunicados. |
| `/nosotros` | Misión, visión, objetivos, programas, historia, ficha legal y directiva vigente (`#directiva`). |
| `/proyectos` | Proyectos financiados con su ejecución presupuestaria. |
| `/transparencia` | Saldo del fondo general y detalle de movimientos con respaldo e integridad verificable. |
| `/comunicados` | Comunicados oficiales de la directiva. |
| `/pagar` | Botón de pago Khipu para que los apoderados paguen la cuota anual u otros aportes mediante transferencia bancaria. |
| `/contacto` | Datos de la organización y formulario que persiste el mensaje en la bandeja de la directiva. |

Las rutas internas (`/login`, `/registro-interno-agb`, `/validar/:uuid`, `/admin/**`) y los
retornos de pago (`/pagar/confirmacion`, `/pagar/cancelado`) quedan fuera del catálogo público y
no se indexan.

### Origen del contenido

El texto legal, la misión y la directiva viven en `apps/client/src/content/institutional.ts` y se
editan por Pull Request. Las noticias y avisos se gestionan desde el panel de administración
(colección `comunicados`).

La lista canónica de páginas públicas está en `apps/client/src/content/public-routes.ts` y alimenta
el menú de navegación, los metadatos, el prerender y el `sitemap.xml`.

### Prerender estático

`pnpm --filter @cgpa/client build` ejecuta, después de `vite build`,
`apps/client/scripts/prerender.mjs`, que renderiza cada ruta pública en Chrome headless y escribe
`dist/<ruta>.html` junto con un `sitemap.xml` actualizado. Con `cleanUrls` habilitado en
`firebase.json`, `/nosotros` se sirve desde `nosotros.html`. Esto garantiza que el contenido
institucional esté presente en el HTML sin depender de JavaScript.

| Variable | Uso |
|---|---|
| `CHROME_PATH` | Ruta al binario de Chrome cuando no se detecta automáticamente. |
| `PRERENDER_STRICT=1` | Hace fallar el build si no hay Chrome disponible. |
| `PRERENDER_SETTLE_MS` | Espera adicional antes de capturar el HTML (por defecto 400 ms). |
| `PRERENDER_DATA_TIMEOUT_MS` | Espera máxima a que se resuelvan los bloques con datos dinámicos, para no grabar un indicador de carga en el HTML estático (por defecto 8000 ms). |

Los runners `ubuntu-latest` de GitHub Actions ya incluyen Chrome. Si el script no encuentra un
navegador, omite el prerender con una advertencia y el build continúa (salvo `PRERENDER_STRICT=1`).

El script guarda en `dist/.prerender-shell.html` una copia normalizada de la plantilla generada por
Vite, que reutiliza mientras no se vuelva a compilar. Eso lo hace determinista: ejecutarlo dos veces
seguidas produce exactamente los mismos archivos. `vite build` vacía el directorio, así que la
plantilla siempre se regenera tras cada compilación. Firebase Hosting no publica ese archivo porque
las reglas de `firebase.json` ignoran los nombres que empiezan por punto.

> Checklist de cumplimiento para la postulación: [google-workspace-nonprofits-checklist.md](docs/google-workspace-nonprofits-checklist.md)

---

## 💳 Botón de pago

La página `/pagar` permite a los apoderados pagar la cuota anual u otros aportes mediante
**transferencia bancaria simplificada**. La implementación actual usa **Khipu (API v3)**.

> **Documentación técnica completa:** [docs/integracion-pasarelas-pago.md](docs/integracion-pasarelas-pago.md)
> — arquitectura, modelo de datos, contrato `PasarelaPago` y **procedimiento paso a paso para
> agregar una pasarela nueva** (incluye notas de Webpay Plus).
> Especificación del proveedor vigente: [boton_de_pago.md](docs/boton_de_pago.md).

### Flujo

1. El apoderado completa nombre, correo, motivo y monto en `/pagar`.
2. `POST /api/pagos/:proveedor` valida el payload, genera el `transaction_id` interno y crea el
   cobro en la pasarela. El backend devuelve `payment_url` y el frontend redirige al portal de pago.
3. El apoderado paga y vuelve a `/pagar/confirmacion?transaction_id=…` o
   `/pagar/cancelado?transaction_id=…`.
4. La pasarela notifica a `POST /api/pagos/:proveedor/webhook`.
5. El backend **nunca confía en el cuerpo de la notificación**: cada pasarela verifica el pago
   servidor a servidor y solo entonces se actualiza el registro local. El proceso es idempotente y
   valida que el monto y la moneda coincidan con el cobro original.

### Endpoints

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| `POST` | `/api/pagos/:proveedor` | Público | Crea el cobro y devuelve `payment_url`. |
| `POST` | `/api/pagos/:proveedor/webhook` | Público | Recibe la notificación y verifica el pago. |
| `GET` | `/api/pagos/:transactionId` | Público | Estado del cobro (sin datos personales ni tokens). |
| `GET` | `/api/pagos` | `ADMIN` activo | Últimos 200 cobros para la directiva. |

Valores de `:proveedor`: `khipu`.

### Arquitectura

El orquestador ([pagos.service.ts](apps/api/src/pagos/pagos.service.ts)) concentra la persistencia,
la idempotencia y las transiciones de estado; no conoce detalles de ningún proveedor. Cada pasarela
implementa el contrato [PasarelaPago](apps/api/src/pagos/pasarelas/pasarela-pago.interface.ts)
(`crearCobro`, `extraerReferenciaNotificacion`, `verificarPago`) y se registra en
[pagos.module.ts](apps/api/src/pagos/pagos.module.ts).

Agregar un método de pago nuevo no requiere tocar el orquestador, las reglas de Firestore ni las
páginas de confirmación. El procedimiento completo está en
[integracion-pasarelas-pago.md § 8](docs/integracion-pasarelas-pago.md#8-procedimiento-agregar-una-nueva-pasarela).

### Persistencia

Los cobros se guardan en la colección `pagos`, usando el `transaction_id` como id del documento y
con un campo `proveedor` que indica la pasarela. Los estados internos son `PENDIENTE`, `PAGADO`,
`CANCELADO` y `FALLIDO`; cada pasarela los traduce desde su propio vocabulario (`done`,
`verifying`, `cancelled`, `failed` en Khipu).

> El pago confirmado **no** crea automáticamente una transacción de ingreso: la directiva decide
> cuándo conciliarlo en la contabilidad del CGPA con su respaldo correspondiente.

### Variables de entorno (`apps/api`)

| Variable | Obligatoria | Descripción |
|---|---|---|
| `KHIPU_API_KEY` | Sí (si Khipu está activo) | Clave del portal de desarrolladores. Sin ella, `/pagos/khipu` responde `503`. |
| `KHIPU_API_BASE_URL` | No | Base de la API v3 (por defecto `https://khipu.com/api/v3`). |
| `PUBLIC_API_URL` | No | URL pública de la API; de ella se deriva `<…>/pagos/<proveedor>/webhook`. Si falta, se usa `VERIFICATION_BASE_URL` + `/api`. |
| `CLIENT_BASE_URL` | No | URL del frontend para `return_url` y `cancel_url`. Si falta, se usa `VERIFICATION_BASE_URL`. |
| `PAGO_TTL_DIAS` | No | Vigencia de cada cobro en días (por defecto `7`). |

### Seguridad

- Las credenciales y las URLs de retorno se generan solo en el backend; el cliente no puede alterarlas.
- El webhook solo aporta una referencia; el estado real siempre se obtiene desde la pasarela.
- Un pago `PAGADO` nunca retrocede por una notificación duplicada o fuera de orden.
- Una notificación de una pasarela distinta a la del cobro se descarta.
- Las reglas de Firestore bloquean toda lectura/escritura directa a `pagos`.
- Los errores de comunicación con la pasarela se registran con `Logger` para facilitar el soporte.

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
Copia los archivos de ejemplo de variables de entorno del cliente y de la API:
```bash
cp apps/client/.env.example apps/client/.env
cp apps/api/.env.example apps/api/.env
```
Edita `apps/client/.env` con las claves correspondientes de tu proyecto en la Consola de Firebase.
En `apps/api/.env` configura `DOCUMENT_SALT` y, si vas a probar el botón de pago, las variables
`KHIPU_*` y `PUBLIC_API_URL` descritas en [Botón de pago](#-botón-de-pago).

> El pago con Khipu no funciona en modo offline: su webhook debe ser accesible desde internet. En
> local, expón la API con un túnel (por ejemplo `ngrok http 3000`) y usa esa URL en `PUBLIC_API_URL`.

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
- **`comunicados.e2e-spec.ts`** — Endpoint público, autenticación y CRUD de comunicados.
- **`mensajes.e2e-spec.ts`** — Formulario público de contacto, validación, filtro anti-spam y control de acceso por rol de la bandeja de la directiva.
- **`pagos.e2e-spec.ts`** — Botón de pago Khipu: creación pública, validación, webhook JSON y form-urlencoded, consulta de estado e historial solo para ADMIN.
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

### Tests del cliente

El cliente (`apps/client`) usa **Vitest** con `happy-dom` y cubre el contenido institucional, los
utilidades de formato y de formulario, los metadatos por ruta, el layout público, las vistas
públicas y la estructura del router.

```bash
# Tests del cliente
pnpm --filter @cgpa/client test

# Modo watch
pnpm --filter @cgpa/client test:watch
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
| `KHIPU_API_KEY` | Release (Cloud Run) |

> `VITE_FIREBASE_MEASUREMENT_ID` (Google Analytics) se define como **Variable de repositorio**, no como secreto: su valor es público y viaja en el bundle del cliente. Si falta, el sitio no registra analítica.
