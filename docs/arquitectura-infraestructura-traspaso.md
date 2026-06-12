# Plataforma CGPA — Documento de Infraestructura y Traspaso

> **Propósito:** Este documento describe la infraestructura completa de la plataforma CGPA para facilitar el traspaso de propiedad y operación a la nueva directiva del Centro General de Padres y Apoderados del Liceo AGB.

---

## 1. Visión General de Infraestructura

La plataforma corre íntegramente sobre **Google Cloud Platform (GCP)** a través de un proyecto Firebase. No hay servidores físicos ni VMs que administrar.

```
┌─────────────────────────────────────────────────────────────────┐
│                    google.com/cgpa-liceo-agb                     │
│                                                                  │
│  ┌──────────────────────┐    ┌──────────────────────────────┐   │
│  │   Firebase Hosting    │    │      Google Cloud Run         │   │
│  │   (Frontend Vue SPA)  │───▶│      (Backend NestJS API)     │   │
│  │                       │    │      southamerica-west1       │   │
│  └──────────────────────┘    └─────────────┬────────────────┘   │
│                                            │                     │
│                     ┌──────────────────────┼──────────────────┐ │
│                     │                      │                   │ │
│                     ▼                      ▼                   ▼ │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │   Firestore   │  │    Firebase   │  │   Firebase Storage   │  │
│  │   (Base datos)│  │     Auth      │  │   (Comprobantes)     │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
│                                                                  │
│  Despliegue: GitHub Actions (repositorio vladzur/CGPA)          │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Arquitectura de Dos Proyectos

La plataforma opera con **dos proyectos Firebase/GCP separados**:

| Proyecto | Propietario | Propósito |
|---|---|---|
| `cgpa-liceo-agb` | Cuenta personal del desarrollador (vladzur) | Sandbox de desarrollo, datos dummy, pruebas de features |
| `[COMPLETAR — project ID de producción]` | Cuenta institucional del CGPA | Producción real con usuarios y transacciones reales |

Esta separación permite:
- Probar cambios nuevos en el sandbox sin riesgo para los datos reales
- El desarrollador mantiene un entorno de pruebas con datos dummy
- El CGPA tiene control total sobre su proyecto de producción (IAM, facturación, acceso)

El código es el mismo para ambos — la diferencia está en los **GitHub Secrets** y las **variables de entorno** que apuntan a cada proyecto.

> **Procedimiento detallado de migración:** Ver [procedimiento-migracion-nuevo-proyecto.md](procedimiento-migracion-nuevo-proyecto.md)

---

## 3. Proyecto Firebase / GCP (Producción)

| Campo | Valor |
|---|---|
| **ID del proyecto GCP** | `[COMPLETAR]` |
| **ID del proyecto Firebase** | `[COMPLETAR]` |
| **Plan Firebase** | Blaze (pay-as-you-go) — requerido para Cloud Run |
| **Región principal** | `southamerica-west1` (Santiago, Chile) |
| **Organización GCP** | [COMPLETAR] |
| **Cuenta de facturación** | [COMPLETAR — ID de billing account asociado] |

### 3.1 Ruta de migración: Gmail → Google Workspace (Non-Profit)

El CGPA puede iniciar operaciones con una cuenta `@gmail.com` gratuita y migrar posteriormente a Google Workspace cuando obtenga la certificación **Google for Nonprofits**. Esta ruta no implica pérdida de datos ni cambios en el project ID.

**Fase 1 — Arranque inmediato (hoy)**

| Componente | Configuración |
|---|---|
| Cuenta Google | `cgpa.liceo.agb@gmail.com` (gratuita) |
| Proyecto Firebase/GCP | Creado bajo esta cuenta |
| Facturación | Tarjeta de crédito/débito de un directivo |
| Repositorio GitHub | Mismo repo, secrets apuntan a este proyecto |

**Fase 2 — Migración a Workspace (cuando se obtenga Non-Profit)**

Google for Nonprofits está disponible en Chile. El CGPA (como corporación sin fines de lucro) puede postular y recibir **Google Workspace Business Starter gratuito** (hasta 2,000 usuarios).

Una vez aprobado:

1. Se crea el Workspace con dominio propio (ej: `admin@cgpaliceoagb.cl`)
2. Se crea la **organización GCP** asociada al Workspace
3. Se migra el proyecto Firebase/GCP desde `@gmail.com` a la organización usando [GCP Resource Manager](https://cloud.google.com/resource-manager/docs/project-migration)
4. Se actualiza la facturación a la cuenta del Workspace

**Qué NO cambia durante esta migración:**

| Recurso | ¿Se preserva? |
|---|---|
| Project ID | Sí, no cambia |
| API keys de Firebase Web | Sí, idénticas |
| Datos en Firestore | Sí, intactos |
| Usuarios de Firebase Auth | Sí, sin cambios |
| Archivos en Storage | Sí, sin cambios |
| URLs de Firebase Hosting | Sí, no cambian |
| Configuración de Cloud Run | Sí, no cambia |
| GitHub Secrets | No es necesario actualizar ninguno |

**Qué SÍ cambia:**

- El proyecto queda bajo la organización GCP del CGPA (control institucional)
- La facturación migra a la cuenta del Workspace
- Los administradores del Workspace heredan acceso administrativo al proyecto

> **Requisitos para Google for Nonprofits en Chile:** Personalidad jurídica vigente (corporación o fundación sin fines de lucro), inscripción en el registro correspondiente. La validación la realiza un partner local de Google.

### Servicios GCP activos

| Servicio | Uso | Región |
|---|---|---|
| Firebase Hosting | Servir el frontend SPA/PWA | Global (CDN) |
| Cloud Run | Ejecutar el backend NestJS | `southamerica-west1` |
| Cloud Firestore (Native) | Base de datos principal NoSQL | `southamerica-west1` |
| Firebase Authentication | Login de usuarios (email/password) | Global |
| Cloud Storage (Firebase) | Almacenar comprobantes/respaldos | `southamerica-west1` |
| Cloud Build | Compilar imagen Docker para Cloud Run | Global |
| Artifact Registry | Almacenar imágenes Docker | `southamerica-west1` |

---

## 3. Dominios y DNS

| Tipo | Valor |
|---|---|
| **Dominio principal** | [COMPLETAR — ej: cgpa-liceo-agb.web.app] |
| **Dominio personalizado** | [COMPLETAR — si existe dominio propio configurado en Firebase Hosting] |
| **URL del frontend (prod)** | `https://cgpa-liceo-agb.web.app` |
| **URL del backend (prod)** | `https://api-xxxxx-uc.a.run.app` (Cloud Run asigna subdominio automático) |
| **Firebase Hosting domain** | `cgpa-liceo-agb.web.app` (automático) |
| **Firebase Hosting domain** | `cgpa-liceo-agb.firebaseapp.com` (automático) |

