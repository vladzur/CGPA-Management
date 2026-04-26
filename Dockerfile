# ── Etapa 1: Base con PNPM ────────────────────────────────────────────────
FROM node:24-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# ── Etapa 2: Build ────────────────────────────────────────────────────────
FROM base AS build
WORKDIR /app

# Copiar manifiestos del workspace
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json         ./apps/api/

# Instalar TODAS las dependencias (incluyendo devDeps para compilar)
RUN pnpm install --frozen-lockfile

# Copiar fuentes
COPY packages/shared ./packages/shared
COPY apps/api        ./apps/api

# Compilar shared y luego la API
RUN pnpm --filter @cgpa/shared build
RUN pnpm --filter @cgpa/api    build

# Usar `pnpm deploy` para crear un directorio de despliegue auto-contenido
# que resuelve los symlinks de workspace correctamente
RUN pnpm --filter @cgpa/api deploy --prod --legacy /prod/api

# Copiar el dist compilado al directorio de deploy
# NestJS compila a dist/src/main.js (tsconfig rootDir=src)
RUN cp -r /app/apps/api/dist/. /prod/api/dist/

# ── Etapa 3: Producción ───────────────────────────────────────────────────
FROM node:24-slim AS prod
WORKDIR /app

# Copiar el bundle auto-contenido generado por pnpm deploy
COPY --from=build /prod/api ./

ENV NODE_ENV=production
# Cloud Run inyecta PORT=8080 en runtime — NO fijar aquí
EXPOSE 8080

CMD ["node", "dist/src/main.js"]
