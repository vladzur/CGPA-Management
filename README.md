# Plataforma de Transparencia Financiera CGPA

Este repositorio contiene la plataforma de transparencia financiera para el Centro General de Padres (CGPA), desarrollada utilizando una arquitectura de monorepo gestionada con **pnpm**.

El objetivo de este proyecto es permitir a la directiva del CGPA gestionar y publicar reportes financieros, mientras que los apoderados pueden visualizarlos en tiempo real y con total transparencia.

## 🚀 Stack Tecnológico

- **Gestor de Paquetes:** [pnpm](https://pnpm.io/) (Workspaces)
- **Frontend (Cliente):** [Vue 3](https://vuejs.org/) + [Vite](https://vitejs.dev/) + TypeScript
- **Backend (API):** [NestJS](https://nestjs.com/) + TypeScript
- **Base de Datos:** Google Cloud Firestore (NoSQL)
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
│   └── shared/       # Lógica compartida, tipos de TypeScript y esquemas de Firestore.
├── .idx/
│   └── dev.nix       # Entorno preconfigurado para Project IDX.
├── firebase.json     # Configuración para Firebase Hosting y Emuladores locales.
└── firestore.rules   # Reglas de Seguridad (Zero Trust: Solo lecturas).
```

## 🛠️ Desarrollo Local

Este proyecto utiliza **Project IDX** para asegurar un entorno consistente (Node.js 24) y simplificar el uso de los Emuladores de Firebase.

### 1. Preparar el Entorno
Si estás en IDX, el entorno y las extensiones se configuran automáticamente al abrir el proyecto.  
Si estás en local, asegúrate de tener instalado **Node.js 24**, **pnpm** y **Java** (necesario para los emuladores de Firebase).

Instala las dependencias en la raíz:
```bash
pnpm install
```

### 2. Emuladores de Firebase
Inicia los emuladores locales de Firestore, Auth y Hosting. En IDX, esto suele correr automáticamente al inicio gracias a la configuración en `.idx/dev.nix`.
```bash
firebase emulators:start --project demo-cgpa-platform
```
> **Nota:** Usar el prefijo `demo-` en el ID de proyecto permite trabajar 100% offline sin credenciales.

### 3. Levantar los Servicios
Puedes levantar tanto el frontend como el backend simultáneamente desde la raíz del proyecto usando:
```bash
pnpm run dev
```

Esto ejecutará `dev` en todos los workspaces (`apps/client` y `apps/api`) en paralelo.

## 🔒 Seguridad y Consistencia

- **Zero Trust en Firestore:** Por defecto, las reglas de Firestore (`firestore.rules`) bloquean cualquier intento de escritura directa desde el cliente web.
- **Backend Centralizado:** Toda la creación y modificación de reportes se realiza mediante llamadas REST a `apps/api`, donde NestJS utiliza el *Firebase Admin SDK* y valida permisos y autenticación de manera robusta.
- **Tipos Compartidos:** El directorio `packages/shared` actúa como la única fuente de la verdad para las interfaces (por ejemplo, `Report`, `Transaction`), impidiendo desajustes entre la API y el Frontend.

## 🚀 Despliegue (CI/CD)

Todo el despliegue del proyecto está planificado para ejecutarse a través de flujos de trabajo de **GitHub Actions**:

- **Backend (`apps/api`)**: Autenticado mediante *Workload Identity Federation*, compilado como una imagen Docker y publicado en **Google Cloud Run**.
- **Frontend (`apps/client`)**: Compilado por Vite (`pnpm --filter @cgpa/client build`) y publicado en **Firebase Hosting**. Las reglas de Firestore también se despliegan automáticamente.