> **Nota:** Si se requiere un dominio personalizado (ej: `cgpaliceoagb.cl`), debe configurarse en Firebase Hosting Console > Dominios personalizados. Implica verificar propiedad del dominio y añadir registros DNS A y TXT.

---

## 4. Cloud Run — Backend

### Configuración del servicio

| Parámetro | Valor |
|---|---|
| **Nombre del servicio** | `api` |
| **Región** | `southamerica-west1` |
| **Runtime** | Node.js 24 (Dockerfile multi-stage) |
| **Puerto** | 8080 |
| **CPU** | [COMPLETAR — default: 1 vCPU por instancia] |
| **Memoria** | [COMPLETAR — default: 512 MiB] |
| **Mínimo de instancias** | 0 (scale-to-zero: se apaga sin tráfico) |
| **Máximo de instancias** | [COMPLETAR — default: 100] |
| **Concurrencia** | [COMPLETAR — default: 80 requests por instancia] |
| **Timeout de request** | [COMPLETAR — default: 300s] |
| **Autenticación** | `allow-unauthenticated` (el backend maneja auth vía Firebase token) |
| **Cuenta de servicio** | [COMPLETAR — la cuenta de servicio asignada al Cloud Run, ej: `cgpa-api-sa@cgpa-liceo-agb.iam.gserviceaccount.com`] |

