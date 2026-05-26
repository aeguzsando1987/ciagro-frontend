# syntax=docker/dockerfile:1

# ─────────────────────────────────────────────────────────────────────────────
# Stage 1 — build: compila la SPA de Vite a archivos estáticos en /app/dist
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS build
WORKDIR /app

# Instala dependencias con la lockfile (capa cacheable)
COPY package.json package-lock.json ./
RUN npm ci

# Código fuente
COPY . .

# Vite incrusta las VITE_* en el bundle EN BUILD-TIME (no hay env en runtime).
# Por defecto VITE_API_BASE_URL es relativa: nginx proxea /api al backend (mismo origen).
ARG VITE_API_BASE_URL=/api/v1
ARG VITE_MAPTILER_KEY=
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
ENV VITE_MAPTILER_KEY=${VITE_MAPTILER_KEY}
RUN npm run build

# ─────────────────────────────────────────────────────────────────────────────
# Stage 2 — serve: nginx sirve dist/ y proxea /api al backend Django
# ─────────────────────────────────────────────────────────────────────────────
FROM nginx:1.27-alpine AS serve

# Plantilla: el entrypoint oficial corre envsubst sobre /etc/nginx/templates/*.template
# sustituyendo ${BACKEND_ORIGIN} en arranque (las vars $uri/$host de nginx se conservan).
COPY nginx.default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html

# Destino del proxy del API. Override en runtime vía -e BACKEND_ORIGIN=...
ENV BACKEND_ORIGIN=http://host.docker.internal:8500

EXPOSE 80
