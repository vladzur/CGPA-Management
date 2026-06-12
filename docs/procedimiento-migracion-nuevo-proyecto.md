# Procedimiento de Migración — Nuevo Proyecto CGPA

> **Objetivo:** Crear un proyecto Firebase/GCP nuevo bajo una cuenta institucional del CGPA, desplegar la plataforma desde cero y dejar el proyecto original (`cgpa-liceo-agb`) como sandbox de desarrollo.

---

## Arquitectura post-migración

```
┌──────────────────────────────────────┐    ┌──────────────────────────────────────┐
│  Proyecto ORIGINAL (vladzur)         │    │  Proyecto NUEVO (CGPA)               │
│  cgpa-liceo-agb                      │    │  cgpa-liceo-agb-prod (o nombre TBD)  │
│                                      │    │                                      │
│  ► Sandbox de desarrollo             │    │  ► Producción real                   │
│  ► Datos dummy                       │    │  ► Usuarios reales                   │
│  ► Pruebas de features nuevas        │    │  ► Transacciones reales              │
│  ► CI/CD: GitHub Actions (PR)        │    │  ► CI/CD: GitHub Actions (release)   │
└──────────────────────────────────────┘    └──────────────────────────────────────┘
```

---

## Fase 1 — Crear la cuenta institucional y el proyecto

### 1.1 Crear cuenta Google para el CGPA

Crear una cuenta Gmail institucional:
- **Correo sugerido:** `cgpa.liceo.agb@gmail.com` o similar
- **Contraseña:** segura, almacenada en un gestor de contraseñas compartido con la directiva
- **Recuperación:** configurar teléfono y correo de respaldo de al menos 2 miembros de la directiva

### 1.2 Crear nuevo proyecto Firebase