### Variables de entorno del backend (Cloud Run)

Estas variables se inyectan en el deploy desde el pipeline `release-deploy.yml` vía `--update-env-vars`:

| Variable | Propósito | Fuente |
|---|---|---|
| `FIREBASE_STORAGE_BUCKET` | Bucket de Storage para subir comprobantes | GitHub Secret `FIREBASE_STORAGE_BUCKET` |
| `DOCUMENT_SALT` | Salt para hash SHA-256 del sellado de documentos | GitHub Secret `DOCUMENT_SALT` |
| `VERIFICATION_BASE_URL` | URL base para links de verificación QR | GitHub Secret `VERIFICATION_BASE_URL` |
| `CGPA_RUT` | RUT del CGPA para PDFs de libro de balance | GitHub Secret `CGPA_RUT` |

> El backend en Cloud Run se autoconfigura con **Application Default Credentials (ADC)**. No necesita key files: Cloud Run obtiene las credenciales automáticamente de la cuenta de servicio del runtime.

---

## 5. Firestore — Base de Datos

| Parámetro | Valor |
|---|---|
| **Modo** | Native (nuevo modo) |
| **Región** | `southamerica-west1` |
| **Reglas de seguridad** | Zero Trust — solo el Admin SDK (backend) escribe |
| **Índices compuestos** | Definidos en `firestore.indexes.json` |

### Colecciones

| Colección | Propósito | Lectura | Escritura |
|---|---|---|---|
| `configuracion` | Saldo y configuración global (1 documento) | Pública | Solo backend |
| `transacciones` | Historial financiero (append-only) | Pública | Solo backend, sin update/delete |
| `proyectos` | Proyectos del CGPA | Pública | Solo backend |
| `usuarios` | Datos de usuarios registrados | Solo ADMIN | Solo backend |
| `auditoria` | Registro de auditoría (quién hizo qué) | Solo ADMIN | Solo backend |
| `comunicados` | Comunicados publicados | Pública | Solo backend |
| `documentos` | Documentos oficiales | Pública | Solo backend |

### Índices compuestos activos

1. **Comunicados:** `estado ASC, fecha_publicacion DESC`
2. **Transacciones por proyecto:** `proyecto_id ASC, fecha ASC`

---

## 6. Firebase Authentication

| Parámetro | Valor |
|---|---|
| **Método de sign-in habilitado** | Email/Password |
| **Otros métodos** | Ninguno (sin Google, Facebook, etc.) |
| **Dominios autorizados** | `cgpa-liceo-agb.web.app`, `cgpa-liceo-agb.firebaseapp.com` (y dominios personalizados si los hay) |

### Roles (Custom Claims)

Los roles se asignan como **Firebase Custom Claims** en el token JWT del usuario:

| Rol | Claim | Acceso |
|---|---|---|
| `PENDIENTE` | `{ role: "PENDIENTE", activo: false }` | Sin acceso hasta aprobación |
| `APODERADO` | `{ role: "APODERADO", activo: true }` | Solo lectura |
| `TESORERO` | `{ role: "TESORERO", activo: true }` | Puede registrar transacciones |
| `ADMIN` | `{ role: "ADMIN", activo: true }` | Acceso total, aprueba usuarios |

Los claims se asignan desde el script `apps/api/set-admin.ts` o desde el endpoint `PATCH /usuarios/:uid/aprobar`.

---

## 7. Firebase Storage

