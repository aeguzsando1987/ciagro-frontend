# Bitácora de Desarrollo — CIAgro Alpha Frontend

> Registro narrativo por sesión de las decisiones, cambios y aprendizajes del frontend.
> Complementa al `dev_log.csv` (registro tabular paso a paso) y al `gap_log.csv`
> (huecos detectados y diferimientos).

---

## Sesión 1 — 2026-05-12

### Fase 0 — Selección de stack y scaffolding (en curso)

**Contexto:** Sesión de arranque del frontend de CIAgro. Backend ya completo y testeado
(416 tests OK, base `http://localhost:8500/api/v1/`, JWT, Swagger en `/api/docs/`).
Esta sesión sigue el contrato `act: plan` con modos activos
`pedagogic, didactic, propose, pragmatic, verbose, strict`. No se escribe código de
aplicación; se decide el stack tema por tema con `propose` y se deja scaffolding
inicial.

**Pasos completados (1–12, decisiones de stack):**

Cada decisión presentó 2–3 opciones con trade-offs explícitos antes de elegir. Cuando
el usuario lo solicitó, se profundizó con ejemplos prácticos y/o glosario en
`.context/`. Las 12 decisiones quedan asentadas con motivo en `dev_log.csv`. Resumen
ejecutivo del stack elegido:

- **Framework**: Vite + React + TypeScript (strict).
- **Routing**: TanStack Router con DC en URL `/w/<dc>/...`.
- **Server state**: TanStack Query v5.
- **Client state**: Zustand (uso restringido a estado global no derivable de URL ni server).
- **Auth storage**: access en memoria + refresh en localStorage. Gap futuro a httpOnly cookie.
- **UI**: shadcn/ui + Tailwind CSS + Radix UI primitives.
- **Forms**: react-hook-form + zod.
- **Mapas**: MapLibre GL + react-map-gl. Tile provider inicial: MapTiler free tier.
- **Gantt**: gantt-task-react con plan B documentado.
- **i18n**: sin librería; `src/lib/strings.ts` para strings compartidos.
- **Testing**: Vitest + Testing Library + MSW (unit/component) + Playwright (E2E).
- **Tipos API**: openapi-typescript + openapi-fetch.

**Documentos de apoyo generados durante la sesión:**

- `.context/glossary-fase0-paso1.md` — glosario y comparativa detallada del Paso 1
  (Framework). Solicitado por el usuario para estudio a fondo.

**Aclaración de nomenclatura de logs:**

