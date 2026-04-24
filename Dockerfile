# Etapa 1: Base con PNPM
FROM node:24-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV CI=true
RUN corepack enable

# Etapa 2: Construcción
FROM base AS build
WORKDIR /app

# Copiar archivos de configuración del workspace
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copiar el paquete compartido y la API
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api

# Instalar dependencias (frozen-lockfile garantiza reproducibilidad)
RUN pnpm install --frozen-lockfile

# Compilar los paquetes
RUN pnpm --filter @cgpa/shared build
RUN pnpm --filter @cgpa/api build

# Eliminar devDependencies para reducir tamaño
RUN pnpm install --prod --frozen-lockfile

# Etapa 3: Producción
FROM base AS prod
WORKDIR /app

# Copiar configuración raíz
COPY package.json pnpm-workspace.yaml ./

# Copiar node_modules productivos de la etapa de build
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=build /app/apps/api/node_modules ./apps/api/node_modules

# Copiar el paquete compartido
COPY --from=build /app/packages/shared/package.json ./packages/shared/
COPY --from=build /app/packages/shared/dist ./packages/shared/dist

# Copiar la aplicación compilada
COPY --from=build /app/apps/api/package.json ./apps/api/
COPY --from=build /app/apps/api/dist ./apps/api/dist

# Variables de entorno por defecto
ENV NODE_ENV=production
# Cloud Run inyecta la variable PORT automáticamente, la capturamos
ENV PORT=3000

# Exponer el puerto
EXPOSE $PORT

# Comando de inicio
CMD ["node", "apps/api/dist/main.js"]