| Parámetro | Valor |
|---|---|
| **Bucket** | Según `FIREBASE_STORAGE_BUCKET` |
| **Reglas** | Lectura pública, escritura solo backend |
| **Path de comprobantes** | `comprobantes/{uuid}.{extension}` |
| **Tipos permitidos** | `image/*`, `application/pdf` |

---

## 8. CI/CD — GitHub Actions

El pipeline de despliegue está en el repositorio GitHub. Actualmente bajo la cuenta `vladzur/CGPA`.

### Workflows

| Workflow | Disparador | Qué hace |
|---|---|---|
| `PR — Verify & Preview` | Pull Request | Tests + coverage ≥80%, preview de Firebase Hosting |
| `CI — Merge to master` | Push a `master` | Build de verificación (sanity check) |
| `Release — Deploy to Production` | Push de tag `v*.*.*` | Tests → Deploy frontend (Firebase Hosting) + backend (Cloud Run) en paralelo |
| `Run Firestore Migrations` | Manual (`workflow_dispatch`) | Ejecuta script de migración contra Firestore producción |

### Flujo de release típico

```bash
# 1. Crear tag semántico en git
git tag v1.2.3

# 2. Empujar el tag
git push origin v1.2.3

# 3. GitHub Actions ejecuta release-deploy.yml automáticamente:
#    - Corre tests con coverage
#    - Si pasa: despliega frontend a Firebase Hosting (canal live)
#    - Si pasa: despliega backend a Cloud Run (con tag v1-2-3)
```

### Secrets de GitHub requeridos

| Secreto | Dónde se usa |
|---|---|
| `VITE_FIREBASE_API_KEY` | PR Preview, CI Merge, Release |
| `VITE_FIREBASE_AUTH_DOMAIN` | PR Preview, CI Merge, Release |
| `VITE_FIREBASE_PROJECT_ID` | PR Preview, CI Merge, Release |
| `VITE_FIREBASE_STORAGE_BUCKET` | PR Preview, CI Merge, Release |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | PR Preview, CI Merge, Release |
| `VITE_FIREBASE_APP_ID` | PR Preview, CI Merge, Release |
| `FIREBASE_SERVICE_ACCOUNT_CGPA_LICEO_AGB` | PR Preview, Release (Firebase Hosting deploy) |
| `GCP_CREDENTIALS` | Release (Cloud Run deploy + auth) |
| `FIREBASE_STORAGE_BUCKET` | Release (Cloud Run env var) |
| `DOCUMENT_SALT` | Release (Cloud Run env var) |
| `VERIFICATION_BASE_URL` | Release (Cloud Run env var) |
| `CGPA_RUT` | Release (Cloud Run env var) |

---

## 9. Docker — Imagen del Backend

### Build multi-stage (`Dockerfile` en raíz del monorepo)

| Etapa | Base | Resultado |
|---|---|---|
| `base` | `node:24-slim` | Habilita `corepack` y `pnpm` |
| `build` | `base` | Instala deps, compila `@cgpa/shared` + `@cgpa/api`, genera bundle con `pnpm deploy --prod` |
| `prod` | `node:24-slim` | Imagen final mínima (`/prod/api`), expone puerto 8080 |

```bash
# Build local (para debugging)
docker build -t cgpa-api .

# Ejecutar localmente
docker run -p 8080:8080 -e NODE_ENV=production cgpa-api
```

### Artifact Registry

Cloud Run almacena las imágenes en Artifact Registry. Cada deploy genera una revisión nueva con tag semántico (ej: `v1-2-3`), lo que permite rollback instantáneo desde Cloud Run Console.

---

## 10. Cuentas de Servicio y Permisos IAM

### Cuentas de servicio clave

| Cuenta de servicio | Uso | Permisos necesarios |
|---|---|---|
| **GitHub Actions Deploy SA** | `GCP_CREDENTIALS` — despliegue de Cloud Run | `Cloud Run Admin`, `Cloud Build Editor`, `Artifact Registry Writer`, `Service Account User` |
| **Firebase Deploy SA** | `FIREBASE_SERVICE_ACCOUNT_CGPA_LICEO_AGB` — deploy de Firebase Hosting | `Firebase Hosting Admin` |
| **Cloud Run Runtime SA** | Cuenta asignada al servicio `api` de Cloud Run (ADC) | `Firestore Datastore Owner`, `Firebase Admin SDK` (se autoconfigura) |