El `session_contract.json` listaba `gaps.csv` como archivo de huecos. El backend usa
`gap_log.csv`. Por requerimiento explícito del usuario en el Paso 13 ("los mismos
documentos del backend"), se adopta `gap_log.csv` para mantener consistencia entre
proyectos. Documentado también en `gap_log.csv` como nota.

**Pasos pendientes en esta sesión:**

- 0.13 — Estructura de carpetas y naming (en curso).
- 0.14 — Generar scaffolding (`package.json`, configs, `src/lib/api/client.ts`,
  estructura `src/`).
- 0.15 — Validar endpoints Fase 1 con curl o Swagger UI.
- 0.16 — Documentar seed mínimo de backend en `gap_log.csv`.
- 0.17 — Escribir plan completo de Fases Frontend 1–10 en `roadmap.md`.

**Gaps abiertos al cierre de Pasos 1–12 (ver `gap_log.csv` para detalle):**

- `GAP-FUTURO-001` — Migración a httpOnly cookies (media prioridad).
- `GAP-FUTURO-002` — Migración a react-i18next cuando exista requisito multi-idioma (baja).
- `GAP-INFRA-001` — Definir tile provider definitivo según tráfico real (baja).
- `GAP-INFRA-002` — Automatizar generación de tipos OpenAPI (baja).
- `GAP-RIESGO-001` — Re-evaluar gantt-task-react al final de Sprint 1 Fase 2 (media).

**Resultado parcial:** stack consolidado y trazado, listo para definir estructura de
carpetas en Paso 13 y generar scaffolding en Paso 14.

---

### Paso 14 — Scaffolding generado

22 archivos creados en `CIAgro_alpha_front/`. NO se ejecutó `npm install` (regla
🛑 #2 — la corre el usuario manualmente). El cliente HTTP usa `unknown` como tipo
de paths hasta correr `npm run types:gen` la primera vez (Fase Frontend 1, después
de validar endpoints).

Configuración destacada:
- **TS strict** + `noUncheckedIndexedAccess` + `noUnusedLocals` para máxima cobertura
  estática.
- **Vitest dentro de vite.config.ts** con jsdom + setupFiles → un solo punto de
  configuración para tests unitarios y de componente.
- **Playwright** con 3 browsers (Chromium, Firefox, WebKit) y trace/video on-failure.
- **ESLint v9 flat config** + Prettier + plugin Tailwind.
- **shadcn ya configurado** vía `components.json` (style "default", baseColor "slate",
  CSS variables) — agregar primer componente con `npx shadcn@latest add button` cuando
  empiece Fase 1.

### Paso 15 — Checklist de validación de endpoints Fase Frontend 1

Decisión: opción ii — script + checklist generados ahora; ejecución real a cargo
del usuario cuando el backend tenga el seed mínimo (Paso 16) levantado.

**Cómo correr la validación (cuando backend + seed estén listos):**

```bash
cd CIAgro_alpha_front
# Crear .env-seed con credenciales del usuario seed (no committear)
cat > .env-seed <<EOF
SEED_USERNAME=superadmin-seed
SEED_PASSWORD=changeme
EOF

./scripts/validate-endpoints-fase1.sh
# Output en consola + log en logs/validation-fase1-<timestamp>.log
```

**Endpoints que valida** (alineados a `product-doc.md` Flujo 1):

| # | Endpoint | Esperado | Verifica |
|---|---|---|---|
| 0 | `GET /api/schema/` | 200 | OpenAPI disponible (pre-req `npm run types:gen`) |
| 1 | `POST /auth/login/` | 200 + access/refresh/user/requires_password_change | Paso 1.1 |
| 2 | `POST /auth/refresh/` | 200 + access nuevo | Paso 1.9 |
| 3 | `GET /users/me/` | 200 + id/username/email/user_role/datacentrals | Paso 1.3 |
| 4 | `GET /organizations/data-centrals-main/` | 200 + lista | Paso 1.4 |
| 5 | `GET /organizations/datacentrals/` | 200 + lista | Paso 1.4-1.5 |
| 6 | `POST /auth/change-password/` | 400 con body vacío | Paso 1.2 |
| 7 | `POST /auth/logout/` | 205/200/204 | Paso 1.10 |

**Si algún check falla** → registrar como gap específico en `gap_log.csv` y decidir
si bloquea Fase Frontend 1 o se difiere. El backend está testeado (416 tests OK)
así que se esperan 0 fallos; cualquier fallo apunta a entorno mal configurado.

### Paso 16 — Seed mínimo del backend

`GAP-BACKEND-001` abierto en `gap_log.csv` con prioridad **alta**. Inventario mínimo:
1 SuperAdmin + 1 Gerente + 1 Técnico + 1 User con `requires_password_change=true` +
2 DataCentralMain + 3+ DataCentral hijas con UserAssignments + 1+ AgroUnit por DC.
Recomendación: management command `python manage.py seed_dev` idempotente. Sin este
seed no se puede ejecutar `validate-endpoints-fase1.sh` con éxito ni desarrollar
Fase Frontend 1. Acción: coordinar con equipo backend en próxima sesión.

### Paso 17 — Roadmap completo de Fases Frontend 1–10

`logs/roadmap.md` reescrito con plan detallado:
- **Fase 1** (3 dev-weeks) — Auth + workspace, dividida en sprints A/B/C con 18 tareas.
- **Fase 2** (4 dev-weeks) — Task Manager Gantt en sprints A/B/C/D con 19 tareas y
  punto de re-evaluación de `gantt-task-react` al final de Sprint 2.C.
- **Fases 3–10** caracterizadas con sprints estimados (~14.5 dw combinadas), backend
  estado y notas UX pendientes.
- **Total estimado:** ~22 dev-weeks (~5 meses con 1 dev senior full-time).
- Tabla consolidada de los 6 gaps abiertos con disparadores de resolución.

---

## Cierre de Sesión 1 / Fase 0 — 2026-05-12

**17/17 pasos completados.**

**Decisiones de stack** (12 con `propose`, todas con motivo en `dev_log.csv`):
Vite + React + TS · TanStack Router/Query (DC en URL) · Zustand · access en
memoria + refresh en LS · shadcn/ui + Tailwind + Radix · react-hook-form + zod ·
MapLibre GL + MapTiler · gantt-task-react · sin i18n + `lib/strings.ts` ·
Vitest + RTL + MSW + Playwright · openapi-typescript + openapi-fetch.

**Salidas físicas:**
- Carpeta `CIAgro_alpha_front/` con 22 archivos de scaffolding (config, plumbing
  transversal, entry points, README).
- Estructura de carpetas `src/` por feature.
- Carpeta `logs/` con 5 archivos consistentes con backend (`roadmap.md`,
  `development.md`, `dev_log.csv`, `gap_log.csv`, `commit_msg.txt`).
- `scripts/validate-endpoints-fase1.sh` ejecutable.
- `.context/glossary-fase0-paso1.md` como apoyo de estudio (Paso 1).

**Gaps abiertos (6 total):**

| ID | Prioridad | Bloquea |
|---|---|---|
| `GAP-BACKEND-001` (seed) | **alta** | Fase 1 |
| `GAP-FUTURO-001` (httpOnly cookies) | media | No bloquea |
| `GAP-RIESGO-001` (gantt jerarquía) | media | Re-evaluación en Fase 2 |
| `GAP-FUTURO-002` (i18n) | baja | No bloquea |
| `GAP-INFRA-001` (tile provider) | baja | No bloquea |
| `GAP-INFRA-002` (codegen automation) | baja | No bloquea |

**Deuda técnica abierta al cierre:**
- `npm install` no ejecutado (requerimiento explícito: lo corre el usuario).
- `src/types/api.d.ts` es placeholder hasta primera generación contra backend.
- `src/lib/api/client.ts` usa `unknown` como tipo de paths hasta primera generación
  (TODO marcado con comentario en el código).
- Refresh silencioso ante 401 documentado pero no implementado en `client.ts`
  (queda para Fase 1, Sprint 1.C, tarea 1.16).

**Para arrancar Fase Frontend 1, en orden:**

1. Resolver `GAP-BACKEND-001` (coordinar con equipo backend).
2. `cd CIAgro_alpha_front && npm install && npx playwright install`.
3. `cp .env.example .env.local` y completar valores.
4. Crear `.env-seed` con credenciales del usuario seed.
5. `./scripts/validate-endpoints-fase1.sh` debe correr verde.
6. `npm run types:gen` debe generar `src/types/api.d.ts`.
7. Actualizar `src/lib/api/client.ts` para importar `paths` de `@/types/api`.
8. Abrir nueva sesión con contrato `act: implement` y `feature: Fase Frontend 1`.

**Estado del contrato:** `meta.current_step` puede avanzarse al inicio de Fase 1
(numeración a definir en el contrato de Fase 1).

---

## Sesión 2 — 2026-05-13

### Fase Frontend 1 — Sprint 1.A completado

**Contexto:** Primera sesión de implementación del frontend. Contrato `act: implement`,
modos `pedagogic` (usuario implementa guiado) + `didactic` (explicación del por qué).
A mitad de sesión el usuario autorizó a Claude a implementar directamente manteniendo
el modo didáctico.

**Incidencias de arranque resueltas:**

- Node.js no estaba instalado en WSL — se instaló Node 20.19.6 vía nvm. El intento
  previo de `npm install` desde Windows CMD falló por rutas UNC incompatibles con el
  post-install script de esbuild.
- `tsconfig.json` incluía `vite.config.ts` y `playwright.config.ts` en su `include`,
  duplicando lo que ya maneja `tsconfig.node.json` con `composite: true`. Corregido
  removiéndolos del `include` del tsconfig principal.
- `Paths = unknown` en `client.ts` no satisfacía la constraint `{}` de openapi-fetch.
  Corregido a `Record<string, never>` como placeholder hasta `types:gen`.

**Decisiones técnicas tomadas (Sprint 1.A):**

- `useCurrentUser` sincroniza con `useAuthStore` vía `useEffect` (no `select` ni
  `onSuccess` — TanStack Query v5 eliminó `onSuccess` de `useQuery`; `select` es
  transformación pura, no side-effects).
- Rutas placeholder (`/workspaces`, `/change-password`) creadas inmediatamente al
  detectar error de tipo en `useNavigate` — TanStack Router tipea `to` contra las
  rutas registradas; sin el registro, TypeScript rechaza la navegación.
- `useLogin` usa `fetch` directo en lugar de `apiClient` — `client.ts` aún tiene
  `Paths = Record<string, never>`; la migración al cliente tipado se hace en Tarea 1.16
  junto con `types:gen`.
- GAP-BACKEND-001 sigue abierto. Acordado diferir a antes de Sprint 1.C (los tests E2E
  de Playwright son los únicos que requieren backend + seed real).

**Pasos completados: 1.1 → 1.7 (Sprint 1.A, 7/7)**

**Deuda tecnica Sprint 1.A:**
- `useLogin` y `useCurrentUser` usan `fetch` directo — se migran a `apiClient` tipado
  en Tarea 1.16 cuando `types:gen` este disponible.
- `tokens.getAccess()` en `_authenticated.beforeLoad` es sincrono: no intenta refresh
  si el access expiro pero el refresh sigue vigente. Se corrige en Tarea 1.16.

---

### Sprint 1.B — Tareas 1.8–1.12 (2026-05-13)

**Decisiones tecnicas tomadas:**

- `queryClient` extraido a `src/lib/queryClient.ts`: necesario para que `useChangePassword`
  pueda invalidar la query `['me']` sin hook `useQueryClient()`. Mismo patron que se usara
  en el interceptor de refresh (Tarea 1.16). `App.tsx` ahora importa la instancia en lugar
  de instanciarla localmente.
- Guard `requires_password_change` implementado en `AuthenticatedLayout` con `useEffect`,
  no en `beforeLoad`. Motivo: `beforeLoad` no tiene acceso a hooks ni datos asincrono del
  servidor; el `useEffect` con dependencia en `user` responde reactivamente cuando
  `useCurrentUser` resuelve el perfil.
- `useLogout` implementado en Sprint 1.B (adelantado desde Tarea 1.17): requerido por
  `NoAccessScreen`. Usa `onSettled` en lugar de `onSuccess` — la limpieza local de tokens
  ocurre siempre, incluso si el backend falla al blacklistear el refresh.
- `DataCentralChildSelector` acepta union type `DataCentral | WorkspaceDataCentral`:
  permite reutilizarlo con datos del fetch completo (rol >= 4) o con los datacentrals
  ya disponibles en `AuthUser` (rol < 3, sin fetch adicional — pragmatico).
- `MANAGER_LEVEL = 4` definida como constante local en `WorkspaceSelector` — se movera
  a `src/lib/auth/roles.ts` en Tarea 1.13 junto con el resto de constantes de rol.
- Rutas `/w/$dc` y `/w/$dc/dashboard` creadas como placeholders para que
  `navigate({ to: '/w/$dc/dashboard' })` compile con type-safety.

**Pasos completados: 1.8 → 1.12 (Sprint 1.B, 5/5)**

**Deuda tecnica Sprint 1.B (resuelta en 1.C):**
- `MANAGER_LEVEL` hardcodeada en `WorkspaceSelector` → migrada a `roles.ts` en Tarea 1.13.
- `useChangePassword`, `useLogin`, `useCurrentUser`, `useDataCentralsMain`, `useDataCentrals`
  usan `fetch` directo — pendiente post-GAP-BACKEND-001 (types:gen).
- `AppHeader` y `AppSidebar` implementados en Tarea 1.13.

---

### Sprint 1.C — Tareas 1.13–1.18 (2026-05-13)

**Decisiones tecnicas tomadas:**

- `useParams({ from: '/_authenticated/w/$dc' })` en lugar de `from: '/w/$dc'`: los layouts
  pathless en TanStack Router forman parte del routeId como prefijo (el `id: '_authenticated'`
  se convierte en `/_authenticated`). El path de la URL sigue siendo `/w/$dc`.
- `src/lib/auth/roles.ts` como unico punto de verdad para niveles de rol. `MANAGER_LEVEL`
  migrada desde `WorkspaceSelector`. `AppSidebar` filtra modulos por `role_level >= minRole`.
- `useWorkspaceStore` (Zustand) almacena `{ id, name }` de la DC seleccionada. El id viaja
  en la URL pero el nombre no; el store evita un fetch extra en `AppHeader` para mostrar el
  nombre. En caso de recarga, la store se pierde pero el access token tambien (clausura en
  memoria) y el usuario regresa a `/workspaces` — comportamiento correcto.
- Refresh silencioso en `client.ts`: mutex de promise compartido (`refreshPromise`) evita
  que dos requests concurrentes con 401 disparen dos rotaciones de simplejwt. Retry solo
  para GET — los cuerpos de POST/PUT ya fueron consumidos en el primer envio. `forceLogout`
  usa `window.location.replace` porque importar el router desde `client.ts` crearia circular
  dep (client → router → routes → features → client).
- Tests: `react-hook-form` llama `onSubmit(data, event)` — tests usan `expect.anything()`
  para el segundo argumento. `getByLabelText` con string exacto evita ambiguedad cuando
  dos labels comparten substring (caso "Nueva contraseña" / "Confirmar nueva contraseña").
  `useAuthStore.setState()` modifica el store directamente en tests sin mocks de modulo.
  `renderInWorkspaceRoute` crea una ruta con `id: '_authenticated'` para que `useParams`
  encuentre el routeId correcto en el arbol de test.

**Pasos completados: 1.13 → 1.18 (Sprint 1.C, 6/6)**

**Deuda tecnica abierta al cierre de Fase 1:**
- `useLogin`, `useCurrentUser`, `useChangePassword`, `useDataCentralsMain`, `useDataCentrals`
  usan `fetch` directo — migrar a `apiClient` tipado tras resolver GAP-BACKEND-001 y correr
  `npm run types:gen`.
- 3 tests E2E Playwright diferidos (GAP-BACKEND-001 bloquea backend + seed real).
- Demo manual end-to-end diferida (requiere seed).

---

## Cierre de Sesion 2 / Fase Frontend 1 — 2026-05-13

**18/18 tareas completadas. 24 tests componente verdes. 0 errores de typecheck.**

**Salidas fisicas Sprint 1.C:**
- `src/lib/auth/roles.ts` — ROLE_LEVELS (GUEST=1..SUPER_ADMIN=5)
- `src/features/workspace/useWorkspaceStore.ts` — nombre DC activa en Zustand
- `src/features/workspace/AppHeader.tsx` — logo + DC + menu usuario (cambiar/logout)
- `src/features/workspace/AppSidebar.tsx` — modulos filtrados por role_level
- `src/routes/w.$dc.tsx` — WorkspaceLayout con AppHeader + AppSidebar + Outlet
- `src/routes/w.$dc.dashboard.tsx` — bienvenida con nombre usuario + DC activa
- `src/lib/api/client.ts` — refreshMiddleware con mutex y forceLogout
- `src/test/test-utils.tsx` — helpers de test (QueryClient, router de workspace)
- `.env.test` — VITE_API_BASE_URL para MSW en tests
- 8 archivos de test (24 tests, 8 archivos)

**Para arrancar Fase Frontend 2:**

1. Resolver GAP-BACKEND-001 (seed_dev.py en backend — no tocar desde sesion frontend).
2. Ejecutar `./scripts/validate-endpoints-fase1.sh` con seed levantado.
3. Ejecutar `npm run types:gen` y actualizar `src/lib/api/client.ts` con `paths` tipados.
4. Migrar hooks (`useLogin`, etc.) a `apiClient` tipado.
5. Ejecutar 3 tests E2E Playwright (requieren backend + seed).
6. Demo manual con SuperAdmin / Gerente / Tecnico / requires_password_change.
7. Abrir nueva sesion con contrato `act: implement` y `feature: Fase Frontend 2 — Task Manager`.

---

## Demo Manual y Cierre Definitivo de Fase Frontend 1 — 2026-05-13

**Demo aprobada. Fase 1 declarada COMPLETA.**

### Bugs encontrados y corregidos durante la demo

| Bug | Causa | Fix |
|---|---|---|
| 404 en todos los requests | `.env.local` no existia — `VITE_API_BASE_URL` vacia | Crear `.env.local` desde `.env.example` y reiniciar Vite |
| "usuario o contraseña incorrectos" tras login exitoso | `useLogin` leia `data.user.requires_password_change` pero backend solo devuelve `{access, refresh}` | Simplificar `LoginResponse`, navegar siempre a `/workspaces`, dejar el guard en `_authenticated` manejar el flag |
| `mains.map is not a function` en `DataCentralMainSelector` | `useDataCentralsMain` y `useDataCentrals` asumian array plano pero DRF devuelve `{count, results: [...]}` | Extraer `.results` en ambos hooks |
| Comportamiento erratico en `requires_password_change` | Caches de `['me']` de sesion anterior servidos al guard antes del refetch con nuevos tokens | `queryClient.removeQueries({ queryKey: ['me'] })` en `useLogin.onSuccess` |

### Mejoras UX agregadas durante la demo

- `PasswordInput`: componente con boton ojito (Eye/EyeOff de lucide-react) para mostrar/ocultar texto. Aplicado a todos los campos de contraseña en `LoginForm` y `ChangePasswordForm`.
- Validacion de coincidencia en tiempo real en `ChangePasswordForm`: aviso rojo visible mientras el usuario escribe, sin esperar al submit. Implementado con `form.watch()` en `mode: 'onChange'`.

### Escenarios verificados

| Usuario | Rol | Resultado |
|---|---|---|
| `superadmin-seed` | SuperAdmin (5) | Login → 1 org padre (Alfa) con 2 DCs hijas → dashboard |
| `gerente01` | Gerente (4) | Login → Org Alfa (Alfa Norte) + Org Beta (Beta Principal) → dashboard |
| `tecnico01` | Technician (2) | Login → entra directo a CIAgro Alfa Principal |
| `newuser01` | Technician (2) | Login → guard fuerza `/change-password` → selector tras cambiar |
| `supervisor01` | Supervisor (3) | Login → guard fuerza `/change-password` → selector tras cambiar |

### Nota sobre superadmin-seed y organizaciones

`superadmin-seed` solo ve Org Alfa en el selector porque el endpoint
`/organizations/data-centrals-main/` filtra por ownership. `superadmin-seed` es dueno de
Org Alfa; Org Beta la posee `gerente01`. Comportamiento correcto del backend — el
SuperAdmin no tiene acceso automatico a todas las orgs vía ese endpoint.

### Estado de tipos generados

`src/types/api.d.ts` generado el 2026-05-13 (8974 lineas, openapi-typescript 7.13.0).
`src/lib/api/client.ts` actualizado para usar `paths` tipados. Los hooks de features
(`useLogin`, `useCurrentUser`, etc.) siguen usando `fetch` directo — la migracion a
`apiClient` tipado queda como deuda tecnica para Fase 2 (no bloquea, los tipos ya estan
disponibles para nuevos hooks).

### Deuda tecnica al cierre

- Hooks existentes usan `fetch` directo — migrar a `apiClient` tipado en Fase 2 o cuando se toquen.
- 3 tests E2E Playwright diferidos — ejecutar cuando se configure CI con backend real.
- `GAP-BACKEND-001` tecnicamente resuelto (seed_dev.py existe y corre), pero el gap formal en `gap_log.csv` queda abierto hasta que el equipo backend lo integre en su propio proceso de seed.

---

## Sesión 3 — 2026-05-13 (segunda parte)

### Fase Frontend 2 — Sprint 2.A: Listado y árbol del Gantt (completado)

**Contexto:** Iniciamos Fase 2 con todo el contexto leído (`session_contract.json`,
`rules.md`, product-doc Flujo 2, roadmap, development, gap_log). Plan aprobado vía
plan mode + `AskUserQuestion` para decisiones clave de estructura, expand/collapse y
shadcn primitives.

**Decisiones iniciales tomadas vía propose:**

- Subcarpetas por dominio dentro de `src/features/task-manager/` (gantt/, hooks/,
  dialogs/, panel/, types/) — más escalable para los 19 archivos finales de Fase 2.
- Expand/collapse jerárquico **desde Sprint 2.A** para poder evaluar GAP-RIESGO-001
  lo antes posible (en lugar de esperar a 2.C).
- shadcn primitivos añadidos **por demanda sprint a sprint** (`dialog`+`select` en
  2.B, `sheet`+`tabs` en 2.C, `table` en 2.D). Para 2.A bastó con `<select>` HTML
  nativo + clases Tailwind.

**Hallazgo crítico durante exploración:**

El `session_contract.json` listaba `/api/v1/field_ops/field-tasks/` pero el backend
usa `/api/v1/field_ops/tasks/` (verificado en `apps/field_ops/urls.py`). El
product-doc tenía razón. Corregidas 5 ocurrencias en el contrato antes de tocar
código.

**Implementación Tareas 2.1–2.5:**

Arquitectura final del módulo `src/features/task-manager/`:

```
task-manager/
├── types/index.ts               # Re-export tipos OpenAPI (MasterProgram, MasterProgramTree...)
├── hooks/
│   ├── useMasterPrograms.ts    # queryOptions + hook, paginado DRF -> .results
│   └── useMasterTree.ts        # lazy con enabled, lectura desde cache
└── gantt/
    ├── GanttChart.tsx          # Wrapper sobre gantt-task-react, TaskListHeader/Table custom
    ├── GanttHierarchy.tsx      # Orquestador con useQueries + mapMastersToTasks puro
    ├── FilterBar.tsx           # Search params status + agro_unit
    └── dateUtils.ts            # parseDate, resolveRange, pointRange, isOutOfRange (pure)
```

**Patrones establecidos para Sprints siguientes:**

- **`queryOptions` exportado** desde cada hook → loader de TanStack Router y
  componente comparten queryKey, cero refetch al montar después del loader.
- **Esquema de IDs con prefijo** (`m:`/`h:`/`s:`) en las `Task` de gantt-task-react:
  permite distinguir nivel sin lookup. `task.id.slice(2)` extrae el UUID real.
- **`useQueries` cuando N depende de runtime** (un Maestro = una query del tree).
  Respeta Rules of Hooks aunque `masters.length` cambie. Anti-patrón evitado:
  `.map(useMasterTree)`.
- **Cast localizado a `never`** para query params que existen en el backend pero
  no están en el OpenAPI schema (caso `datacentral` en `master-programs`). Cast
  con comentario explicativo, no propagar `any`.
- **`taskMeta: Record<id, {...}>` lateral** para metadata que la librería no
  soporta en su tipo `Task`. Más limpio que castear `Task as any`.

**Customización del Gantt (más allá del scope mínimo del contrato):**

El usuario pidió varias mejoras sobre el Gantt default:

1. Headers de columnas en español (Nombre/Desde/Hasta) → custom `TaskListHeader`.
2. Columna Estado nueva → `taskMeta` map + columna extra en `TaskListTable`.
3. Columnas redimensionables → `useState` + `mousemove` global con clamp 50–400px.
4. Separador vertical de 3px entre panel y timeline → CSS inline.
5. Fuentes más pequeñas para liberar espacio (font 11px, row 30px, header 42px).

Al sobrescribir `TaskListTable` perdimos el chevron de expand que renderiza la
librería por defecto — bug encontrado por el usuario durante demo (el Hijo no se
desplegaba). Fix: renderizar nosotros el botón expander (▶/▼) en el custom table
con `stopPropagation` para no abrir el DetailPanel (Sprint 2.C) al hacer click en
el chevron.

**Decisión arquitectónica reforzada por las mejoras:** el `GanttChart.tsx` aísla
TODA la dependencia con `gantt-task-react`. Si en Sprint 2.C se decide migrar el
Gantt a custom (GAP-RIESGO-001), solo este archivo se reescribe; `GanttHierarchy`,
`FilterBar` y el resto del módulo no cambian.

### Bugs corregidos durante Sprint 2.A

1. **`apiClient` baseUrl duplicado** (`/api/v1/api/v1/...`): primer consumidor real
   de `apiClient.GET()` en el código (Fase 1 todo usa `fetch` directo). El schema
   OpenAPI ya incluye `/api/v1/` en los paths; `VITE_API_BASE_URL` también termina
   en `/api/v1`. Fix: normalizar baseUrl solo para `apiClient` en `lib/api/client.ts`,
   los hooks de Fase 1 con `fetch` directo no se tocan.

2. **`AppSidebar` minRole**: "Programas" estaba en `TECHNICIAN` (2), product-doc
   indica `SUPERVISOR` (3). Corregido en paralelo a renombrar "Tareas" → "Programas"
   (terminología del dominio, decisión del usuario). Test pre-existente actualizado.

3. **`FilterBar` typecheck**: `params: (p) => p` reducer regresaba `dc?: string`
   pero la ruta exige `dc: string` (no opcional). Fix: leer `dc` con `useParams`
   y pasarlo explícito a `navigate`.

### Seed manual para demo

`gerente01` no tenía AgroUnits visibles en su scope (el `seed_dev` original no
creó productores asignados a sus DCs). Sembrado via Django shell:
`AgroUnit('Productor Demo Fase 2')` + `DataCentralAssignment(agro_unit, DC Alfa Norte)` +
`Ranch` + `Plot` + `MasterProgram 'PROG-DEMO-2A'` + `Programa 'HIJO-DEMO-2A'`.

**Aprendizaje del modelo:** `UserAssignment` vincula solo `User ↔ DataCentral`,
NO `User ↔ AgroUnit`. La visibilidad de AgroUnits del usuario se calcula via
`DataCentralAssignment(agro_unit, datacentral)` cruzando con sus `UserAssignment`s.
Importante para Sprint 2.B (`useAgroUnits` necesitará el contexto de DC).

### Cobertura de tests al cierre

| Sprint | Tests | Acumulado |
|---|---|---|
| Fase 1 (24) | 24 | 24 |
| Sprint 2.A | +27 | 51/51 verdes |

Archivos nuevos: `dateUtils.test.ts` (14), `GanttHierarchy.test.ts` (7),
`FilterBar.test.tsx` (4), `AppSidebar.test.tsx` (+1 + ajustes Tareas→Programas y
nuevo case SUPERVISOR).

### Deuda técnica abierta al cierre Sprint 2.A

- **GAP-RIESGO-001** sigue abierto. Punto de re-evaluación oficial al cierre de
  Sprint 2.C. El indicador rojo de fuera-de-rango y el expand/collapse ya
  funcionan con `gantt-task-react`; falta confirmar si la UX del timeline aguanta
  los casos reales (sesiones tipo milestone, escalas Día/Año en proyectos largos,
  performance con 50+ masters).
- **Warning `PasswordInput`/`forwardRef`** pre-existente de Fase 1, sale en
  consola durante tests y en producción. No bloquea funcionalidad. Pendiente
  encapsular `PasswordInput` con `forwardRef` (issue separado).
- **Hooks de Fase 1 con `fetch` directo** siguen sin migrar. La migración
  oportunista (al tocar el hook por otra razón) sigue válida.
- **CSS selectors hashed de `gantt-task-react`** (`._3T42e`) usados en
  `GanttChart.tsx` <style>: si actualizamos la versión de la librería pueden
  cambiar. Documentado en el archivo.

---

## Sesión 5 — 2026-05-15

### Reinicio del desarrollo del Task Manager (Fase 2)

Tras la demo manual y la depuración de los Sprints 2.A–2.C se concluyó que la
implementación del Task Manager **divergió del caso de uso**
`.context/taskmanager_usecase.md`. Se documenta aquí el estado para no perder
trazabilidad y se decide **reiniciar el desarrollo de esta parte**.

**Divergencias detectadas (el "desastre"):**

- `CreateHijoDialog` incluía un selector de **Productor** que no corresponde: el
  productor se hereda del Programa Maestro (caso de uso §3.4, §4 NOTA).
- El **ciclo** del Subprograma se capturaba como input de texto libre, en vez de
  temporada1 + temporada2 (nullable) + año, espejando `validate_cycle` (§3.5.4).
- No se manejaban `crop` / `crop_variety` según §3.5.6 (omitir variety, concatenar).
- Los formularios de edición no exponían las **fechas reales** (§2.4.1, §4.4.1).
- Las sesiones no incluían `strict_mode`, `radius_tolerance` ni `assigned_to` (§5.5).
- El navegador de modales de la ruta infería el tipo de sesión con un heurístico
  frágil sobre el árbol en cache.
- Bug confirmado: crear un Subprograma devolvía 400 sin feedback visible — el
  formulario enviaba fechas como string vacío `""` y DRF las rechazaba por formato.

**Decisión — enfoque híbrido:** se conserva la capa de datos (hooks de query y
mutación, `types/`) y toda la vista Gantt (`gantt/`, `StatusChanger`,
`PlotMiniMap`), código limpio y testeado. Se **reescribe** la capa de UI frágil:
los 3 diálogos de creación (Maestro, Hijo, Sesión), los 3 modales de detalle y el
navegador de modales de la ruta.

**Trazabilidad y seguridad:** se inicia `git` en `CIAgro_alpha_front/` para tener
puntos de rollback (commit por bloque). El reinicio se rige por las reglas nuevas
`rules.md §4.0` (flujo obligatorio por caso de uso) y las reglas `TASK MANAGER`
del contrato de sesión. Plan completo en el archivo de plan de la sesión.

**Gaps de backend abiertos:** `GAP-MODELO-001` (nombres inconsistentes de fechas
reales entre las 4 entidades de la jerarquía) y `GAP-MODELO-002` (crop/crop_variety
como dos FK separadas). Ver `gap_log.csv`.

---

## Sesión 6 — 2026-05-16

### Bloque 2 — Programa Hijo / Subprograma (caso de uso §3, §4)

**Archivos reescritos o creados:**

- `src/features/task-manager/cycle.ts` — utilidad que espeja `validate_cycle` del
  backend: constantes `SEASONS` / `CYCLE_YEARS`, `buildCycle`, `parseCycle`,
  `isSeason2AfterSeason1`. Ciclo nunca se envía como texto libre.
- `src/features/task-manager/hooks/useHijoDetail.ts` — query del detalle completo del
  Subprograma (`GET /tasks/{id}/`), que incluye `actual_start_date`, `actual_finish_date`
  y `crop` que el `ProgramaTree` del árbol no tiene.
- `src/features/task-manager/dialogs/CreateHijoDialog.tsx` — reescrito sin selector de
  Productor (muestra read-only del Maestro §3.4). Ciclo con 3 selects (temporada1,
  temporada2 con centinela `__none__`, año). Cascada Rancho → Parcela sobre
  `master.agro_unit`. Solo `crop_id` en el payload (§3.5.6). Campos opcionales vacíos
  omitidos del payload (corrige bug 400 por `""` en DateTimeField de DRF).
- `src/features/task-manager/panel/HijoModal.tsx` — reescrito con:
  - Estado local `localStatus` para feedback inmediato al cambiar status sin
    cerrar/reabrir el modal (el prop `hijo` del árbol quedaba stale hasta reload).
  - Modo edición: fechas reales (`actual_start_date` / `actual_finish_date`) siempre
    editables; datos de planificación (título, ciclo, fechas estimadas, cultivo) detrás
    de toggle con advertencia amarilla de inconsistencia (§4 NOTA).
  - Botón "Editar" deshabilitado mientras `useHijoDetail` carga (no existe dato real).
  - Mapa de parcela en columna derecha (`w-80`), con `fitBounds` + padding para mostrar
    contexto alrededor del polígono. Diálogo ampliado a `max-w-4xl`.
- `src/features/task-manager/hooks/useCrops.ts` — agregada `cropLabel` que concatena
  `name` + `variety` (§3.5.6).

**Decisiones técnicas:**

- **`localStatus` en HijoModal**: el `StatusChanger` usa el status del prop `hijo`
  (ProgramaTree) que solo se actualiza cuando la ruta re-fetcha el árbol. Sin estado
  local, el badge y las opciones del changer quedaban stale hasta cerrar y volver a
  abrir. Se mantiene sincronizado con el árbol cache (`setQueryData`) y revierte
  optimistamente ante error de PATCH.
- **Mock de `useHijoDetail` en tests**: la request al backend real escapaba a MSW en
  jsdom al ser el cuarto test de la suite (handlers ya reseteados del test anterior).
  Se mockeó el hook a nivel de módulo — correcto porque el test verifica visibilidad de
  botón por rol, no comportamiento de red.
- **`fitBounds` en PlotMiniMap**: reemplaza el cálculo manual de zoom por el motor
  nativo de MapLibre, que ajusta zoom y centrado garantizando que el polígono siempre
  entre en el viewport con el padding configurado.

**Verificación:** `npm run typecheck` → 0 errores. `npx vitest run` → 51/51 tests.
Demo manual en navegador con backend real: crear Subprograma (ciclo con selects, sin
Productor, con y sin parcela), editar fechas reales, cambiar status con feedback
inmediato, mapa de parcela visible en columna derecha.

---

## Sesión 6 (continuación) — 2026-05-16

### Bloque 3 — Sesiones Aspersión y Fitosanitario (caso de uso §5–§8)

**Contexto:** Bloque 3 completa el CRUD de sesiones. Dos tipos con modelos, endpoints
y ciclos de vida distintos que comparten la misma UI de entrada (CreateSessionDialog)
y el mismo modal de detalle/edición (SesionModal).

**Análisis backend previo a codificar (§4.0):**
- `AspersionSessionHeader` CREATE: `POST /api/v1/monitoring/aspersion/headers/`
  — `ListCreateAPIView`, permiso `IsTechnician` (level ≥ 2). Campo requerido: `aspersion_date`.
  `plot` se hereda automáticamente de `program.plot_id` en `model.save()`, nunca se envía.
- `PhytoMonitoringHeader` CREATE: `POST /api/v1/monitoring/phyto/headers/create/`
  — permiso `IsAuthenticated`. Campo requerido: `estimated_start_date` + (`field_task_id` o `plot_id`).
  Si `field_task_id` no tiene parcela → error 400 en `plot_id`.
- Ciclos de vida distintos: Aspersión incluye estado `loaded`; Phyto no.
- Phyto `status=cancelled` requiere `additional_notes` (validado en serializer).
- Gap detectado: `PhytoSessionSummarySerializer` referenciaba `session_date` e `import_status`
  que no existen en el modelo → error en `/tree/` si hay sesiones Phyto.
  Fix: dos `@property` en `PhytoMonitoringHeader`.

**Cambios principales:**

`datalayers/models.py` (backend, autorizado):
- `session_date` → `self.estimated_start_date`
- `import_status` → `"done"` (Phyto no tiene flujo CSV)

Hooks nuevos (`hooks/`):
- `useAspersionSessionDetail` / `usePhytoSessionDetail` — GET detail con `queryOptions`.
- `useUpdateAspersionSession` / `useUpdatePhytoSession` — PATCH con invalidación de
  detail + tree.
- `AspersionSessionDetail` augmentada localmente con `status` y `assigned_to`
  (campos omitidos del schema OpenAPI, gap GAP-SCHEMA-001).

`CreateSessionDialog` (reescritura):
- `strict_mode` (checkbox) y `radius_tolerance` (number) en formulario Phyto.
- Advertencia amarilla cuando el Hijo no tiene parcela (Phyto fallaría en backend).
- `plot` expuesto en prop `programa` (heredado de HijoModal).
- `SelectItem value="__none__"` como sentinel para cumplir restricción de Radix UI
  (no acepta `value=""`). `onValueChange` convierte `"__none__"` a `undefined`.

`SesionModal` (reescritura):
- Fetch de detalle propio (no solo cache del tree).
- View mode: DL de todos los campos + PlotMiniMap en columna derecha.
- Cambio de status inline con botones por tipo: Aspersión y Phyto tienen diferentes
  transiciones (Phyto sin `loaded`). Para `cancelled` en Phyto: prompt inline de notas
  antes de confirmar (backend lo exige).
- Edit mode: fechas reales siempre visibles; metadatos detrás de toggle con advertencia.
- `datacentralId` como prop (para dropdown de responsables en edición).
- CSV import: placeholder visible pero deshabilitado, diferido a Bloque 5.

`w.$dc.task-manager.tsx` (route):
- Extrae el IIFE de `HijoModal` a `HijoModalWrapper` que usa `useMasterTree` (suscripción
  reactiva). El patrón anterior usaba `queryClient.getQueryData()` — lectura puntual que
  no re-renderizaba al actualizar el cache. Con `useQuery` la lista de sesiones en
  `HijoModal` actualiza inmediatamente al crear una sesión, sin cerrar el modal.
- `datacentralId` pasado a `SesionModal`.

**Verificación:** `npm run typecheck` → 0 errores. `npx vitest run` → 76/76 tests.
Demo manual: crear sesión Aspersión → aparece en lista sin cerrar modal. Cambio de status
inmediato. Modal de sesión muestra todos los campos + mapa. Edit mode con fechas en campo.

### Bloque 4 — Navegador de modales reforzado

**Problema raíz:** `handleTaskClick` en la ruta necesitaba inferir el tipo de sesión
(aspersión vs. phyto) cuando el usuario hacía clic en el Gantt. Lo hacía buscando en el
tree cache con `queryClient.getQueryData()` y un for-loop. Esto era frágil: si el tree
no estaba en cache en ese momento, el sesionType se defaulteaba a `'aspersion'`
silenciosamente.

**Solución:** `mapMastersToTasks` ya conoce el tipo al construir las tasks (tiene loops
separados por tipo). Se agregan dos mapas al retorno: `hijoIdByTask` y `sesionTypeByTask`.
`GanttHierarchy.onTaskClick` los pasa como `extra` al callback, eliminando cualquier
necesidad de consultar el cache en la ruta.

**`HijoModalWrapper`:** se agrega distinción entre `isLoading` (muestra texto de carga)
y `hijo === undefined` cuando el tree ya cargó pero no encontró el id (renderiza `null`).

**Test nuevo:** `popula hijoIdByTask y sesionTypeByTask para aspersion y phyto` en
`GanttHierarchy.test.ts`. Verifica que los dos tipos están asignados al hijo correcto y
que Master/Hijo no aparecen en esos mapas.

**Verificación:** `npm run typecheck` → 0 errores. `npx vitest run` → 77/77 tests.


---

## ADMIN — FASE 2 · AGROUNIDADES, SECTORES Y CONTACTOS
**Estado:** `[✅] Completada — Sesión 9 — 2026-05-19`

> Expone la gestión de la estructura organizacional del workspace: AgroUnidades (unidades
> productivas), AgroSectores (agrupación por giro agroindustrial) y Contactos (directorio
> vinculado a cada unidad). Complementa la Fase 1 de Admin (Usuarios) que ya estaba
> completa y testeada.

### Tipos

Exportados desde `src/features/admin/types/index.ts`:
`AgroSector`, `AgroUnit`, `Contact`, `ContactAssignmentList` (todos derivados del schema
generado con openapi-typescript — `components['schemas']['...']`).

### Hooks

**`useAgroSectors.ts`** — `queryKey: ['admin', 'agro-sectors']`, `staleTime: 60_000`.
Expone `useAgroSectors()` y `useCreateAgroSector()`.

**`useAgroUnits.ts`** — `queryKey: ['admin', 'agro-units']`, `staleTime: 30_000`.
Expone `useAgroUnits()`, `useAgroUnitDetail(id)`, `useCreateAgroUnit()`,
`useUpdateAgroUnit()`. El payload de update usa el tipo `PatchedAgroUnit` del schema.

**`useContacts.ts`** — Expone `useContacts()`, `useContactAssignments(agroUnitId)`,
`useCreateContact()`, `useCreateContactAssignment()`, `useDeleteContactAssignment()`.
El id de asignación es entero (no UUID) — `mutationFn: async (assignmentId: number)`.

### Diálogos

**`CreateSectorDialog`** — Campos: `sector_name` (req), `scian_code`, `activity_name`
(req), `description` (textarea nativo — no existe componente Textarea en shadcn/ui local).

**`CreateAgroUnitDialog`** — 14 campos en grilla. Destaca: `CountryCombobox` con default
México via `useEffect` + `useStates(iso2: string | null)` para estados en cascada.
País se guarda como `id` numérico (string); el ISO-2 se busca en la lista de países para
pasarle a `useStates`. Patrón: `countries.find((c) => String(c.id) === selectedCountry)?.iso_2 ?? null`.

**`CreateContactDialog`** — Props: `open`, `onOpenChange`, `agroUnitId?`.
Crea contacto y si `agroUnitId` está presente llama `createAssignment.mutateAsync`
automáticamente después.

### Panel

**`AgroUnitPanel`** — Modal de 2 tabs:
- **Detalle**: vista de lectura + modo edición inline (RHF + zod + `applyDrfErrors`).
- **Contactos**: lista de `ContactAssignment` con botón eliminar + botón "Agregar contacto"
  que abre `CreateContactDialog`.

Gates de permisos:
```typescript
const canEdit = (user?.role_level ?? 0) >= ROLE_LEVELS.SUPER_ADMIN
const canManageContacts = (user?.role_level ?? 0) >= ROLE_LEVELS.SUPERVISOR
```

### Sección principal

**`AgroUnitsSection`** — 2 tabs: **Unidades** | **Sectores**.
- Tab Unidades: tabla `commercial_name / code / unit_type / sector / status`. Click → `AgroUnitPanel`.
  Botón "Nueva Unidad" visible solo si `roleLevel >= ROLE_LEVELS.SUPER_ADMIN`.
- Tab Sectores: tabla `sector_name / scian_code / activity_name`.
  Botón "Nuevo Sector" visible si `roleLevel >= ROLE_LEVELS.SUPERVISOR`.

### Tests

**`AgroUnitsSection.test.tsx`** — 5 tests con `vi.mock` para hooks (MSW descartado en
esta capa por conflictos de URL con trailing-slash):
- Renderiza tabs Unidades y Sectores.
- Supervisor (level 5) ve botón "Nueva Unidad".
- Estado vacío muestra mensaje.
- Click en "Nueva Unidad" abre `CreateAgroUnitDialog`.
- Tabla renderiza unidad cuando hay datos.

### Decisiones de diseño

- **AgroUnit como catálogo global**: `AgroUnit` es un catálogo global — no está
  automáticamente asignada a ningún DataCentral al crearla. Sólo `IsSuperAdmin` puede
  crear/editar/eliminar unidades. `IsSupervisor` puede gestionar sectores y contactos
  (menor impacto estructural). Gerente no puede crear unidades porque flotarían en el
  catálogo invisible a su workspace hasta que un SuperAdmin las asigne via
  `DataCentralAssignment`.

- **`applyDrfErrors` retorna `void`**: no se evalúa el retorno; siempre se llama
  `toast.error()` incondicionalmente después.

- **No hay Textarea en shadcn local**: se usa `<textarea>` nativo con clases Tailwind.

**Verificación:** `npx tsc --noEmit` → 0 errores. `npx vitest run` → 85/85 tests.
Demo manual: SuperAdmin crea sector → crea unidad → abre panel → edita → agrega contacto.

---

## ADMIN — FASE 3 · FRONTEND — ORGANIZACIONES Y CIAs
**Estado:** `[✅] Completada — Sesión 10 — 2026-05-19`

> Gestión completa de DataCentralMains (org raíz) y DataCentrals (CIA hija):
> CRUD, detalle, asignación de usuarios y agrounidades, selector con búsqueda y multi-selección.

### Tipos

`src/features/admin/types/index.ts`:
- `DataCentralMainDetail` — org raíz con owner, status, country, datacentrals_count.
- `DataCentralDetail` — CIA hija con conteos de usuarios y AgroUnits asignados.
- `DataCentralAssignment` — asignación AgroUnit ↔ DataCentral.
- `UserAssignment` — asignación usuario ↔ DataCentral.

### Hooks

**`useDataCentrals.ts`** — `DCM_QUERY_KEY=['admin','datacentralmains']`, `DC_QUERY_KEY=['admin','datacentrals']`.
`useDataCentralMains()`, `useDataCentrals(dcmId?)`, `useCreateDataCentralMain()`,
`useUpdateDataCentralMain()`, `useCreateDataCentral()`, `useUpdateDataCentral()`.

**`useUserAssignments.ts`** — `UA_QUERY_KEY=['admin','user-assignments']`.
`useUserAssignments(datacentralId)`, `useCreateUserAssignment()`, `useDeleteUserAssignment()`.
Path API: `/api/v1/users/assignments/` (prefijo `users/`, no doble "users-assignments").

**`useDataCentralAssignments.ts`** — `DCA_QUERY_KEY=['admin','dc-assignments']`.
`useDataCentralAssignments(datacentralId)`, `useCreateDataCentralAssignment()`,
`useDeleteDataCentralAssignment()`.

**Patrón `onSuccess` async:** todos los `onSuccess` de mutaciones de asignación usan
`async () => { await queryClient.invalidateQueries(...) }` para garantizar que el refetch
completa antes de que `mutateAsync` resuelva en el componente. Evita items "fantasma" en
el selector tras una asignación exitosa.

### Componente

**`AssignCombobox`** (`components/AssignCombobox.tsx`) — combobox con búsqueda client-side,
modo single y multi-select con checkboxes. Sin dependencias nuevas: misma técnica que
`CountryCombobox` (Tailwind + `Input` + `useRef`/`useEffect` para cierre exterior).
En modo multi: botón "Asignar (N)" en footer del dropdown; loop secuencial en el componente
llamante para respetar el orden de invalidación de cache.

### Diálogos

**`CreateDataCentralMainDialog`** — name, description, country (CountryCombobox),
status (active/inactive/trial), owner_id (Select usuarios nivel ≥ 4).

**`CreateDataCentralDialog`** — name, description. Recibe `dataCentralMainId` como prop.

### Paneles

**`DataCentralMainPanel`** — 2 tabs:
- **Detalle**: view + edit (RHF + zod + `applyDrfErrors`).
- **CIAs Hijas**: tabla; click en fila propaga `onOpenDC(dc)` hacia OrganizationsSection.
  Botón "+ Nueva CIA" abre `CreateDataCentralDialog`.

**`DataCentralPanel`** — 3 tabs:
- **Detalle**: view + edit (name, description). `is_primary` no editable, slug read-only.
  Breadcrumb "← [Org]" en header para indicar jerarquía.
- **Usuarios**: lista `UserAssignment` + `AssignCombobox` (search single) + Trash.
- **Agrounidades**: lista `DataCentralAssignment` + `AssignCombobox` multi-select + Trash.
  Asignaciones secuenciales para garantizar coherencia de cache.

### Sección principal

**`OrganizationsSection`** — estado `selectedDCM`, `selectedDC`. Tabla de DataCentralMains
(nombre, owner, status, CIAs, creada). `handleDCClose` re-abre el panel de la org padre
al cerrar `DataCentralPanel`, evitando que el usuario pierda el contexto.

### Tests

**`OrganizationsSection.test.tsx`** — 6 tests: header, botón superadmin, empty state,
tabla con datos, click fila → dialog, botón crear → dialog.

### Decisiones de diseño

- **`onOpenDC` propagation**: el panel no navega solo; propaga hacia OrganizationsSection
  (dueño de `selectedDCM`/`selectedDC`). Un único punto de verdad para diálogos abiertos.
- **`as never` para query params**: campos de filtro no tipados en el schema generado
  requieren cast. Patrón establecido en Fase 2 y mantenido.
- **Path UserAssignment**: `/api/v1/users/assignments/` (singular), no doble "users".
- **`AssignCombobox` vs shadcn Command**: se optó por combobox propio siguiendo el patrón
  de `CountryCombobox` para no añadir dependencias (`cmdk`, `@radix-ui/popover`).

**Verificación:** `npx tsc --noEmit` → 0 errores. `npx vitest run` → 91/91 tests.
Supervisor ve tablas y puede agregar contactos; no ve botón "Nueva Unidad".

---

## ADMIN — FASE 3 · BUG FIX SERIALIZERS — Sesión 10 (2026-05-19)

> Bug detectado en pruebas manuales: los selectores de "asignar usuario" y "asignar
> agrounidad" en `DataCentralPanel` mostraban TODAS las opciones, sin excluir las ya
> asignadas. El filtro frontend `assignedIds.has(u.id)` era correcto, pero `user_id` y
> `agro_unit_id` nunca llegaban en la respuesta GET.

### Causa raíz

Los serializers del backend (`UserAssignmentSerializer`, `DataCentralAssignmentSerializer`)
declaraban los campos PK con `write_only=True`. `drf-spectacular` igualmente los incluye en
el schema OpenAPI generado (con `Format: uuid`, sin `readonly`), por lo que TypeScript no
detectaba el problema: el tipo `UserAssignment.user_id` decía `string`, pero en runtime
nunca llegaba.

Resultado: `userAssignments.map(a => a.user_id)` → `[undefined, undefined, ...]`. El Set
quedaba con un solo elemento `undefined`, y `set.has(u.id)` retornaba `false` para todo UUID
real → ningún usuario era excluido del selector.

### Fix aplicado

Backend (ver bloque correspondiente en `CIAgro_alpha_backend/logs/development.md`):
- Eliminado `write_only=True` de `user_id` y `datacentral_id` en `UserAssignmentSerializer`.
- Eliminado `write_only=True` de `agro_unit_id` y `datacentral_id` en `DataCentralAssignmentSerializer`.
- Regenerado `schema.yml` con `spectacular --validate`.
- Regenerado `src/types/api.d.ts` con `openapi-typescript`.

Frontend:
- `useUserAssignments`/`useDataCentralAssignments`: añadido `refetchOnMount: 'always'` para
  garantizar refetch en cada montaje (cubre el caso "cerrar/reabrir modal").
- `DataCentralPanel`: agregado filtrado optimista local (`localAssignedUserIds`,
  `localAssignedUnitIds`) para feedback inmediato al asignar dentro de la misma sesión.

### Lección

Cuando un filtro de exclusión basado en IDs "no funciona", verificar siempre que los IDs
realmente lleguen en la respuesta. `write_only=True` en DRF los omite del GET silenciosamente
y el schema generado puede no reflejarlo, engañando al sistema de tipos.

**Verificación:** `npx tsc --noEmit` → 0 errores. `npx vitest run` → 91/91 tests.
Prueba manual confirmada por el usuario: ya no aparecen ghosts en los selectores tras
asignar+cerrar+reabrir modal.

---

## ADMIN — FASE 4 (2026-05-20)

### Objetivo

Implementar en el frontend la sección "Catálogos agrícolas" del panel `/admin`:
gestión de `CropCatalog` y `PhytosanitaryCatalog` + `PhytosanitaryPhoto` (caso de uso §6).

### Cambios realizados

**4.B.0 — Bridge**
- `api.d.ts` regenerado desde `schema.yml` actualizado con los nuevos endpoints de fotos.
- Nuevos schemas: `PhytosanitaryPhotoCreate`, paths `/phytosanitary/photos/create/` y
  `/phytosanitary/photos/{id}/delete/`.

**4.C.1 — Tipos** (`src/features/admin/types/index.ts`)
- Re-exportados: `CropCatalog`, `PhytosanitaryCatalog`, `PhytosanitaryPhoto`,
  `PhytosanitaryPhotoCreate`, `PhytosanitaryType`, `PhytosanitaryStage`.

**4.C.2 — `useCrops.ts`**
- `useCrops`, `useCropDetail` (`refetchOnMount: 'always'`), `useCreateCrop` (multipart
  condicional: si hay `File` construye `FormData` + `bodySerializer: (b) => b`, si no JSON),
  `useUpdateCrop`.

**4.C.3 — `usePhytosanitary.ts`**
- `usePhytosanitaryCatalogs`, `usePhytosanitaryDetail` (`refetchOnMount: 'always'`),
  `useCreatePhytosanitary`, `useUpdatePhytosanitary`.
- `useCreatePhytoPhoto`: construye `FormData` + `bodySerializer`, invalida detail del padre.
- `useDeletePhytoPhoto`: invalida detail del padre.

**4.C.4 — `CreateCropDialog`**
- RHF + zod. Campos: name, code, variety, description, photo (FileList).
- `<textarea>` nativo estilizado (sin dependencia `@/components/ui/textarea` que no existe).

**4.C.5 — `CreatePhytosanitaryDialog`**
- Sub-form acordeón de etapas gestionado con `useState` (no RHF nested).
- Flujo `for…of` secuencial: POST phyto → POST foto por cada etapa → toast agregado.
- `AssignCombobox` para selector de `default_crop_id`.

**4.C.6 — `CropPanel`**
- 1 tab view/edit. Gate "Editar" por `roleLevel >= SUPERVISOR`.

**4.C.7 — `PhytosanitaryPanel`**
- 2 tabs: Detalle (view/edit) + Fotos por etapa (add/delete inline con `usePhytosanitaryDetail`).

**4.C.8 — `CatalogsSection`**
- Reemplaza placeholder. Tabs Cultivos/Fitosanitarios, tablas, botones gateados por
  `canCreate = roleLevel >= SUPERVISOR`.

**4.C.9 — `CatalogsSection.test.tsx`**
- 8 tests: render tabs, gates supervisor (×2), empty states (×2), tabla con datos,
  click fila cultivo abre panel, click fila phyto abre panel.

### Patrón multipart introducido

Primera vez en el proyecto que `apiClient` (openapi-fetch) envía `FormData`.
Solución: `bodySerializer: (b) => b` para que openapi-fetch no serialice a JSON y el
browser gestione el `Content-Type: multipart/form-data; boundary=...` automáticamente.

### Trampas aplicadas

- Sin `write_only=True` en `phytosanitary_id` (lección Fase 3).
- `refetchOnMount: 'always'` en detail de fitosanitario para que `stage_photos` esté fresco.
- `<textarea>` nativo en lugar de importar componente inexistente.

### Verificación

- `tsc --noEmit` → 0 errores.
- `vitest run` → **99/99** tests.

---

## Sesión 12 — Bug fix: Editar perfil y cambio de contraseña (2026-05-20)

### Contexto

Bug: ningún usuario podía cambiar su contraseña ni actualizar su correo desde el frontend. Se implementaron dos flujos.

### Cambios realizados

**`ProfileModal.tsx`** (nuevo — `src/features/workspace/`):
- Dialog con 2 tabs accesible para todos los roles.
- **Tab "Datos"**: campo de correo, `PATCH /api/v1/users/me/` → actualiza `useAuthStore`
  con el nuevo email en caso de éxito. Toast y cierre de modal.
- **Tab "Seguridad"**: campos `old_password`, `new_password`, `confirm_password`.
  Llama `POST /api/v1/auth/change-password/` vía `fetch` directo (igual que
  `useChangePassword` pero sin redirigir a `/workspaces` — solo toast de éxito).

**`AppHeader.tsx`** (`src/features/workspace/`):
- Nuevo ítem "Editar perfil" (ícono `UserCog`) en el dropdown del encabezado.
- `useState(false)` controla la visibilidad de `ProfileModal`.
- Posicionado antes de "Cambiar workspace", visible para todos los roles.

**`UserModal.tsx`** (`src/features/admin/panel/`):
- Sección "Contraseña" añadida al modo edición.
- Solo visible cuando `role_level >= ROLE_LEVELS.SUPER_ADMIN` (nivel 5).
- Formulario independiente del formulario principal: campos `new_password` +
  `confirm_password` + botón "Cambiar contraseña".
- Llama `POST /api/v1/users/{id}/set-password/` via `fetch` directo con JWT header
  (endpoint nuevo, no incluido en `api.d.ts`).
- En éxito: toast informativo. No cierra el modal principal.

### Patrón aplicado

`useAuthStore.setUser(...)` para actualizar el email en memoria sin recargar la página
al hacer PATCH `/users/me/`.

### Verificación

- `tsc --noEmit` → **0 errores**.
- `vitest run` → **99/99 tests** (sin tests nuevos para este fix).

---

## Sesión 13 — Admin Fase 5: Activos Agrícolas (2026-05-21)

### Contexto

Cierre del módulo Admin con la sección de Ranchos y Parcelas (caso de uso §7). El backend `apps/geo_assets` ya tenía 39 tests y los serializers GeoJSON completos. Esta fase requirió ajustar permisos en backend, regenerar tipos y construir 9 archivos nuevos de frontend.

### Decisión de permisos (acordada con usuario)

| Acción | Permiso anterior | Permiso final |
|---|---|---|
| `RanchDestroyView` | `IsGerente` | `IsSuperAdmin` |
| `PlotDestroyView` | `IsGerente` | `IsSuperAdmin` |
| `PlotImportVerticesView` | `IsSuperAdmin` | `IsGerente` |
| `RanchPartnerCreateView` | `IsSuperAdmin` | `IsGerente` |

Gerente (rol ≥4) puede crear, editar e importar vértices dentro de su scope (garantizado por `ScopeFilterMixin`). Solo Admin (rol 5) puede eliminar.

### Bug fix pre-existente en tests backend

`RanchScopeFilterTests` y `GerenteWriteRanchPlotTests` fallaban por `DataCentralMain.owner_id NOT NULL` (campo añadido en Sesión V pero setUp de tests no lo asignaba). Fix: `DataCentralMain.objects.create(name=..., owner=self.admin)` y `get_or_create(name=..., defaults={"owner": user})`.

### Archivos backend modificados

- **`apps/geo_assets/views.py`** — 4 ajustes de `permission_classes` (ver tabla arriba).
- **`apps/geo_assets/tests.py`** — fix de setUp + 5 tests nuevos: `test_gerente_puede_importar_vertices` (200), `test_gerente_no_puede_eliminar_ranch` (403), `test_gerente_no_puede_eliminar_plot` (403), `test_gerente_puede_crear_partner` (201), `test_gerente_no_puede_eliminar_partner` (403).

**Resultado:** 44/44 tests `geo_assets` OK.

### Archivos frontend creados

| Archivo | Descripción |
|---|---|
| `hooks/useRanches.ts` | flattenRanch, CRUD, filtro `?producer=`. `RANCHES_KEY`. |
| `hooks/usePlots.ts` | flattenPlot, CRUD, `useImportPlotVertices` → `/plots/{id}/import-vertices/`. |
| `hooks/useRanchPartners.ts` | list + create + delete por ranch. |
| `hooks/useProducers.ts` | `GET /organizations/?unit_type=Productor`. |
| `components/RanchFormDialog.tsx` | RHF+zod; cascada `selectedCountryIso2` → `useStates`; `applyDrfErrors`. |
| `components/PlotFormDialog.tsx` | `tech_spraying` como Select Sí/No (sin Checkbox disponible en shadcn). |
| `components/PlotVerticesImport.tsx` | Filas dinámicas lat/lon, mínimo 3, botón remove deshabilitado si ≤3. |
| `panel/RanchPanel.tsx` | Tabs Detalle/Parcelas/Aliados; view+edit toggle; RanchPartner inline add/remove. |
| `panel/PlotPanel.tsx` | Tabs Detalle/Mapa(`PlotMiniMap`)/Vértices(`PlotVerticesImport`). |

**Archivo modificado:** `sections/AssetsSection.tsx` — reemplaza placeholder; tabla de ranchos con filtro por productor; `canCreate = ROLE_LEVELS.MANAGER`; abre `RanchPanel` al click de fila.

### Trampas aplicadas

- **FeatureCollection → aplanar en hooks:** `{...f.properties, id: f.id!, geom: f.geometry ?? null}`. Nunca procesar estructura GeoJSON anidada en componentes UI.
- **`total_area` / `centroid` son read-only:** calculados por `Plot.save()` vía PostGIS UTM 32614. Frontend no los recalcula.
- **Backend cierra el polígono:** `PlotImportVerticesView` añade `coords[0]` al final — no duplicar en cliente.
- **`ROLE_LEVELS.GERENTE` no existe** — usar `ROLE_LEVELS.MANAGER` (nivel 4).
- **`vi.mock` hoisting:** mocks de `useAuthStore` deben estar al nivel de módulo con valores hardcoded, no en closures.
- **MapLibre rompe JSDOM:** `PlotMiniMap` mockeado a `() => null` en tests de componentes.

### Tests nuevos

- `hooks/useRanches.test.ts` (5 tests): aplanado de FeatureCollection → id, geom, properties preservadas, geom null cuando undefined, total_area del backend sin modificar.
- `sections/AssetsSection.test.tsx` (5 tests): header renderiza, botón "Nuevo rancho" visible para rol 5, fila de rancho en tabla, nombre de productor resuelto, dialog abre al click.

### Verificación

- `tsc --noEmit` → **0 errores**.
- `vitest run` → **109/109 tests** (10 nuevos respecto a sesión 12).

---

## Sesión 14 — Task Manager Aspersión: importación CSV + mejoras de subprograma + bug fixes (2026-05-25)

Sesión amplia con tres frentes en frontend (más cambios de backend documentados en
`../CIAgro_alpha_backend/logs/development.md`).

### Frente A — Importación de telemetría de aspersión (CSV)

En el Task Manager, las sesiones de aspersión tenían el botón "Importar datos"
deshabilitado ("próximamente"). El backend ya tenía el pipeline async (Celery); el
trabajo fue mayormente frontend + ajuste de permisos/scope en backend.

**Hooks nuevos:**
- `useAspersionImport.ts`: `usePreviewColumns` (POST multipart `preview-columns`),
  `useImportAspersionData` (POST `import`; en `onSuccess` hace `setQueryData` optimista
  del detalle a `'processing'` para arrancar el polling de inmediato + invalidación),
  `useAspersionTemplates` (GET), `useCreateAspersionTemplate` (POST).
- `useAspersionVariableStats.ts`: fetch directo con token (patrón `useCurrentUser`) al
  endpoint `/variable-stats/` que **no** está en `api.d.ts`.

**Polling:** `useAspersionSessionDetail` recibe `refetchInterval` condicional — refresca
cada 2.5 s **solo** mientras `import_status === 'processing'`. Trampa clave: `pending`
es el estado **idle** por defecto, no "en progreso"; poletear en `pending` dejaba un
loop infinito en sesiones sin importar.

**Homologador** (`AspersionImportDialog.tsx`): file picker → preview que separa
columnas reconocidas (verde, con su mapeo) de no reconocidas (ámbar, con `Select` para
remapear a un campo de `lib/aspersionFields.ts`) → guardar plantilla reutilizable
opcional → importar → estado `processing`/`done`/`error`/`pending_mapping`.
`lib/aspersionFields.ts` lista 37 campos mapeables con etiqueta ES, espejando
`DEFAULT_COLUMN_MAPPING` del backend (con comentario de sincronización).

**Resumen post-import** (`AspersionImportSummary.tsx`): tabla genérica que itera
`data.variables` (media/mín/máx/desv/n). Al ser genérica, los campos
`applied_rate_l` (Proporción de aplicación líquida L/ha) y `product_quantity` (Media de
producto aplicado) añadidos luego en backend aparecieron sin tocar el componente.

**Trampa de tests:** `openapi-fetch` captura `globalThis.fetch` al cargar el módulo,
**antes** de que MSW lo parchee → MSW no intercepta las llamadas de `apiClient`. Los
5 tests de `AspersionImportDialog.test.tsx` usan `vi.mock` de los hooks, no MSW.

### Frente B — Detalle/edición de subprograma + parcela

- **`HijoModal` → `PlotInfoPanel`**: la columna derecha ahora muestra datos de la
  parcela (código como **hipervínculo** con tooltip "Click para ver detalle de parcela"
  que abre `PlotPanel` anidado, superficie, aspersión tecnificada, comentarios) además
  del mini-mapa. Datos de `usePlotGeometry` ya cacheado → sin request extra.
- **Cambio de parcela en edición**: solo si el subprograma **no** tiene sesiones
  (`allSessions.length === 0`); si las tiene, campo deshabilitado + mensaje explicando
  por qué. Nuevo `usePlotsByProducer(producerId)` (GET `/geo_assets/plots/?producer=`).
  El backend valida igualmente (productor del maestro + solapamiento Y5).
- **Gating por status** (fix del 400 al crear sesión): "Nueva Sesión" se oculta si el
  hijo o el maestro están `completed`/`cancelled`; "Nuevo Subprograma" se oculta si el
  maestro está `completed`/`cancelled`. Antes el backend rechazaba con 400 silencioso.
- **`PlotMiniMap`**: prop `showTooltip` (Popup hover con lat/lon + área en m²) y
  `maxzoom: 19` en el source ESRI (overzoom en lugar de tiles en blanco al acercar).

### Frente C — Bug fixes del módulo de administración + layout

- **Scope SuperAdmin**: `w.$dc.task-manager` respeta el workspace
  (`canCreateMaster = isSuperAdmin || isOwnerOfThisDc`).
- **Owner Gerente**: `DataCentralPanel` `canEdit = isSuperAdmin || isOwnerOfThisDc` y el
  texto "← ORG" ahora es un `<button>` que navega atrás (`onClose`).
  `OrganizationsSection` filtra organizaciones a `owner_username === user.username` para
  no-SuperAdmin (antes mostraba también las invitadas). `useCreateDataCentral` invalida
  `DCM_QUERY_KEY` + `['me']` → el conteo de CIAs ya no queda stale tras crear.
- **Footer fijo** (`__root.tsx`): banda `#290629` con "CIAgro: Central de Inteligencia
  Agrícola ®" (izq) y "Tierra Inteligente ®. Todos los derechos reservados {año}" (der).
- **Layout sticky**: `w.$dc.tsx` y `AdminLayout` pasan de `min-h-dvh` a `h-dvh` con
  `overflow-auto` solo en `<main>` + `pb-9`; header y sidebar quedan fijos.
- **Login** con imagen de fondo (`public/backgrounds/ciagro_bg_1.jpg`) y Card translúcida
  (`bg-white/80 backdrop-blur-sm`).

### Verificación

- `tsc --noEmit` → **0 errores**.
- `vitest run` → verde (5 tests nuevos en `AspersionImportDialog.test.tsx`).

---

## Sesión 15 — Visor de capas de datos de aspersión (2026-05-25)

### Contexto

La Sesión 14 cerró la importación de telemetría CSV. Esta sesión implementa el consumo visual de esos datos: un modal grande con mapa de calor donde cada punto de aspersión se representa como un rectángulo orientado, coloreado por la capa activa.

### Decisiones clave

**Backend (discovery):** El endpoint `GET /monitoring/aspersion/points/` usa `GeoModelSerializer` (legacy, no `GeoFeatureModelSerializer`), lo que produce una lista plana paginada `{count, next, previous, results: AspersionPoint[]}` — no un FeatureCollection. Esto difiere de lo que sugería el contrato. La `api.d.ts` generada era correcta; la construcción del FeatureCollection para MapLibre ocurre en cliente (`pointsToRectangleCollection`).

**Decisión 6.B.0 (propose, elegida por el usuario):** Geometría del rectángulo por **trigonometría manual sin dependencias** (Opción A). Aproximación plana metros→grados con `cos(lat)` para el eje este. Error sub-centimétrico a esta escala (~14m × ~1.3m, lat 20.5°N). Descartado `@turf/destination` por añadir dependencia y ser sobredimensionado.

### Arquitectura del visor

1. **`lib/plotRectangles.ts`** — función pura `rectangleRing(lon, lat, headingDeg, widthM, heightM)` que computa 4 esquinas locales en el sistema (ancho, avance) del vehículo, las rota por el rumbo de brújula y las convierte a coordenadas geográficas. `pointsToRectangleCollection` consume `AspersionPoint[]` y produce el FeatureCollection de polígonos.

2. **`lib/aspersionLayers.ts`** — fuente única de verdad de capas, paletas y funciones de clasificación. `classifyApplication` implementa los 5 buckets del caso de uso (umbrales exactos: <80 Deficiente, 80–95 Regular, 95–105 Excelente, 105–120 Sobredosis, >120 Sobredosis alta). `computeQuartiles` usa interpolación lineal estándar sobre los valores cargados.

3. **`hooks/useAspersionPoints`** — itera páginas de la API (page_size=2000) siguiendo `next` hasta acumular todos los puntos. Mismo patrón de fetch directo que `useAspersionVariableStats`.

4. **`AspersionMapModal`** — una sola `Source` GeoJSON + `Layer fill` con color `data-driven` (expresión MapLibre `match`). El cambio de capa recomputa el `FeatureCollection` anotado con `bucket` via `useMemo` y re-asigna el `data` de la Source. Los filtros de leyenda usan expresiones `filter` del layer (no montaje/desmontaje de Features). El modal bloquea cierre via `preventDefault` en `onInteractOutside`/`onEscapeKeyDown`.

5. **`SesionModal.tsx`** — botón `📍 Ver detalles de aspersión` gateado por `import_status==='done' && points_count>0 && role_level>=SUPERVISOR`.

### Tests

- `plotRectangles.test.ts` — 8 tests (geometría 0°/90°, descarte de inválidos, parseDecimal).
- `aspersionLayers.test.ts` — 12 tests (umbrales semáforo, cuartiles, estructura de capas).
- `AspersionMapModal.test.tsx` — 6 tests (render, cierre, cambio de capa, toggle checkbox). MapLibre mockeado con stub de componentes (WebGL no disponible en JSDOM).

Total: **143/143 tests, 0 errores typecheck**.

### Deuda técnica abierta

- **GAP-ASPERSION-PERCENTILES** (baja): si sesiones >5000 puntos degradan el cómputo de cuartiles en cliente, evaluar endpoint de `percentile_cont` en PostgreSQL (con propose antes de tocar backend).
- **Demo manual pendiente (6.E.2):** la fase no se declara cerrada hasta verificar contra backend real (5 capas, hover, filtros de leyenda, cierre solo via botón).

### Verificación

- `tsc --noEmit` → **0 errores**.
- `vitest run` → **143/143 verde** (26 archivos, +26 tests nuevos en esta sesión).

---

## Sesión 15 — continuación (2026-05-26)

### Fix de depuración: pin en el primer punto de aspersión

Durante la demo manual (6.E.2) se detectó que el polígono de parcela no coincidía con la nube de puntos de aspersión en el mapa. Para poder localizar los rectángulos en el mapa ESRI se añadió un `Marker` fijo de `react-map-gl/maplibre` en el primer punto del FeatureCollection (`baseFC.features[0].properties.lon/lat`): círculo amarillo (#facc15) de 14 px con borde negro y halo.

No se instalaron dependencias nuevas (`Marker` ya es parte de `react-map-gl/maplibre`). El mock de tests se actualizó con `Marker: ({ children }) => <div data-testid="mock-marker">{children}</div>`. 7/7 tests pasan. `tsc 0 errores`.

### Fix crítico: la capa 1 no pintaba al abrir el visor

Síntoma reportado: al abrir el visor se veía el polígono de la parcela pero **ningún rectángulo de aspersión**, aun con la capa 1 (% de aplicación) seleccionada por defecto. Solo aparecían tras cambiar a otra capa y volver a la capa 1.

**Diagnóstico — qué se descartó (con reproducción, no por intuición).** Se montaron reproducciones aisladas con Playwright + WebGL (swiftshader) para no seguir teorizando:

- *maplibre puro* (addSource + addLayer con expresión `match` data-driven, sin `setData` posterior): **pinta correctamente**. Incluso arrancando lejos y haciendo `fitBounds` después → regenera teselas y pinta. Descarta: carrera de inicialización, la expresión data-driven en el `addLayer` inicial, y el re-tiling tras `fitBounds`.
- *react-map-gl* replicando el patrón exacto del componente (data async, gating por estado, `fitBounds` imperativo vía ref): con la sonda fiable `queryRenderedFeatures` (el muestreo de píxeles daba falsos negativos por `preserveDrawingBuffer`), **renderiza los features en todos los escenarios**. Descarta el wrapper.

Como las reproducciones no fallaban, el bug era específico de los datos/estado reales. Se instrumentó el componente con un diagnóstico temporal (`getStyle().layers`, `queryRenderedFeatures`, `getFilter`, distribución de buckets) y se pidió la salida de consola con datos reales. Reveló la causa exacta:

```
Error: layers.rect-fill.filter: array expected, undefined found  (en addLayer)
rectFillIdx: -1   →  la capa 'rect-fill' nunca se creó
ordenCapas: ['esri-base', 'plot-fill', 'plot-outline']  →  falta rect-fill
```

**Causa raíz.** El `<Layer>` recibía `filter={filterExpr}` donde `filterExpr` valía `undefined` cuando no había filtro activo (capa 1 con todas las categorías visibles). MapLibre, al validar el `addLayer`, **rechaza la capa completa** si la propiedad `filter` está presente pero no es un array — `undefined` explícito no es válido. Por eso `rect-fill` no se creaba y no se pintaba nada. Al cambiar de capa y volver, la actualización pasaba por `setFilter` (que sí tolera `undefined`), de ahí que "se arreglara" al segundo intento — una pista falsa.

**Fix (una línea).** Pasar la prop `filter` solo cuando hay un filtro real:

```tsx
{...(filterExpr ? { filter: filterExpr } : {})}
```

**Limpieza.** Durante la búsqueda se había añadido andamiaje basado en hipótesis equivocadas (estado `mapReady` + `onLoad`, gating `mapReady && layerData`, `useLayoutEffect`, un efecto imperativo de `setData`, reset al cerrar). Confirmada la causa real, se eliminó todo y el componente volvió a la estructura estable (Map montado con `layerData`, `initialViewState` con bounds, como `PlotMiniMap`) más el fix del filtro. Se conservó `checkedBuckets` inicializado en `null` (= "todos visibles") en lugar de `Set` vacío, porque evita ocultar todo antes de la inicialización.

### Mejoras UX del visor (misma sesión)

- **Texto del botón**: "Ver detalles de aspersión" → "Abrir visor de datos de aspersión".
- **Leyenda más clara**: checkbox visible (recuadro con borde de color + paloma ✓ al estar activo) y leyenda de ayuda "clic para mostrar u ocultar"; antes el `input` era `sr-only` y solo se intuía por el tachado del texto.
- **Zoom**: `maxZoom={19}` en el `<Map>` + `maxZoom: 18` en `fitBounds`, para no pasar del nivel donde los tiles ESRI dejan de estar disponibles (imagen en blanco al acercar).
- **Tests**: los botones de capa se buscan por `getByRole('button', ...)` porque el label ahora también aparece en el título de la leyenda; se añadió el mock de `Marker`. 7/7 verdes, `tsc 0 errores`.

Commit: `fe6a665`.

---

## Sesión 16 — Áreas en el visor + flush admin + fix de zoom (2026-05-27)

Tres afinamientos sobre la sesión de aspersión y su visor. El flush requirió un endpoint
nuevo en el backend (ver `../../CIAgro_alpha_backend/logs/development.md`, misma sesión).

### Áreas en el visor

El caso de uso pide ver el **área total de aspersión** y el **área por categoría**. El dato
ya existía: cada punto trae `area_ha` y el backend ya entrega `area_total_ha` en su MV
(`useAspersionSessionStats`). Cambios:

- `area_ha` añadido a `RectangleProps` y parseado en `pointsToRectangleCollection`.
- `sumAreaByBucket(fc)` — función pura que suma hectáreas por `bucket` (ignora null/NaN).
  Se computa en `buildLayerData` y viaja como `LayerData.areaByBucket`.
- `LegendCard`: muestra **"Área total: X ha"** siempre (desde `area_total_ha`, valor
  autoritativo del backend) y el **desglose por categoría** solo en la capa 1
  (% aplicación). El total puede diferir levemente de la suma por categoría porque los
  puntos sin geometría/ancho/distancia se descartan al construir los rectángulos; por eso
  el total mostrado es el del backend, no la suma cliente.

### Flush por-sesión de datos importados (solo SuperAdmin)

La reimportación **añade** puntos (append, confirmado en backend), por lo que reimportar el
mismo CSV acumula duplicados. Se añadió una acción exclusiva de SuperAdmin (rol 5) para
**borrar los puntos de la sesión actual**.

> **Corrección de alcance (bug peligroso).** El primer diseño borraba **todas** las sesiones
> (global). En pruebas se detectó que al eliminar desde una sesión también se vaciaban otras
> sesiones de la misma parcela — pérdida de datos no deseada. Se acotó el borrado a la sesión
> indicada (`session_header_id`), tanto en backend como en frontend.

- `useFlushAspersion(sessionId)` — `POST /monitoring/aspersion/headers/<id>/flush/`; al
  terminar invalida detalle/stats/puntos y muestra toast.
- `FlushAspersionDialog(sessionId)` — acción destructiva blindada: genera un **código
  aleatorio de 6 dígitos** al abrir; el botón "Eliminar todo" permanece deshabilitado hasta
  teclearlo exacto. Cierra solo por sus botones.
- En `AspersionView`, botón destructivo "Eliminar los datos de esta sesión" visible solo si
  `roleLevel >= SUPER_ADMIN`, con nota de que la reimportación es aditiva. Tras el flush, el
  backend deja la cabecera en 'pending', así que el botón del visor desaparece solo (ya
  gateado por `import_status==='done' && points_count>0`).

### Fix recurrente de zoom (imagen ESRI en blanco)

La imagen satelital desaparecía a cierto zoom. Causa: con `maxzoom: 19` en la fuente raster,
MapLibre **pide** teselas z19 que ESRI no tiene en zonas rurales (404 → blanco); el overzoom
solo ocurre **por encima** del `maxzoom` de la fuente. Fix: `maxzoom` 19→**18** en
`ESRI_STYLE` y `maxZoom` 19→**20** en el `<Map>`. Así, sobre z18 MapLibre estira la última
tesela disponible y la imagen **siempre** se ve (algo menos nítida al máximo acercamiento).
`fitBounds` se mantiene en `maxZoom: 18` para que la apertura sea nítida.

### Verificación

- `tsc --noEmit` → **0 errores**. `vitest run` → **149/149 verde** (+6 tests nuevos).
- Backend: 4 tests del flush por-sesión verdes (incluye el de aislamiento: borrar una sesión
  no toca otra de la misma parcela); los 5 fallos de la suite `datalayers` son
  **preexistentes** (CSV faltante + Phyto scope + validación de modelo), confirmado vía
  `git stash` contra el código limpio.
- Demo manual pendiente de confirmación del usuario.

## Sesión 17 — Visor de Datos Agrícolas (Fase 7 frontend) (2026-05-28)

### Contexto

Sección **nueva e independiente** del task-manager (contrato `visor-datos-agricolas-fase-7`,
caso de uso `.context/geodata_visualizer_usecases.md`). Explorador jerárquico a la izquierda
+ dashboard a la derecha; **solo lectura**, gating `role_level >= SUPERVISOR (3)`. Reutiliza
el visor de capas de la Fase 6 y los hooks de la jerarquía. Modo `pedagogic` OFF (cambios
directos al repo).

### Decisiones `propose` resueltas con el usuario

- **7.B.0** — Reuso del mapa: se **extrajo** un componente auto-contenido `AspersionMap`
  (recibe `sessionId`+`plotId`, dueño de hooks/estado/capas/leyenda). `AspersionMapModal`
  quedó como wrapper delgado del Dialog. Sin romper el visor del task-manager.
- **7.B.1** — Entrada **independiente**: ruta `/visor-datos` **fuera de `w.$dc`** (no requiere
  CIAgro seleccionada; el explorador arranca en nivel Organización). Acceso por enlace
  visible en el encabezado (`AppHeader`) + botón en la pantalla de selección
  (`WorkspaceSelector`). Se descartó el módulo en el menú lateral.
- **7.B.2** — Carpeta `src/features/geodata-visor/{components,hooks,lib}`.
- **7.C.0** — Árbol del explorador: **componente recursivo propio, sin dependencias**.
- **7.D.0** — Estadísticas por nivel: **cálculo en cliente** (`lib/visorStats.ts`); el
  `GAP-VISOR-STATS` (agregación en backend) queda documentado como opción futura.

### Arquitectura

- **Backend (sin cambios):** se verificó que `AspersionSessionHeaderListView` ya filtra por
  `?plot=` y ordena por `-aspersion_date`; el `query: never` de `api.d.ts` se resuelve con
  cast `as never` en el hook nuevo (como `useDataCentrals`/`useMasterPrograms`).
- `GeodataExplorer` — árbol estilo Explorador de Windows/SSMS, expansión perezosa por nivel
  (Organización → CIAgro hija → Productores → Ranchos → Parcelas → Sesiones); doble clic en
  la fila expande/contrae. Reutiliza `useDataCentralMains/useDataCentrals/useProducers
  (extendido con datacentral)/useRanches/usePlots` + `useAspersionSessionHeaders` (nuevo).
- `GeodataDashboard` — tarjetas de stats por nivel (compactas), mapa de polígonos de las
  parcelas del rancho (`RanchPlotsMap`, Source/Layer GeoJSON + etiqueta por parcela y tarjeta
  flotante Productor/Rancho que además sirve para volver al rancho). Al elegir una sesión,
  monta `AspersionMap` con las 5 capas heatmap (capa 1 por defecto, selector, hover, leyenda).
- `SessionsPanel` — tarjeta flotante (minimizable) con las sesiones de la parcela y filtro de
  rango de fechas en cliente.
- `GeodataVisorShell` — layout split con explorador **redimensionable** (arrastrar, máx 20%
  del ancho) y **ocultable**; toggle para ocultar verticalmente el área de estadísticas.

### Archivos

Nuevos: `features/geodata-visor/components/{AspersionMap,GeodataExplorer,GeodataDashboard,
RanchPlotsMap,SessionsPanel,GeodataVisorShell}.tsx` (+ tests de AspersionMap, GeodataExplorer,
GeodataDashboard, SessionsPanel), `lib/visorStats.ts` (+test), `hooks/useAspersionSessionHeaders.ts`,
`types.ts`, `routes/visor-datos.tsx`. Modificados: `task-manager/components/AspersionMapModal.tsx`
(wrapper), `task-manager/hooks/useAspersionSessionStats.ts` (extraído), `admin/hooks/useProducers.ts`
(param `datacentral`), `workspace/{AppHeader,WorkspaceSelector}.tsx`, `router.ts`.

### Tarjeta de sesión con deep-links (7.E.3)

`SessionInfoCard` resuelve la jerarquía de la sesión reutilizando
`useAspersionSessionDetail` (→ `program_id` = subprograma) → `useHijoDetail` (→ `title` +
`master_program`) → `useMasterTree` (→ título del maestro), y muestra 3 enlaces TanStack
Router al task-manager. Como el task-manager abría sus modales por estado local (no por URL),
se añadió **deep-link aditivo**: search params `openMaster/openHijo/openSesion/openSesionType`
validados con zod + un `useEffect` (una sola vez al montar) que pre-abre el modal
correspondiente. El modal de sesión no depende de la lista de masters; maestro/subprograma se
encuentran en la lista que carga el loader del task-manager para esa CIAgro.

### Bugs de auth (Fase 1) surgidos al probar el deep-link en pestaña nueva

Tres fixes, registrados como bug fixes separados del visor:

1. **Refresh-on-load.** `_authenticated.beforeLoad` era síncrono y mandaba a `/login`
   cuando el access token (que vive solo en memoria) no estaba. Ahora es async: si hay
   refresh token en localStorage, intenta `doRefresh()` y solo redirige si falla.
2. **Rotación del refresh.** SimpleJWT rota el refresh token (cada `/auth/refresh/` devuelve
   uno nuevo y bloquea el viejo). `doRefresh` solo guardaba `data.access` y descartaba el
   `data.refresh` nuevo, por lo que el segundo refresh siempre fallaba con 401. Fix:
   persistir `tokens.setRefresh(data.refresh)` si viene.
3. **Precarga de `useAuthStore.user` en el guard.** `useAuthStore` no persiste; en pestaña
   nueva el `user` es `null` hasta que `useCurrentUser` complete `/users/me/`, pero los
   guards síncronos de los hijos (p.ej. el del task-manager por `role_level`) leen del store
   antes. Fix: `_authenticated.beforeLoad` ahora también precarga `fetchCurrentUser()` y
   `setUser` + seed del cache `['me']` (sin persistencia, regla 🛑 #3).
4. **Sincronización de logout entre pestañas.** Cerrar sesión en una pestaña no afectaba a
   las hermanas (el usuario seguía navegando con el access token en memoria de cada una).
   Fix: `setupCrossTabLogout()` (llamado una vez en `main.tsx`) añade un listener de
   `storage`; cuando OTRA pestaña elimina `REFRESH_STORAGE_KEY` (vía `tokens.clear()` por
   logout, expiración o `forceLogout`), esta pestaña hace `tokens.clear() + clearUser() +
   window.location.replace('/login')`. Solo reacciona a eliminaciones (`newValue === null`);
   ignora escrituras (login, rotación).

### Estado y pendientes

- Implementado: 7.B (extracción + shell + gating), 7.C (explorador), 7.D (stats + mapa de
  parcelas), 7.E (sesiones + filtro de fechas + 5 capas por sesión + tarjeta con deep-links).
- Caso de uso `.context/geodata_visualizer_usecases.md` actualizado con la nota de la
  decisión 7.B.1 (entrada única independiente).
- **Pendiente único:** demo manual con backend real (recorrido completo de todo el flujo).

### Verificación

- `tsc --noEmit` → **0 errores**. `vitest run` → **175/175 verde** (incluidos los tests de la
  Fase 6 tras extraer `AspersionMap` y 3 nuevos de `crossTabLogout`; los fixes de auth no
  rompen `guards.test`, que usa una copia propia y mínima del guard).
- Demo manual con backend real **pendiente** de recorrido completo.

---

## Sesión 17 — Wizard de primer uso (SuperAdmin sin organizaciones) (2026-06-01)

### Contexto

Puesta en marcha en un equipo nuevo (rama `dev-hypervisor`). En un sistema recién
desplegado y vacío (sin organizaciones), el SuperAdmin necesita una guía para crear su
primera organización y sus CIAgros hijas. Antes, ese estado caía en "Sin acceso" o
auto-navegaba mal. Se añade un wizard de primer uso **omitible** y se corrige el flujo
del selector. (El fix de raíz en `/users/me/` se hizo en el backend — Sesión 45.)

### Cambios

**`src/features/workspace/FirstUseWizard.tsx`** (nuevo)
- Wizard de 4 pasos para SuperAdmin: bienvenida → crear organización (Paso 1/3) →
  agregar 1+ CIAgros (Paso 2/3) → instructivo final (Paso 3/3). Omitible (skip) en cada
  paso vía `onExit`.
- Reusa los hooks existentes `useCreateDataCentralMain` y `useCreateDataCentral`
  (admin). El owner de la organización se fija automáticamente al usuario actual
  (`useAuthStore().user.id`). El id de la org creada (que ahora devuelve el backend)
  alimenta el paso de CIAs.
- Paso final: instrucciones para asignar productores y usuarios a cada CIAgro desde el
  panel de Administración.

**`src/features/workspace/WorkspaceSelector.tsx`**
- Nueva rama `SuperAdminEntry` (role_level >= 5): consulta `useDataCentralsMain()`; si el
  sistema no tiene organizaciones muestra `FirstUseWizard`, en caso contrario el
  `DataCentralMainSelector` normal. La decisión se fija una sola vez (`mode`) para que
  crear la primera org dentro del wizard no lo desmonte a mitad.
- El auto-navegado por `datacentrals.length === 1` ahora excluye a SuperAdmin (pasa
  siempre por `SuperAdminEntry`). El resto de roles mantienen su comportamiento.
- Al salir del wizard se invalidan las queries `['data-centrals-main']` y `['me']` para
  que el selector y el perfil reflejen lo recién creado (el hook admin usa otra query key).

**`.env.local`** (nuevo, no versionado)
- `VITE_API_BASE_URL=http://localhost:8500/api/v1` y `VITE_MAPTILER_KEY` placeholder.

### Verificación

- `tsc --noEmit` → **0 errores**. `vitest run` → **150/150 verde** (+1 test:
  `WorkspaceSelector` muestra el wizard para SuperAdmin sin organizaciones).
- End-to-end con backend `CIAGRO_SEED_DEMO=0` (sistema vacío): `admin` (rol 5) recibe 0
  organizaciones y se muestra el wizard.

### Deuda técnica menor

- `src/types/api.d.ts` no se regeneró; el `id` que ahora devuelve el endpoint de creación
  de organización se lee con una aserción de tipo puntual en `FirstUseWizard`. Regenerar
  con `npm run types:gen` cuando convenga.

## Sesión 18 — Mejoras de producto: wizard, UX admin, visor y organizaciones inactivas (2026-06-03)

### Contexto

Sesión de pulido sobre la rama `dev` (frontend canónico), tras integrar el wizard de primer
uso y el visor. Conjunto de mejoras pedidas mientras se probaba el sistema de cero con base
de datos limpia (`CIAGRO_SEED_DEMO=0`).

### Wizard de primer uso → mini-tutorial completo

`FirstUseWizard` pasó de 3 a **5 pasos**: bienvenida → organización → CIAgros → **productores**
(1-2 AgroUnit tipo Productor) → **asignar productores a CIAgros** (matriz de checkboxes) →
final con **aviso de que aún no hay usuarios** y cómo registrarlos/asignarlos desde
Administración. Reusa `useCreateAgroUnit` y `useCreateDataCentralAssignment`. Cada paso
conserva los ids creados para el siguiente. Animación **slide-in** por paso (`key={step}` +
keyframe `wizard-slide-in`). Requirió un fix de backend (id en `DataCentralWriteSerializer`)
para que la asignación de productores a CIAgros recién creadas funcionara.

### UX de Administración

- **Banners informativos** (azul) en las tabs *Usuarios* y *Agrounidades* de una CIAgro,
  explicando que la asignación da acceso al "espacio de datos" de la CIAgro (se evitó el
  término *workspace* a pedido).
- Labels: **"Dueño de organización"** (antes "Owner") con nota explicativa en crear/editar/ver;
  **"Código o nombre"** (antes "Nombre") para CIAgros.
- `AssignCombobox` con prop **`inline`**: el dropdown crece el panel en vez de desbordarlo;
  el `DialogContent` anima su altura (`interpolate-size: allow-keywords` + `.animate-size`).

### Visor de Datos Agrícolas

- **Nivel productor**: `ProducerRanchesMap` dibuja un **pin por rancho** (cascada de ubicación
  geom Point → lat/lon → centroide de sus parcelas). Clic en un pin sube a nivel rancho.
- **Nivel rancho**: pin con el nombre del rancho; la tarjeta flotante Productor·Rancho ahora
  **navega** (productor → vuelve a productor; rancho → vuelve a las parcelas).
- **AspersionMap**: prop `floatingToolbar` → toolbar **transparente y flotante** sobre el mapa,
  botones de capa más pequeños; botón **"← Parcela"** con estilo de retorno. El modal del
  task-manager conserva su toolbar en flujo (no se ve afectado).

### Fix: Manager dueño de organización sin CIAs

`WorkspaceSelector` reescrito con `ManagerEntry`/`BasicEntry`. Antes, un Manager (rol 4) dueño
de una org **sin CIAs hijas** caía en `NoAccessScreen` (la decisión se tomaba por
`user.datacentrals` antes de mirar si poseía organizaciones). Ahora `ManagerEntry` consulta
`useDataCentralsMain`: si ve alguna org muestra el selector jerárquico aunque la org no tenga
CIAs, y `DataCentralMainSelector` muestra "esta organización aún no tiene CIAgros".

### Organizaciones inactivas deshabilitadas

Con el backend excluyendo orgs inactivas de los listados y de `/users/me/`, el frontend:

- `useDataCentralMains(includeInactive)` y `useDataCentrals(dcmId, includeInactive)` — el panel
  admin pide `true` (para reactivarlas); el selector y el visor usan el default (sin inactivas).
- **Guard de ruta `/w/$dc`**: `beforeLoad` redirige a `/workspaces` si la CIA no está entre las
  accesibles del usuario; un `useEffect` reactivo **expulsa en caliente** (con toast) si la org
  se desactiva durante la sesión y `/me` deja de incluir la CIA.

### Verificación

- `tsc --noEmit` → 0 errores. Suites afectadas (workspace, admin, geodata-visor, guards) en
  verde tras cada cambio.

---

## Sesión 19 — Mejoras de UX en Task Manager y Visor (2026-06-03)

### Contexto

Tanda de mejoras visuales y de usabilidad pedidas durante revisión del producto.
Sin cambios en backend. Commit checkpoint `7b219e5` en rama `dev`.

### Sidebar — label "Task Manager"

`AppSidebar.tsx`: el módulo que antes figuraba como "Programas" ahora se llama
**"Task Manager"** en la barra lateral izquierda de los workspaces. Test
`AppSidebar.test.tsx` actualizado en consecuencia (4 ocurrencias).

### Gantt — orden ascendente

`GanttHierarchy.tsx` (`mapMastersToTasks`): los tres niveles jerárquicos ahora se
ordenan de **más viejo a más nuevo** antes de construir el `Task[]` del Gantt:

- Programas maestros → por `est_start_date`
- Subprogramas (hijos) → por `est_start_date`
- Sesiones de aspersión → por `aspersion_date`
- Sesiones fitosanitarias → por `session_date`

Decisión de implementación: se construye `treeById` (mapa `id → tree`) para
desacoplar el sort de los maestros del índice `i` de `trees[]` (que sigue el orden
original de la lista antes del sort). Sin este lookup, `trees[idx]` post-sort
apuntaría al árbol equivocado.

### Panel Task Manager — encabezado y modal informativo

`w.$dc.task-manager.tsx`:

- Título: `"Programas"` → `"Task Manager"`.
- Subtítulo: `"Cronograma de Programas, Subprogramas y Sesiones."` →
  `"Planificación y seguimiento de programas, subprogramas y sesiones de campo."`.
- Botón: `"+ Nuevo Programa"` → `"+ Nuevo"`.
- **Ícono (i)** junto al título: botón con `<Info>` de lucide-react; abre un
  `Dialog` que explica los tres niveles del módulo (Programa, Subprograma, Sesión)
  con un bullet de color por nivel y texto descriptivo del dominio agrícola.
- Estilo del modal informativo: `text-xs`, `px-1 pb-2`, color fijo `#2e2e2e`
  (no heredado del tema) para mayor contraste sobre fondo claro.
- Textos de estado: "Cargando Programas…" → "Cargando…"; "No hay Programas…" →
  "No hay programas…"; mensaje del botón vacío actualizado a `"+ Nuevo"`.

### Modos de mapa — intento y rollback (checkpoint)

Se intentó agregar un selector de modos de fondo (Satélite / Calles / Terreno /
Híbrido) a los tres mapas del Visor de Datos (`AspersionMap`, `RanchPlotsMap`,
`ProducerRanchesMap`). La implementación usó `BasemapLayer` con `key={modeKey}` en
la `<Source>` de react-map-gl, lo que forzaba un unmount/remount al cambiar de
modo. MapLibre re-agrega la capa al **final** del stack tras el remount, quedando
encima de las capas de datos (polígonos, rectángulos) y ocultándolas.

Se revirtieron todos los cambios antes de reimplementar. El commit `7b219e5` sirve
como **checkpoint limpio**. La reimplementación correcta usará `setTiles` reactivo
(sin remount) con solo los modos **Satélite** e **Híbrido**.

### Verificación

- `tsc --noEmit` → **0 errores**. `vitest run` → **177/177 verde** (sin tests nuevos;
  ajuste en `AppSidebar.test.tsx`).

## Sesión 20 — Modos de mapa Satélite/Híbrido en el Visor de Datos (2026-06-03)

Reimplementación correcta del selector de modos de fondo que en la Sesión 19 quedó
como spike revertido. Objetivo simple: poder alternar entre imagen satelital pura y
una vista híbrida (satélite + carreteras + etiquetas).

### Causa raíz de los intentos fallidos previos

1. **`VITE_MAPTILER_KEY` era un placeholder** (`your-maptiler-key-here`). El modo
   híbrido pedía teselas a MapTiler con esa key inválida → `403` → nunca cargaba
   nada → "no se ve ningún cambio". El híbrido era **imposible** sin una API key
   válida.
2. `setTiles()` reactivo era frágil: timing de carga del mapa + mismatch de
   `tileSize`/`maxzoom` entre proveedores.

### Solución adoptada — overlays de referencia de ESRI + toggle de visibilidad

ESRI publica capas de referencia **gratuitas y sin API key** (PNG transparente)
diseñadas para superponerse a World Imagery:

- `Reference/World_Transportation` → carreteras.
- `Reference/World_Boundaries_and_Places` → etiquetas/lugares/límites.

`ESRI_STYLE` (en `AspersionMap.tsx`) ahora define, además de la imagen base, esas
dos capas de referencia con `layout.visibility: 'none'` inicial. Todas las capas
del basemap se declaran en el estilo inicial, así quedan **siempre al fondo**; las
capas de datos que monta react-map-gl se añaden encima. Cambiar de modo solo alterna
la **visibilidad** de las capas de referencia → **cero remount, cero reordenamiento,
cero dependencia de API key**.

`mapModes.ts` se reescribió: se eliminó MapTiler/`BLANK_STYLE`/`MAP_MODES.tiles` y se
expone un hook compartido `useMapMode(mapRef)` que mantiene el modo activo y aplica
`setLayoutProperty(id, 'visibility', …)` sobre las capas de referencia. Si el estilo
aún no terminó de cargar, espera al evento `load` antes de tocarlas (setLayoutProperty
lanza si el estilo no está listo).

### Alcance por mapa

- **Navegación** (`ProducerRanchesMap`, `RanchPlotsMap`): selector Satélite/Híbrido
  vía `useMapMode`.
- **Vista de capas de datos** (`AspersionMap`, heatmap de aspersión): a pedido, se
  **quitó el selector** — el satélite puro es lo correcto para el heatmap (carreteras
  y etiquetas estorbarían). Queda fijo en satélite (default del estilo).

### Verificación

- Endpoints ESRI de referencia verificados (`200`, PNG transparente).
- `tsc --noEmit` → **0 errores**. `vitest run` → **177/177 verde**.
- Confirmado manualmente por el usuario: el cambio de modo funciona.

## Sesión 21 — Tarjeta de % de aplicación por categoría (área) en el Visor (2026-06-22)

A nivel **sesión** del Visor de Datos, además del semáforo de la barra inferior, se
añade una **tarjeta sobre el mapa** (columna derecha, **debajo** de la lista de
sesiones) que muestra, por categoría de % de aplicación: `<% del área> · <área en ha>`,
y donde **cada categoría es un filtro** que comparte estado con la barra inferior.

### Decisiones (confirmadas con el usuario)

- **Base del %** = % del área: `áreaCategoría ÷ áreaTotalConMeta` (las categorías con
  meta suman ~100%).
- **Barra inferior**: se mantiene; la tarjeta es adicional y **comparte** el estado de
  filtro (`checkedBuckets`/`toggleBucket`).
- **`sin_meta`**: omitido (solo las categorías con meta válida), coincidiendo con el
  `area_total_ha` del backend.

### Cambios

- **`CategoryStatsCard.tsx` (NUEVO)** — tarjeta presentacional. Por categoría: checkbox
  + pastilla de color + etiqueta/rango + `{%} · {ha}`. Encabezado con el total con meta.
  Reusa `areaShareByBucket`/`formatHa` de `AspersionMap`.
- **`AspersionMap.tsx`** — nueva prop `sessionsSlot` que renderiza una columna derecha
  (slot de sesiones + tarjeta, esta solo cuando la capa activa es la categórica). Se
  exportan `areaShareByBucket` (% de área por bucket sobre la base de categorías) y
  `formatHa`. Sin `sessionsSlot` (p. ej. el modal del task-manager) el comportamiento
  queda idéntico al anterior.
- **`SessionsPanel.tsx`** — nueva prop `floating` (default `true` = comportamiento
  actual). Con `floating={false}` usa variante de **ítem de columna** (sin
  posicionamiento absoluto) para convivir con la tarjeta.
- **`GeodataDashboard.tsx`** — a nivel **sesión**, `SessionsPanel` se inyecta como
  `sessionsSlot` de `AspersionMap` (la lista vive dentro del mapa, con la tarjeta
  debajo); a nivel **parcela** sigue flotante como antes.

### Datos (dependencia con backend)

El `area_ha` por punto lo provee el backend. Hasta esta sesión venía NULL (el CSV no
traía área), por lo que la tarjeta salía en `0.0%` / `—`. Se resolvió en el backend
(trigger + backfill + refresh de la MV, migración `0033`), no con un fallback en el
front. Con eso la tarjeta muestra valores reales.

### Verificación

- `tsc --noEmit` → **0 errores**.
- `vitest run` (AspersionMap, CategoryStatsCard, SessionsPanel, GeodataDashboard) →
  **25/25 verde** (incluye tests nuevos de `areaShareByBucket` y `CategoryStatsCard`).
- Verificado en `npm run dev` contra el backend con `area_ha` ya poblado.

## Sesión 22 — Admin de agrounidades (sectores, aliados, ranchos/parcelas) + animaciones de modales (2026-06-23)

Cuatro frentes de trabajo sobre el panel `/admin` y la capa de UI. Varios archivos se
solapan entre features (p. ej. `AgroUnitPanel.tsx`, `RanchPanel.tsx`, los 7 paneles con
pestañas), por lo que se documentan juntos.

### 1. Sectores agrícolas: editar y eliminar

La pestaña Sectores solo permitía listar y crear. Se añade editar/eliminar (el backend ya
lo soportaba: `agro_sectors/{id}/` PATCH/DELETE).
- **`hooks/useAgroSectors.ts`** — `useUpdateAgroSector` (PATCH) y `useDeleteAgroSector`
  (DELETE), invalidando `AGRO_SECTORS_QUERY_KEY`.
- **`dialogs/CreateSectorDialog.tsx`** — modo edición (prop `sector`): precarga y hace
  PATCH; reutiliza el mismo formulario.
- **`sections/AgroUnitsSection.tsx`** — columna "Acciones" (Editar/Eliminar, gated a
  Supervisor+), borrado con `confirm()`.
- Tests: `AgroUnitsSection.test.tsx` (mock de los hooks nuevos + 2 tests de acciones).

### 2. Aliados (RanchPartner): selector de agrounidad filtrado por tipo

El formulario pedía pegar el **UUID** de la unidad. Ahora el "Tipo de relación" filtra y la
"Unidad" es un selector de agrounidades de ese tipo (espejo de
`RELATION_TO_UNIT_TYPE` del backend).
- **`hooks/useAgroUnits.ts`** — `useAgroUnits(unitType?)` filtrable por `?unit_type=`.
- **`hooks/useRanchPartners.ts`** — `RanchPartnerCreate` omite los read-only nuevos.
- **`panel/RanchPanel.tsx`** — Select de unidad filtrado; limpia la unidad al cambiar de
  tipo; muestra `partner_name` en la lista (en vez del UUID).
- **`types/api.d.ts`** — `partner_name`/`partner_unit_type` añadidos a mano al schema
  `RanchPartner` (se evitó regenerar todo el archivo para no arrastrar drift no
  relacionado). Backend: ver Sesión 22 punto 5 del repo back.

### 3. Ranchos y parcelas desde el detalle de una AgroUnit

`AgroUnitPanel` gana pestañas **Ranchos** y **Parcelas** (solo para unit_type Productor /
Asociación agrícola) y contadores en Detalle. Backend sin cambios (filtros `?producer=` y
creates ya existían).
- **`panel/AgroUnitPanel.tsx`** — `canManageRanches`; `useRanches(unit.id)` y
  `usePlots({producerId})`; contadores; pestaña Ranchos (lista + "Nuevo rancho"); pestaña
  Parcelas (parcelas agrupadas por rancho + "Nueva parcela" por rancho; guía si no hay
  ranchos); diálogos anidados.
- **`components/RanchFormDialog.tsx`** — prop `fixedProducerId` (fija/oculta el productor
  al crear desde la agrounidad).

### 4. Animaciones de modales (toda la app)

Los modales aparecían/cerraban de golpe; las clases `animate-in/out` de `dialog.tsx`/
`sheet.tsx` eran inertes porque faltaba el plugin.
- **Aparición/cierre (centralizado)**: `tailwindcss-animate` instalado y registrado en
  `tailwind.config.ts` → activa las animaciones ya declaradas en todos los modales/sheets
  (bonus: select/dropdown).
- **Altura dinámica al cambiar de pestaña**: `auto-animate` se descartó (solo hace
  crossfade, no interpola la altura del contenedor). Se creó
  **`components/ui/animated-height.tsx`** (ResizeObserver + transición CSS de `height`,
  respeta `prefers-reduced-motion`, no recorta en reposo → no rompe el scroll del modal) y
  **`components/ui/animated-tabs.tsx`** (`AnimatedTabs` = `Tabs` envuelto en
  `AnimatedHeight`). Se cambió el import `Tabs` → `AnimatedTabs as Tabs` en los **7 modales
  con pestañas** (AgroUnitPanel, RanchPanel, PlotPanel, DataCentralMainPanel,
  DataCentralPanel, PhytosanitaryPanel, ProfileModal). Las 2 secciones no-modales quedan
  sin tocar.
- **`src/test/setup.ts`** — mock de `ResizeObserver` (jsdom no lo trae).

### Verificación

- `tsc --noEmit` → 0 errores. `vitest run` → **187/187** verde.
- Manual en `npm run dev`: editar/eliminar sectores; crear aliado por selector (con
  nombre); crear rancho/parcela desde la agrounidad; modales con animación de apertura/
  cierre y de altura al cambiar de pestaña.

---

## Sesión 23 — Reporteador de Sesiones (FRONTEND) · rama `dev-reports`

> Backend Fase AC (rama `dev-session-report`) ya completo/validado. Esta sesión consume su API
> y construye la UI/UX. Homologación DIFERIDA: `dev-reports` + `dev-session-report` se mergean
> juntas a `dev`→`master` solo cuando ambas estén validadas. Contrato: `session-report-front`.

### act `analyze` + `plan` (con pausa) — decisiones F1–F5

- **F1** Panel = `SessionReportPanel` autónomo en **Sheet lateral ancho** (el `sessionsSlot` del
  visor mide ~224px, insuficiente). Reutilizado desde el visor y desde Task Manager.
- **F2** Tipos regenerados con `npm run types:gen` contra el back de Fase AC en `:8500`.
- **F3** Semáforo = **`stats_snapshot.semaforo[*].color` del backend** (las `APPLICATION_CATEGORIES`
  del visor tienen otros buckets/rangos y **no** aplican; corrige el supuesto del roadmap FR-RS.B2).
- **F4** "Lanzar actividad relacionada" **diferida**: solo enganche `related_*`; dialog de creación
  a fase posterior (gap FR).
- **F-acceso** toggle en visor **y** botón en `SesionModal`.
- **F5** Sync = botón directo + toast; oculto/disabled si `publicado`; 409 con mensaje claro.

### act `implement` — Step 1 `types-hooks*` (✅, en pausa)

- `npm run types:gen` → `src/types/api.d.ts` con `session-reports`/`session-issues`. El diff fue
  grande (el schema estaba desactualizado): typecheck pasó de **17 → 5** errores; los 5 restantes
  son **pre-existentes y ajenos** (admin/workspace, `id` requerido en bodies de create) → gap
  GAP-FR-RS-001, fuera de alcance por decisión del dev.
- Feature `src/features/session-report/`:
  - `types.ts` — `SessionReport`/`SessionIssue` del schema + interfaces de snapshots (el schema los
    expone como `unknown`) + helpers `generalSnapshotOf`/`statsSnapshotOf`.
  - `hooks/useSessionReport.ts` — `useSessionReport` (GET filtrado → reporte único o null), create,
    update (no recalcula), **sync (409 → `ReportPublishedError`)**.
  - `hooks/useSessionIssues.ts` — list + create/update/delete.
  - `schemas/` — zod (resume obligatorio, fecha no futura/default hoy, enums con valores exactos del
    back incl. espacios `tema de atencion`/`sin atender`).
  - `lib/semaforo.ts` — orden/labels de 5 buckets + **`resolveSemaforoColor`** (el back manda el
    color como NOMBRE: `azul_electrico|verde|verde_amarillento|amarillo|rojo`, no hex → mapeo a hex).
  - `lib/dates.ts` — `todayIso`/`isFutureDate` (fecha local sin desfase de zona).

### Verificación del Step 1

- **Smoke autenticado** contra sesión real `b22db6c4-9837-4efc-ade1-13c4a88355f4` (5226 puntos):
  GET list `200`, POST create, GET detail (snapshots con las claves esperadas), POST **sync `200`**,
  POST issue, DELETE issue+report `204`. Datos del smoke **limpiados** (sesión queda sin reporte).
- Hallazgo de entorno: roles del sistema **sin seedear** en el DB local (admin con `user_role=null`);
  corrido `seed_roles` + admin→SuperAdmin (gap GAP-FR-RS-002).
- Tipos del feature: **0 errores** propios en `npm run typecheck`.

### act `implement` — Steps 4–7 (✅ completos)

- **Step 4 `formulario`**: `ReportForm` (create+edit) RHF+zod+`applyDrfErrors`. `resume_text` oblig,
  `report_date` no futura/default hoy, `lead`/`ranch_manager`/`day_temperature`/`status`. Cableado en
  el panel (empty-state → create con Cancelar; con-reporte → ReportCard + edit). Smoke: PATCH no recalcula stats.
- **Step 5 `issues`**: `SessionIssuesTable` + `IssueForm` (CRUD inline; usa los `*_display` del back).
  Responsable interno (Select `useDatacentralUsers` si hay `datacentralId`) o externo (`outer_assigned_user`).
  `datacentralId` cableado por panel/toggle desde GeodataDashboard, SesionModal y AspersionMapModal.
  related_* (F4) diferido → GAP-FR-RS-004. Smoke CRUD (create/list?report/patch/delete204) OK.
- **Step 6 `sync`**: `SyncReportButton` → `POST .../sync/`; oculto si `publicado`; 409 → `ReportPublishedError`
  con toast. Smoke: 200 en `en_proceso`, 409 en `publicado`.
- **Step 7 `tests`**: 18 tests nuevos (semáforo/fechas/schema/panel). Suite 205/205, typecheck sin
  errores propios (5 ajenos = GAP-FR-RS-001), ESLint limpio.

### Cierre de la sesión 23 (frontend)
- Feature `src/features/session-report/` completo (steps 1–7). Accesos: visor (Task Manager + Visor de datos)
  y Task Manager. Solo aspersión (GAP-AC-001).
- Gaps abiertos: GAP-FR-RS-001 (typecheck ajeno), 002 (roles sin seed), 003 (soft-delete bloquea recrear),
  004 (F4 actividad relacionada diferida). GAP-AC-003 (PDF) futuro.
- **NO homologado** (homologación diferida y conjunta con `dev-session-report`). Pendiente: demo manual completa del dev.

## Sesión 25 — Saneamiento de gaps pre-homologación (rama `dev-saneamiento-gaps`, 2026-07-06)

Sesión dedicada de saneamiento (`session-saneamiento-gaps`), no features. Gaps GAP-FR-RS-001/005 de
`logs/gap_log.csv`, afinados en `analyze` frente al código real antes de tocar nada.

### GAP-FR-RS-001 — typecheck roto por `id` requerido en bodies de `create`

El análisis mostró que el "fix de raíz en backend" propuesto originalmente ya estaba parcialmente
hecho: `DataCentralWriteSerializer`/`DataCentralMainWriteSerializer` marcan `id` `read_only` desde el
commit `a7af1b6` (ya en `dev` del back). El error de typecheck persistía porque
`SPECTACULAR_SETTINGS["COMPONENT_SPLIT_REQUEST"]=False` es una decisión **deliberada** del backend
(comentario en `config/settings/base.py`: activarlo rompe los `GeoFeatureModelSerializer` de otras
apps) — drf-spectacular sigue listando `id` como requerido en el schema compartido request/response.
Confirmado con el dev: workaround en front (no tocar ese ajuste global de riesgo alto). Cast `as never`
+ comentario explicando el porqué en los 4 call sites (`CreateDataCentralDialog.tsx`,
`CreateDataCentralMainDialog.tsx`, `DataCentralMainPanel.tsx`, `FirstUseWizard.tsx` ×2).
`npm run typecheck` → 0 errores.

### GAP-FR-RS-005 — ESLint pre-existente en `AspersionMap.tsx`

Ternario usado como *statement* (`no-unused-expressions`, toggle de buckets) convertido a `if/else`.
Las constantes/funciones exportadas junto al componente (`ESRI_STYLE`, `sumAreaByBucket`,
`areaShareByBucket`, `formatHa`) — causa de los warnings `react-refresh/only-export-components` — se
movieron a `src/features/geodata-visor/lib/aspersionMap.helpers.ts`; `AspersionMap.tsx` ahora solo
exporta el componente. Imports actualizados en `RanchPlotsMap.tsx`, `ProducerRanchesMap.tsx`,
`CategoryStatsCard.tsx` y `AspersionMap.test.tsx`. `npx eslint` limpio en todos los archivos tocados;
`npm run test` 210/210 (39/39 archivos) verde; `npm run typecheck` 0 errores.

### GAP-FR-RS-007 (nota, fix en el back)

El fix real vive en `CIAgro_alpha_back` (ver su `development.md`, FASE AD): `rate_quality` ya no se
sobrescribe a `""` en `import_aspersion_csv`; el visor deja de perder el dato crudo del CSV en
sesiones con evaluador asignado.

**Cierre:** sin homologar (diferida y conjunta con `dev-reports`/`dev-session-report`, ver `.CLAUDE/`).
Recomendado commit/push en `dev-saneamiento-gaps`.
