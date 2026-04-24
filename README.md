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

## 🚀 Despliegue (CI/CD)

Todo el despliegue del proyecto está automatizado con flujos de trabajo de **GitHub Actions**:

- **Backend (`apps/api`)**: Autenticado mediante *Workload Identity Federation*, compilado como una imagen de contenedor en Artifact Registry y publicado en **Google Cloud Run**.
- **Frontend (`apps/client`)**: Compilado por Vite y desplegado globalmente en el CDN de **Firebase Hosting**. Las reglas de seguridad de Firestore también se actualizan automáticamente en este paso.