### Acceso humano al proyecto GCP

| Persona | Rol | Correo |
|---|---|---|
| [COMPLETAR] | Owner / Firebase Admin | [COMPLETAR] |
| [COMPLETAR] | Editor (despliegues) | [COMPLETAR] |

---

## 11. Entorno de Desarrollo Local

### Requisitos de máquina del desarrollador

- Node.js >= 24.0.0
- pnpm >= 11.0.0
- Java Runtime (para emuladores de Firebase)
- Firebase CLI (`npm install -g firebase-tools`)
- Docker (opcional, para probar build de Cloud Run)

### Emuladores de Firebase (desarrollo local)

| Servicio | Puerto |
|---|---|
| Auth | 9099 |
| Firestore | 8080 |
| Hosting | 5000 |
| Storage | 9199 |
| UI (consola) | 4000 |

### Variables de entorno para desarrollo

**`apps/client/.env`:**
```
VITE_API_URL="http://localhost:3000/api"
VITE_FIREBASE_API_KEY="demo-api-key"
VITE_FIREBASE_AUTH_DOMAIN="cgpa-liceo-agb.firebaseapp.com"
VITE_FIREBASE_PROJECT_ID="cgpa-liceo-agb"
VITE_FIREBASE_STORAGE_BUCKET="cgpa-liceo-agb.firebasestorage.app"
VITE_FIREBASE_MESSAGING_SENDER_ID="123456789"
VITE_FIREBASE_APP_ID="1:123456789:web:abcdef123456"
```

**`apps/api/.env`:**
```
FIREBASE_STORAGE_BUCKET="cgpa-liceo-agb.firebasestorage.app"
DOCUMENT_SALT="cambiar-por-salt-segura-de-al-menos-32-caracteres"
VERIFICATION_BASE_URL="http://localhost:5173"
CGPA_RUT="XX.XXX.XXX-X"
```

### Comandos de desarrollo

```bash
pnpm install                    # Instalar dependencias
firebase emulators:start        # Iniciar emuladores (requiere Java)
pnpm dev                        # Iniciar frontend + backend en paralelo
pnpm --filter @cgpa/api test    # Tests unitarios
pnpm --filter @cgpa/api test:e2e # Tests E2E
pnpm build                      # Build completo
```

---

## 12. Procedimientos Operativos

### 12.1 Crear una release (despliegue a producción)

1. Asegurarse de que todos los cambios están mergeados en `master`.
2. Los tests deben pasar: `pnpm --filter @cgpa/api test:cov`
3. Crear tag semántico:
   ```bash
   git tag v1.2.3
   git push origin v1.2.3
   ```
4. Monitorear el progreso en GitHub Actions > Release workflow.
5. Verificar que el frontend carga en `https://cgpa-liceo-agb.web.app`.
6. Verificar la API: `curl https://api-xxxxx-uc.a.run.app/api/health`.

### 12.2 Rollback de emergencia

**Cloud Run (backend):**
- Ir a Cloud Run Console > `api` > Revisions
- Seleccionar la revisión anterior (con tag `vX-Y-Z`) y hacer "Manage traffic" > 100% a esa revisión.

**Firebase Hosting (frontend):**
- Ir a Firebase Hosting Console > Historial de despliegues
- Hacer rollback a un despliegue anterior con un clic.

### 12.3 Agregar primer administrador (nueva organización)

Si se parte desde cero en un nuevo proyecto, o se necesita crear el primer ADMIN:

1. El usuario se registra en la plataforma (`/registro-interno-agb`).
2. El nuevo administrador (con acceso al proyecto GCP) ejecuta:
   ```bash
   cd apps/api
   export GOOGLE_APPLICATION_CREDENTIALS="/ruta/a/firebase-adminsdk.json"
   npx ts-node set-admin.ts correo@ejemplo.com
   ```
3. Se confirma: "Roles asignados exitosamente".
4. El usuario cierra y vuelve a iniciar sesión. Ahora es ADMIN y puede aprobar a otros usuarios.

### 12.4 Ejecutar migraciones en Firestore

1. Ir a GitHub Actions > "Run Firestore Migrations"
2. Hacer clic en "Run workflow"
3. Ingresar el nombre del archivo de migración (ej: `001-init-config.js`)
4. Ejecutar
5. Verificar logs en el workflow run

### 12.5 Configurar dominio personalizado

Si se desea usar un dominio propio (ej: `transparencia.cgpaliceoagb.cl`):

1. En Firebase Console > Hosting > "Add custom domain".
2. Seguir el wizard: se proporcionarán registros TXT (verificación) y A (apuntar a IPs de Firebase).
3. Configurar los DNS en el proveedor del dominio.
4. Esperar propagación (~1-24 horas).
5. Firebase aprovisiona automáticamente un certificado SSL.

---

## 13. Seguridad

### Controles implementados

| Control | Implementación |
|---|---|
| **Firestore Zero Trust** | Los clientes web no pueden escribir — solo el backend Admin SDK |
| **Transacciones inmutables** | Sin update/delete en `transacciones` — append-only |
| **Autenticación Firebase** | Email/password con token JWT verificado en cada request |
| **Validación Zod** | Schemas compartidos (`@cgpa/shared`) validan todo input en backend |
| **Custom Claims** | Roles en JWT token, verificados en backend |
| **Sellado criptográfico** | SHA-256 encadenado para documentos |
| **Auditoría completa** | Cada acción de escritura registra actor, colección, documento y payload |
| **HTTPS** | Firebase Hosting + Cloud Run sirven solo sobre TLS |

### Checklist de seguridad para traspaso

- [ ] Rotar todas las claves de servicio (service account keys) de GCP
- [ ] Rotar `DOCUMENT_SALT` a un nuevo valor aleatorio (mín. 32 caracteres)
- [ ] Cambiar contraseñas de cuentas de Google con acceso al proyecto
- [ ] Revisar y actualizar lista de usuarios con rol ADMIN en Firestore
- [ ] Verificar que no haya keys de servicio expuestas en el repositorio
- [ ] Auditar los collaborators del repositorio GitHub
- [ ] Revisar los secrets de GitHub Actions y renovar los que corresponda

---

## 14. Costos y Facturación

### Modelo de costos estimado (mensual)

| Recurso | Costo estimado | Notas |
|---|---|---|
| **Firebase Hosting** | $0 USD | 10 GB almacenamiento + 360 MB/mes de transferencia gratuitos |
| **Cloud Run** | ~$0-15 USD/mes | Scale-to-zero. Sin tráfico = $0. Con tráfico moderado: ~$5-15 USD |
| **Firestore** | ~$0-5 USD/mes | 1 GB almacenamiento + 50K lecturas/día gratuitos (Spark). Si se excede: Blaze pricing |
| **Firebase Auth** | $0 USD | Ilimitado para email/password |
| **Cloud Storage** | ~$0-2 USD/mes | 5 GB almacenamiento gratuito |
| **Cloud Build** | ~$0-3 USD/mes | 120 build-minutes/día gratuitos |
| **Artifact Registry** | ~$0-2 USD/mes | Depende de cuántas imágenes se almacenan |

> **Total estimado:** $0-25 USD/mes con uso moderado. El plan Spark de Firebase cubre la mayoría de necesidades. Si se exceden los límites gratuitos, se requiere migrar a plan Blaze (pay-as-you-go).

### Dónde ver los costos

1. GCP Console > Billing > Reports
2. Firebase Console > Project Settings > Usage and Billing

---

