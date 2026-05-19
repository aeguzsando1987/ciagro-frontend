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
Supervisor ve tablas y puede agregar contactos; no ve botón "Nueva Unidad".