1. Iniciar sesión en [Firebase Console](https://console.firebase.google.com) con la cuenta institucional
2. Crear proyecto nuevo:
   - **Nombre:** `CGPA Liceo AGB`
   - **Project ID:** `cgpa-liceo-agb` (si está disponible) o `cgpa-agb-prod` o similar
   - **Analytics:** Opcional (no usado por ahora)
3. Anotar el Project ID exacto: `_______________`

### 1.3 Configurar plan y facturación

1. En Firebase Console >左下 "Spark plan" > Upgrade
2. Seleccionar plan **Blaze (pay-as-you-go)** — necesario para Cloud Run
3. Asociar una cuenta de facturación de GCP (la directiva debe crear una)
4. Configurar alertas de presupuesto:
   - GCP Console > Billing > Budgets & alerts
   - Presupuesto mensual: $20 USD
   - Alertas a: 50%, 75%, 90%, 100%

### 1.4 Habilitar servicios

Desde GCP Console (`https://console.cloud.google.com`), habilitar APIs:

| API | Propósito |
|---|---|
| Cloud Firestore API | Base de datos |
| Cloud Run API | Backend |
| Cloud Build API | Compilar imágenes Docker |
| Artifact Registry API | Almacenar imágenes |
| Firebase Hosting API | Hosting frontend |
| Cloud Storage API | Almacenar comprobantes |
| Identity and Access Management (IAM) API | Permisos |

O simplemente ir a Firebase Console > Build > Firestore > Create database (esto habilita varias APIs automáticamente).

---

## Fase 2 — Configurar servicios Firebase

### 2.1 Firestore

1. Firebase Console > Firestore > Create database
2. Modo: **Native** (no Datastore)
3. Región: `southamerica-west1` (Santiago)

### 2.2 Authentication

1. Firebase Console > Authentication > Get started
2. Sign-in method > Email/Password > Enable
3. **No habilitar** Email link (passwordless) — mantener solo contraseña

### 2.3 Storage

1. Firebase Console > Storage > Get started
2. Región: `southamerica-west1`

### 2.4 Hosting

1. Firebase Console > Hosting > Get started
2. Seguir el wizard (no es necesario instalar Firebase CLI ahora, se hará después)

---

## Fase 3 — Configurar proyecto localmente

### 3.1 Inicializar Firebase CLI con el nuevo proyecto

```bash
# Desde la raíz del repositorio
firebase use --add
# Seleccionar el nuevo proyecto (ej: cgpa-agb-prod)
# Alias sugerido: prod

# Verificar
firebase use
# Debe mostrar ambos proyectos:
#   default → cgpa-liceo-agb (sandbox)
#   prod    → cgpa-agb-prod (producción)
```

### 3.2 Desplegar reglas de Firestore e índices

```bash
firebase use prod
firebase deploy --only firestore:rules,firestore:indexes
```

### 3.3 Desplegar reglas de Storage

```bash
firebase deploy --only storage
```

### 3.4 Crear documento de configuración inicial

Ejecutar la migración manualmente (requiere credenciales GCP):

```bash
cd apps/api

# Autenticarse con credenciales de GCP del nuevo proyecto
export GOOGLE_APPLICATION_CREDENTIALS="/ruta/a/key-nuevo-proyecto.json"

# Ejecutar migración
node migrations/001-init-config.js
```

> Si el proyecto es totalmente nuevo sin service account key aún, también se puede crear el documento manualmente desde Firebase Console > Firestore > Start collection > `configuracion` > documento ID `liceo_agb`:
> ```json
> {
>   "nombre": "Centro General de Padres AGB",
>   "periodo_actual": "2026",
>   "saldo_total": 0,
>   "ultima_actualizacion": "<server timestamp>"
> }
> ```

---

## Fase 4 — Variables de entorno y secretos

### 4.1 Obtener configuración web de Firebase

1. Firebase Console > Project settings > General > Your apps
2. Agregar app web (`</>` icono)
3. Nickname: `CGPA Web`
4. **NO** marcar "Firebase Hosting" (ya está configurado)
5. Copiar el objeto `firebaseConfig`:

```js
const firebaseConfig = {
  apiKey: "AIza...",              // → VITE_FIREBASE_API_KEY
  authDomain: "xxx.firebaseapp.com",  // → VITE_FIREBASE_AUTH_DOMAIN
  projectId: "xxx",               // → VITE_FIREBASE_PROJECT_ID
  storageBucket: "xxx.appspot.com",   // → VITE_FIREBASE_STORAGE_BUCKET (se usa en 2 lugares)
  messagingSenderId: "xxx",       // → VITE_FIREBASE_MESSAGING_SENDER_ID
  appId: "xxx"                    // → VITE_FIREBASE_APP_ID
};
```

### 4.2 Generar salt para DOCUMENT_SALT

```bash
# Generar salt aleatoria segura (mínimo 32 caracteres)
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

### 4.3 Definir VERIFICATION_BASE_URL

- Si no hay dominio personalizado: `https://<project-id>.web.app`
- Si hay dominio personalizado: `https://transparencia.cgpaliceoagb.cl`

### 4.4 Crear Service Accounts para CI/CD

Se necesitan **dos cuentas de servicio**:

**A. Para Firebase Hosting deploy**

1. GCP Console > IAM > Service Accounts > Create Service Account
2. Nombre: `github-actions-firebase`
3. Roles:
   - `Firebase Hosting Admin`
   - `API Keys Viewer` (para acceder a Firebase config)
4. Crear key JSON y descargar → será `FIREBASE_SERVICE_ACCOUNT` en GitHub Secrets

**B. Para Cloud Run deploy**

1. GCP Console > IAM > Service Accounts > Create Service Account
2. Nombre: `github-actions-cloud-run`
3. Roles:
   - `Cloud Run Admin`
   - `Cloud Build Editor`
   - `Artifact Registry Writer`
   - `Service Account User`
   - `Storage Admin` (para Cloud Build)
4. Crear key JSON y descargar → será `GCP_CREDENTIALS` en GitHub Secrets

### 4.5 Actualizar GitHub Secrets

En el repositorio GitHub (Settings > Secrets and variables > Actions), actualizar:

| Secreto | Nuevo valor |
|---|---|
| `VITE_FIREBASE_API_KEY` | apiKey del nuevo proyecto |
| `VITE_FIREBASE_AUTH_DOMAIN` | authDomain del nuevo proyecto |
| `VITE_FIREBASE_PROJECT_ID` | projectId del nuevo proyecto |
| `VITE_FIREBASE_STORAGE_BUCKET` | storageBucket del nuevo proyecto |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | messagingSenderId del nuevo proyecto |
| `VITE_FIREBASE_APP_ID` | appId del nuevo proyecto |
| `FIREBASE_SERVICE_ACCOUNT_CGPA_LICEO_AGB` | Contenido del JSON de service account A |
| `GCP_CREDENTIALS` | Contenido del JSON de service account B |
| `FIREBASE_STORAGE_BUCKET` | storageBucket del nuevo proyecto |
| `DOCUMENT_SALT` | Salt generada en paso 4.2 |
| `VERIFICATION_BASE_URL` | URL base del frontend en prod |
| `CGPA_RUT` | RUT del CGPA Liceo AGB |

---

## Fase 5 — Primer despliegue

### 5.1 Verificar que .firebaserc apunta a producción

```bash
cat .firebaserc
# Debe mostrar "default": "cgpa-liceo-agb"
# El alias "prod" debe apuntar al nuevo proyecto
```

Asegurarse de que los workflows usan `--project` explícito o el alias correcto. El workflow `release-deploy.yml` ya usa `projectId: cgpa-liceo-agb` en el paso de hosting. Se debe actualizar al nuevo project ID.

### 5.2 Actualizar projectId en workflows

Revisar y actualizar estas referencias:

- `.github/workflows/release-deploy.yml` línea con `projectId: cgpa-liceo-agb` → nuevo project ID
- `.github/workflows/firebase-hosting-pull-request.yml` línea con `projectId: cgpa-liceo-agb` → nuevo project ID

### 5.3 Crear primera release

```bash
git tag v1.0.0
git push origin v1.0.0
```

Esto dispara `release-deploy.yml` que:
1. Corre tests + coverage
2. Despliega frontend a Firebase Hosting (canal `live`)
3. Despliega backend a Cloud Run

### 5.4 Verificar el despliegue

```bash
# Verificar frontend
curl -I https://<nuevo-project-id>.web.app

# Verificar backend
curl https://<cloud-run-url>/api/health

# Verificar que el balance CORS y rewrite funciona
# Navegar a https://<nuevo-project-id>.web.app e iniciar sesión
```

---

## Fase 6 — Crear el primer administrador

### 6.1 Registrar usuario

1. Navegar a `https://<nuevo-project-id>.web.app/registro-interno-agb`
2. Registrar con el correo del presidente/tesorero del CGPA

### 6.2 Asignar rol ADMIN

```bash
cd apps/api

# Autenticarse con credenciales del NUEVO proyecto
export GOOGLE_APPLICATION_CREDENTIALS="/ruta/a/key-nuevo-proyecto.json"

# Ejecutar script set-admin
npx ts-node set-admin.ts correo@registrado.com
```

**Confirmación esperada:**
```
Roles asignados exitosamente:
  Email: correo@registrado.com
  Rol: ADMIN
  Activo: true
```

### 6.3 Verificar acceso

1. Cerrar sesión y volver a iniciar en el frontend
2. Verificar que aparece el panel de administración completo
3. Verificar acceso a `/admin/pendientes`

---

## Fase 7 — Configurar el entorno de desarrollo dual

Para mantener ambos proyectos funcionando en desarrollo:

### 7.1 Scripts de emuladores con alias

```bash
# Sandbox (proyecto personal, datos dummy)
firebase emulators:start --project demo-cgpa-liceo-agb

# Producción local (para probar contra el nuevo proyecto en emulador)
# No necesario normalmente — solo si se quiere simular el entorno de prod en local
firebase use prod && firebase emulators:start
firebase use default  # volver al sandbox
```

### 7.2 Archivo .env del cliente para sandbox

`apps/client/.env` (sandbox, ya existe):
```
VITE_API_URL="http://localhost:3000/api"
VITE_FIREBASE_API_KEY="demo-api-key"
VITE_FIREBASE_AUTH_DOMAIN="cgpa-liceo-agb.firebaseapp.com"
VITE_FIREBASE_PROJECT_ID="cgpa-liceo-agb"
VITE_FIREBASE_STORAGE_BUCKET="cgpa-liceo-agb.appspot.com"
VITE_FIREBASE_MESSAGING_SENDER_ID="123456789"
VITE_FIREBASE_APP_ID="1:123456789:web:abcdef123456"
```

### 7.3 Archivo .env del backend para sandbox

`apps/api/.env` (sandbox, ya existe):
```
FIREBASE_STORAGE_BUCKET="cgpa-liceo-agb.appspot.com"
DOCUMENT_SALT="dev-salt-para-pruebas-no-usar-en-prod"
VERIFICATION_BASE_URL="http://localhost:5173"
CGPA_RUT="XX.XXX.XXX-X"
```

---

## Fase 8 — Verificaciones post-migración

### Checklist funcional

- [ ] Registro de usuario funciona en producción
- [ ] Inicio de sesión funciona en producción
- [ ] `set-admin.ts` asigna rol correctamente
- [ ] Crear transacción funciona (con y sin comprobante PDF/imagen)
- [ ] Crear proyecto funciona
- [ ] Subir comprobante a Storage funciona
- [ ] URL del comprobante es accesible públicamente
- [ ] El balance (`saldo_total`) se actualiza atómicamente
- [ ] Las transacciones filuran por proyecto correctamente
- [ ] La auditoría registra todas las operaciones
- [ ] Los usuarios pendientes aparecen en panel admin
- [ ] Aprobar usuario asigna rol correctamente
- [ ] Documentos: crear, sellar y verificar con QR
- [ ] Comunicados: crear y visualizar
- [ ] PWA: instalar en dispositivo móvil

### Checklist de seguridad

- [ ] `firestore.rules` bloquean escritura desde cliente (verificar con reglas desplegadas)
- [ ] `storage.rules` bloquean escritura desde cliente
- [ ] Las URL de comprobantes son accesibles públicamente (lectura OK)
- [ ] Los endpoints de la API validan token Firebase en cada request
- [ ] `DOCUMENT_SALT` es secreto y diferente al de desarrollo
- [ ] Las service account keys de CI/CD tienen permisos mínimos necesarios
- [ ] No hay keys hardcodeadas en el código

---

## Resumen: qué cambia y qué no

### Código: sin cambios (ya portable)

Los cambios recientes eliminaron los hardcodes de `cgpa-liceo-agb` en:
- `storage.service.ts` → usa `FIREBASE_STORAGE_BUCKET` obligatorio
- `documentos.service.ts` → usa `VERIFICATION_BASE_URL` obligatorio  
- `migrations/001-init-config.js` → usa ADC sin projectId explícito

### Configuración: todo cambia

- `.firebaserc` → apunta a ambos proyectos (default=sandbox, prod=nuevo)
- GitHub Secrets → todos los valores son del nuevo proyecto
- GitHub Workflows → projectId actualizado
- `.env` de desarrollo → mantiene valores del sandbox

### Lo que NO se migra (fresh start)

- Usuarios de Firebase Auth → se registrarán de nuevo
- Datos de Firestore → se crean desde cero con `001-init-config.js`
- Archivos en Storage → empieza vacío