## 15. Checklist de Traspaso

### Semana 1-2: Acceso y conocimiento

- [ ] Transferir propiedad del proyecto GCP `cgpa-liceo-agb` al nuevo dueño (GCP Console > IAM > Manage Resources)
- [ ] Transferir propiedad o agregar admin al repositorio GitHub
- [ ] Crear/rotar cuentas de servicio de GCP para CI/CD
- [ ] Actualizar `GCP_CREDENTIALS` y `FIREBASE_SERVICE_ACCOUNT_CGPA_LICEO_AGB` en GitHub Secrets
- [ ] Actualizar resto de secretos en GitHub (`VITE_*`, `DOCUMENT_SALT`, etc.)
- [ ] Entregar acceso a Firebase Console a los nuevos administradores
- [ ] Configurar billing alert en GCP (ej: alerta si el gasto supera $20 USD/mes)
- [ ] Documentar contactos de emergencia

### Semana 2-4: Verificación y capacitación

- [ ] Verificar que el pipeline de CI/CD funciona (crear un PR de prueba, hacer release de prueba)
- [ ] Verificar que el dominio personalizado funciona (si aplica)
- [ ] Capacitar a un administrador técnico en:
  - Crear releases
  - Hacer rollback
  - Agregar/quitar administradores de la plataforma
  - Revisar logs de Cloud Run
  - Ejecutar migraciones
- [ ] Capacitar a un administrador funcional en:
  - Aprobar usuarios pendientes
  - Registrar transacciones
  - Crear y gestionar proyectos
  - Publicar comunicados

### Post-traspaso

- [ ] Confirmar que todas las claves de servicio anteriores han sido revocadas
- [ ] Confirmar que el billing está funcionando en la cuenta del nuevo dueño
- [ ] Eliminar accesos de desarrolladores que ya no participan
- [ ] Programar una revisión de seguimiento a 30 días

---

## 16. Puntos de Contacto y Referencias

### Consolas de administración

| Recurso | URL |
|---|---|
| **Firebase Console** | `https://console.firebase.google.com/project/cgpa-liceo-agb` |
| **GCP Console** | `https://console.cloud.google.com/home/dashboard?project=cgpa-liceo-agb` |
| **Cloud Run Console** | `https://console.cloud.google.com/run?project=cgpa-liceo-agb` |
| **GitHub Repository** | [COMPLETAR — URL del repo si cambia de dueño] |

### Contactos técnicos

| Rol | Nombre | Correo | Teléfono |
|---|---|---|---|
| Desarrollador original | Vladimir Zurita | [COMPLETAR] | [COMPLETAR] |
| [COMPLETAR] | [COMPLETAR] | [COMPLETAR] | [COMPLETAR] |

### Recursos de aprendizaje

- [Firebase Documentation](https://firebase.google.com/docs)
- [NestJS Documentation](https://docs.nestjs.com/)
- [Cloud Run Documentation](https://cloud.google.com/run/docs)

---

## Apéndice A: Glosario

| Término | Definición |
|---|---|
| **ADC** | Application Default Credentials — mecanismo de GCP para autenticar servicios automáticamente |
| **Cloud Run** | Servicio de GCP que ejecuta contenedores sin servidor (serverless) |
| **Custom Claims** | Atributos dentro del JWT de Firebase Auth que definen el rol del usuario |
| **Firestore** | Base de datos NoSQL de Firebase/GCP |
| **Firebase Hosting** | CDN + hosting estático de Firebase |
| **Monorepo** | Estructura de repositorio que contiene múltiples proyectos (apps/client + apps/api + packages/shared) |
| **NestJS** | Framework backend en TypeScript inspirado en Angular |
| **PWA** | Progressive Web App — permite instalar la web como app nativa |
| **SPA** | Single Page Application — aplicación web que carga una sola página HTML |
| **Zero Trust** | Arquitectura donde ningún cliente recibe confianza por defecto; cada request se autentica y autoriza |
