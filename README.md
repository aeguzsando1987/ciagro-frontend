# CIAgro Alpha — Frontend

Webapp del producto CIAgro: visor agrícola, Task Manager (Gantt) y central de datos.
SPA construida sobre **Vite + React + TypeScript**, consumiendo la API REST del
backend Django (`CIAgro_alpha_backend`).

> **Estado:** Fase 0 (selección de stack y scaffolding) — Sesión 1, 2026-05-12.
> Las primeras rutas y features se montan en Fase Frontend 1.

---

## Setup local

### Requisitos

- **Node.js >= 20** (recomendado vía `nvm`).
- **Backend levantado** en `http://localhost:8500/api/v1/` (ver `../CIAgro_alpha_backend/README.md`).

### Pasos

```bash
# 1. Instalar dependencias
npm install

# 2. Copiar variables de entorno y completar
cp .env.example .env.local
#   - VITE_API_BASE_URL: URL del backend (default OK para dev local)
#   - VITE_MAPTILER_KEY: API key de https://cloud.maptiler.com (free tier)

# 3. Levantar dev server (puerto 5173)
npm run dev

# 4. (Opcional) Generar tipos TypeScript desde el OpenAPI del backend.
#    Requiere el backend corriendo.
npm run types:gen

# 5. Instalar navegadores de Playwright (sólo la primera vez)
npx playwright install
```

---

## Scripts disponibles

| Script | Qué hace |
|---|---|
| `npm run dev` | Levanta dev server con HMR en http://localhost:5173 |
| `npm run build` | Compila TS y genera bundle de producción en `dist/` |
| `npm run preview` | Sirve el bundle de producción para probar local |
| `npm run lint` | Corre ESLint sobre todo el proyecto |
| `npm run format` | Formatea código con Prettier |
| `npm run typecheck` | Verifica tipos sin emitir output |
| `npm run test` | Corre tests unitarios + componente con Vitest |
| `npm run test:watch` | Vitest en modo watch |
| `npm run test:ui` | Dashboard interactivo de Vitest |
| `npm run test:e2e` | Tests E2E con Playwright |
| `npm run test:e2e:ui` | Playwright en modo UI |
| `npm run types:gen` | Regenera `src/types/api.d.ts` desde `/api/schema/` |

---

## Stack elegido (Fase 0)

| Capa | Decisión | Detalle en |
|---|---|---|
| Framework + bundler | Vite + React 18 + TS strict | `logs/dev_log.csv` Paso 1 |
| Routing | TanStack Router (`/w/<dc>/...`) | Paso 2 |
| Server state | TanStack Query v5 | Paso 3 |
| Client state | Zustand | Paso 4 |
| Auth storage 🛑 | access en memoria + refresh en localStorage | Paso 5 |
| UI | shadcn/ui + Tailwind + Radix | Paso 6 |
| Forms | react-hook-form + zod | Paso 7 |
| Mapas | MapLibre GL + react-map-gl + MapTiler | Paso 8 |
| Gantt | gantt-task-react (con plan B) | Paso 9 |
| i18n | sin librería + `src/lib/strings.ts` | Paso 10 |
| Testing | Vitest + RTL + MSW + Playwright | Paso 11 |
| Tipos API | openapi-typescript + openapi-fetch | Paso 12 |

---

## Estructura del proyecto

```
src/
├── routes/        # rutas TanStack Router (Fase 1+)
├── features/      # código por dominio funcional (auth, task-manager, ...)
├── components/    # ui/ (shadcn) + layout/ + common/
├── lib/           # api, auth, format, strings, utils
├── types/         # api.d.ts (generado) + domain.ts
├── styles/        # globals.css
└── test/          # setup compartido de Vitest + MSW

e2e/               # tests Playwright
logs/              # roadmap, development, dev_log, gap_log, commit_msg
public/            # assets estáticos
```

Detalle completo y convenciones de naming: `logs/dev_log.csv` Paso 13.

---

## Workflow recomendado por fase

1. Antes de empezar una fase, leer el `product-doc.md` (`.context/templates/`) y
   confirmar que los endpoints existen (Swagger UI: `http://localhost:8500/api/docs/`).
2. Cada decisión nueva queda en `logs/dev_log.csv` con motivo.
3. Cada hueco detectado en backend o producto queda en `logs/gap_log.csv`.
4. Al cierre de fase: `npm run typecheck && npm run test && npm run test:e2e` deben
   pasar; `logs/development.md` recibe entrada con resumen y deuda técnica abierta.

---

## Despliegue

> Pendiente de definir. SPA estática (output `dist/`) servible por cualquier host
> estático (Nginx, Caddy, S3+CloudFront, Vercel, Netlify). El interceptor JWT y
> el manejo de auth están diseñados para funcionar con backend en mismo o distinto
> dominio (decisión Paso 5).

---

## Backend asociado

`../CIAgro_alpha_backend/` — Django 5 + DRF + GeoDjango + PostGIS. 416 tests OK
al cierre de Fase Y. Toda decisión del frontend se respalda en endpoints
existentes y testeados (`product-doc.md` sección 6).
