# ROADMAP — CIAgro Alpha Frontend

> **Estado actual:** Sesión 18 — Tanda de mejoras de producto: wizard de primer uso convertido en mini-tutorial (org → CIAgros → productores → asignaciones → info usuarios) con animación; UX de Administración (banners de asignación, labels "Dueño de organización"/"Código o nombre", combobox inline + transición de tamaño); visor con mapa de ranchos por productor (pines) y toolbar flotante; fix Manager dueño de org sin CIAs (no más NoAccessScreen); organizaciones inactivas deshabilitadas en selector/visor con guard de expulsión en caliente. Apoyado en cambios de backend Sesión 18.
> **Última actualización:** 2026-08-21 — Fases PS y NV: scope por parcela y el Visor como pantalla principal. El login entra directo al Visor, el selector de CIAgro queda solo para el Task Manager, la raíz del árbol se adapta al alcance del usuario y el panel lleva migas de pan navegables.
> **Backend:** roadmap propio en `../../CIAgro_alpha_backend/logs/roadmap.md`
> **Producto:** `../../.context/templates/product-doc.md`
> **Convención:** los sprints son estimaciones de **dev-week** (1 dev senior full-time).

---

## FASE 0 · SELECCIÓN DE STACK Y SCAFFOLDING
**Estado:** `[✅] Completada — Sesión 1, 2026-05-12`

Decisiones de stack (Pasos 1–12) tomadas con `propose` y registradas en `dev_log.csv`.
Estructura, scaffolding, validación de endpoints y seed mínimo documentados (Pasos 13–17).

**Stack elegido:** Vite + React + TS · TanStack Router/Query · Zustand · shadcn/ui +
Tailwind · react-hook-form + zod · MapLibre GL · gantt-task-react · Vitest + RTL +
MSW + Playwright · openapi-typescript + openapi-fetch.

**Salidas:** 22 archivos de scaffolding + carpeta `logs/` + script de validación de
endpoints + 6 gaps abiertos (1 alta, 2 media, 3 baja).

---

## FASE FRONTEND 1 · AUTENTICACIÓN Y SELECCIÓN DE WORKSPACE
**Estado:** `[✅] Completada — Demo manual aprobada 2026-05-13`
**Cubre:** Flujo 1 del product-doc (Pasos 1.1 → 1.10).
**Sprints estimados:** 3 dev-weeks.

### Pre-requisitos
- [ ] **GAP-BACKEND-001** resuelto (seed mínimo en backend) — sigue abierto, diferido a antes de Sprint 1.C (E2E).
- [x] `npm install` ejecutado localmente (Node 20.19.6 instalado vía nvm en WSL — 2026-05-13).
- [ ] `scripts/validate-endpoints-fase1.sh` corre en verde — pendiente de GAP-BACKEND-001.
- [ ] `npm run types:gen` genera `src/types/api.d.ts` exitosamente — pendiente de GAP-BACKEND-001.
- [ ] `src/lib/api/client.ts` actualizado para usar `paths` tipados — pendiente de types:gen.

### Sprint 1.A — Auth básico (1 dev-week)
- [x] **1.1** Setup TanStack Router con `__root` + rutas públicas + `_authenticated`.
- [x] **1.2** Pantalla `/login` con react-hook-form + zod schema + shadcn Form.
- [x] **1.3** Hook `useLogin` (TanStack Query mutation) + manejo 401/400.
- [x] **1.4** Guard de auth: si no hay JWT → `/login` (en `_authenticated.beforeLoad`).
- [x] **1.5** Persistir refresh + access en memoria al login exitoso.
- [x] **1.6** Hook `useCurrentUser` consumiendo `/users/me/`.
- [x] **1.7** Zustand `useAuthStore` con `AuthUser`.

### Sprint 1.B — Cambio de password forzado + selector de workspace (1 dev-week)
- [x] **1.8** Pantalla `/change-password` con ChangePasswordForm + useChangePassword.
- [x] **1.9** Guard `requires_password_change=true` en AuthenticatedLayout (useEffect reactivo).
- [x] **1.10** Pantalla `/workspaces` con WorkspaceSelector y bifurcacion por `role_level`.
- [x] **1.11** Componentes `DataCentralMainSelector`, `DataCentralChildSelector`, `NoAccessScreen`.
- [x] **1.12** Click en hija → navega a `/w/$dc/dashboard` (rutas w.$dc y w.$dc.dashboard creadas).

### Sprint 1.C — Workspace shell + refresh + logout + tests (1 dev-week)
- [x] **1.13** Layout de workspace: `AppHeader` (logo, DC activa, menú user) + `AppSidebar` (módulos filtrados por `role_level`) + `roles.ts` + `useWorkspaceStore`.
- [x] **1.14** Página dashboard placeholder con bienvenida (nombre usuario + DC activa).
- [x] **1.15** Cambio de DC desde header — integrado en AppHeader dropdown.
- [x] **1.16** Refresh silencioso ante 401 en `client.ts` (mutex de promise + retry GET + forceLogout).
- [x] **1.17** Logout conectado en AppHeader — useLogout ya existía de Sprint 1.B.
- [x] **1.18** 24 tests componente verdes (8 archivos). 3 E2E Playwright diferidos (GAP-BACKEND-001).

### Criterios de salida Fase Frontend 1
- [x] `npm run typecheck` verde (0 errores).
- [x] `npm run test` verde (24/24 tests).
- [ ] Los 3 tests Playwright pasan — diferidos, requieren entorno CI con backend.
- [x] Demo manual end-to-end — aprobada 2026-05-13 (5 usuarios, 5 escenarios).
- [x] `logs/development.md` con entrada de cierre de Fase 1.
- [x] `meta.current_step` del contrato avanzado a Fase 2.

---

## FASE FRONTEND 2 · TASK MANAGER (GANTT)
**Estado:** `[✅] REIMPLEMENTACIÓN COMPLETADA 2026-05-16 — Sesión 6, Bloques 0–5. Flujos 1–8 del caso de uso implementados. 77/77 tests. 0 errores typecheck.`
**Cubre:** Flujo 2 del product-doc (Pasos 2.1 → 2.11) + caso de uso `.context/taskmanager_usecase.md`.
**Sprints estimados:** 4 dev-weeks.

> **Reinicio (Sesión 5, 2026-05-15):** la capa de UI del Task Manager se reescribe
> por divergencias con el caso de uso (selector de Productor indebido en el Hijo,
> ciclo como texto libre, sin fechas reales en edición, sin strict_mode/assigned_to
> en sesiones, navegador de modales frágil, bug 400 silencioso). Enfoque híbrido:
> se recicla la capa de datos y la vista Gantt; se reescriben diálogos, modales y
> navegador. Ver `development.md` Sesión 5 y el plan de la sesión. Sprints 2.A–2.C
> previos quedan como referencia histórica abajo.

### Sprint 2.A — Listado y árbol del Gantt (1 dev-week) ✅
**Estado:** `[✅] Completado — Demo manual aprobada 2026-05-13`
- [x] **2.1** Ruta `/w/$dc/task-manager` con `loader` (`ensureQueryData`) que precarga `/master-programs/?datacentral=<dc>`. Guard `beforeLoad` redirige a `/dashboard` si `role_level < SUPERVISOR` (3). `validateSearch` con zod para `status` y `agro_unit`. `loaderDeps` reactivo a search params.
- [x] **2.2** `GanttChart` wrapper sobre `gantt-task-react` con selector de escala (Día/Semana/Mes/Año). `TaskListHeader` y `TaskListTable` custom en español (Nombre/Desde/Hasta/Estado) con columnas redimensionables (drag, 50–400px), separador grueso 3px entre panel y timeline, expander chevron en Maestros, indentación visual por nivel. Font 11px.
- [x] **2.3** Hooks `useMasterPrograms` (queryOptions exportado, compartido entre loader y componente) + `useMasterTree(masterId, enabled)` lazy. `apiClient` tipado de openapi-fetch.
- [x] **2.4** `GanttHierarchy` con expand/collapse local (`Set<masterId>`). `useQueries` para N árboles en paralelo respetando Rules of Hooks. `mapMastersToTasks` puro con prefijos `m:`/`h:`/`s:`. Indicador rojo de fuera-de-rango ya activo desde 2.A (paso 2.11 anticipado para evaluar GAP-RIESGO-001).
- [x] **2.5** `FilterBar` con search params `status` y `agro_unit`. `<select>` HTML nativo en 2.A (shadcn por demanda). Botón "Limpiar filtros" condicional.

**Cobertura tests Sprint 2.A:** 27 tests nuevos (51/51 verdes total). `dateUtils.test.ts` (14), `GanttHierarchy.test.ts` (7), `FilterBar.test.tsx` (4), `AppSidebar.test.tsx` (+1, +ajustes).

**Bugs corregidos durante Sprint 2.A:**
- `client.ts` baseUrl duplicado (`/api/v1/api/v1/...`): primer consumidor real de `apiClient.GET()`. Fix: normalizar quitando sufijo solo para `apiClient`, Fase 1 sin tocar.
- Sidebar minRole "Programas" subido a `SUPERVISOR` (estaba en `TECHNICIAN`, contradecía product-doc).
- Contrato `session_contract.json`: `/field-tasks/` → `/tasks/` (5 ocurrencias).

**Demo manual:** `gerente01` ve Master + Hijo creados via seed manual (Django shell), expand/collapse OK, filtros OK, guard de rol OK con `tecnico01`.

### Sprint 2.B — Creación de Maestro / Hijo / Sesión (1 dev-week) ✅
**Estado:** `[✅] Completado — Demo manual pendiente 2026-05-14`
- [x] **2.6** `CreateMasterDialog` con validación zod (Paso 2.2 product-doc).
- [x] **2.7** `CreateHijoDialog` con cascada productor → rancho → parcela → cultivo (Paso 2.3).
- [x] **2.8** `CreateSessionDialog` para Aspersión + Phyto (Paso 2.4).
- [x] **2.9** Mapeo de errores DRF al campo correspondiente (`form.setError`).

### Sprint 2.C — Detalle, edición, status y validación visual (1 dev-week)
- [ ] **2.10** `DetailPanel` lateral al click sobre bloque (Paso 2.6) con mini-mapa MapLibre.
- [ ] **2.11** Indicador rojo fuera-de-rango con validación cliente espejando backend (Paso 2.5).
- [ ] **2.12** Edición de Programa Hijo desde panel, gated por `role_level >= 4` (Paso 2.7).
- [ ] **2.13** Cambio de status según rol (Paso 2.8) con optimistic updates.
- [ ] **2.14** **Punto de re-evaluación de gantt-task-react (GAP-RIESGO-001)**. Si UX no convence → decidir migración a custom (3-4 semanas extra) o continuar.

### Sprint 2.D — Carga CSV + stats + reportes + tests (1 dev-week)
- [ ] **2.15** Dialog de carga CSV con preview de columnas (Paso 2.9).
- [ ] **2.16** Indicador de progreso del import en background.
- [ ] **2.17** Tab de stats post-import (Paso 2.10) con cards de métricas.
- [ ] **2.18** Botón "Generar reporte" en Programa Hijo (Paso 2.11).
- [ ] **2.19** Tests: 12 component tests + 4 E2E (crear M→H→S, editar fechas con indicador, cargar CSV, cambiar status como Técnico vs Gerente).

### Criterios de salida Fase Frontend 2
- ✅ Los 11 pasos del Flujo 2 funcionan end-to-end contra backend real.
- ✅ Permisos por rol respetados sin duplicar lógica del backend (regla 🛑 #7).
- ✅ Decisión final sobre gantt-task-react vs plan B documentada.
- ✅ `npm run test` y `npm run test:e2e` verdes.

---

---

## FASE FRONTEND — VISOR DE CAPAS DE ASPERSIÓN
**Estado:** `[🔄] Implementada — Pendiente demo manual con backend real (6.E.2)`
**Sesión:** 15 (2026-05-25) · **Contrato:** `aspersion-fase-6-visor-capas` (`session_contract.json`)
**Cubre:** Caso de uso `.context/geodata_analysis_usecases.md` §2–§7.
**Sprints estimados:** 1 dev-week. **Backend:** ✅ completo, sin endpoints nuevos.

### 6.A — Análisis (cerrado antes de esta sesión)
- [x] **6.A.0** Caso de uso analizado (§2–§7).
- [x] **6.A.1** Backend analizado: `GeoModelSerializer` lista plana paginada (no FeatureCollection); `GeoPointsPagination` (500 default, 2000 máx); endpoints confirmados.
- [x] **6.A.2** Viabilidad confirmada. Geometría y cuartiles en cliente. **Decisión 6.B.0:** trig manual sin dependencias (Opción A elegida sobre `@turf/destination`).

### 6.B — Lógica pura (cerrada)
- [x] **6.B.1** `lib/plotRectangles.ts` — `rectangleRing` (trig manual plana, 4 esquinas locales rotadas por rumbo de brújula) + `pointsToRectangleCollection` (descarte de puntos inválidos, fallback heading). 8 tests unitarios.
- [x] **6.B.2** `lib/aspersionLayers.ts` — 5 capas `{key,label,field,kind,unit}`, `APPLICATION_CATEGORIES` (5 categorías semáforo con colores), `QUARTILE_PALETTES` (4 tonos por capa 2–5), funciones puras `classifyApplication`, `computeQuartiles`, `quartileOf`, `buildQuartileDefs`. 12 tests unitarios.

### 6.C — Datos (cerrada)
- [x] **6.C.1** `hooks/useAspersionPoints.ts` — itera páginas (`page_size=2000`) siguiendo `next` hasta acumular `AspersionPoint[]` completo. Patrón fetch directo con `tokens.getAccess()`.

### 6.D — UI del visor (cerrada)
- [x] **6.D.1** `AspersionMapModal.tsx` — modal grande (`max-w-6xl`, 92vh), cierre solo via `✕ Cerrar` (`preventDefault` en `onInteractOutside`/`onEscapeKeyDown`). Mapa ESRI + polígono de parcela + **una sola Source/Layer GeoJSON** con color `data-driven` (expresión `match` para categorías; `match q1/q2/q3/q4` para cuartiles). `fitBounds` reactivo via `MapRef`.
- [x] **6.D.2** Selector de 5 capas; Capa 1 (% aplicación) por defecto.
- [x] **6.D.3** Hover tooltip (`onMouseMove` + `queryRenderedFeatures`): lat/lon + valor(es) de la capa. Capa 1 además: `applied_rate_l`, `target_rate_l`, `p_apl`, categoría.
- [x] **6.D.4** Tarjeta de leyenda inferior: categorías/cuartiles con checkboxes (todos ON por defecto), toggle oculta rectángulos via expresión `filter` del layer. Resumen MV (`pct_below/in_range/above`) en Capa 1.
- [x] **6.D.5** `SesionModal.tsx` — botón `📍 Ver detalles de aspersión` visible si `import_status==='done' && points_count>0 && role_level>=SUPERVISOR`. Gating `ROLE_LEVELS.SUPERVISOR` (regla #5).
- [x] **6.D.6** `AspersionMapModal.test.tsx` — 6 tests: render capas, cierre, leyenda Capa 1, cambio a cuartiles, toggle checkbox, modal cerrado. `react-map-gl/maplibre` mockeado.

### 6.E — Cierre
- [x] **6.E.1** `tsc --noEmit` → 0 errores. `vitest run` → 143/143 verde (26 files, +26 tests nuevos).
- [ ] **6.E.2** Demo manual — pendiente: backend levantado + sample CSV importado + visor abierto con las 5 capas + hover + leyenda.
- [x] **6.E.3** Logs actualizados: `dev_log.csv` (pasos 6.B.0→6.D.test), `gap_log.csv` (`GAP-ASPERSION-PERCENTILES`, baja), `development.md`, `roadmap.md`.

### Criterios de salida
- [x] `tsc --noEmit` 0 errores.
- [x] `vitest run` verde (≥8 tests nuevos — se implementaron 26).
- [x] Archivos de aceptación existentes: `lib/plotRectangles.ts` + test, `lib/aspersionLayers.ts` + test, `hooks/useAspersionPoints.ts`, `components/AspersionMapModal.tsx` + test.
- [ ] Demo manual con backend real — **pendiente** (regla 4.3: fase no se declara cerrada sin demo).

### Nuevos archivos (Sesión 15)
- `src/features/task-manager/lib/plotRectangles.ts` + `.test.ts`
- `src/features/task-manager/lib/aspersionLayers.ts` + `.test.ts`
- `src/features/task-manager/hooks/useAspersionPoints.ts`
- `src/features/task-manager/components/AspersionMapModal.tsx` + `.test.tsx`

### Archivos modificados (Sesión 15)
- `src/features/task-manager/panel/SesionModal.tsx` (botón + modal)

---

## FASE FRONTEND · REPORTEADOR DE SESIONES
**Estado:** `[ ] Pendiente — sesión dedicada (contrato en .context/templates/session-template.json)`
**Cubre:** use case `.context/usecases/use-case-report-session.md` (flujos 1–4).
**Backend:** ✅ **Fase AC completa y validada** en rama `dev-session-report` (CIAgro_alpha_back): endpoints
SessionReport/SessionIssue + sync, 13 tests, admin funcional.
**Rama de este repo:** crear **`dev-reports`** (desde `dev`). Homologación DIFERIDA: `dev-reports` (front) y
`dev-session-report` (back) se mergean **juntas** a `dev`→`master` solo cuando ambas estén validadas.

> Reporte por SESIÓN, polimórfico. Se accede desde el Task Manager y desde el Visor de datos
> (toggle a la derecha del visor de aspersión). Tarjeta con datos denormalizados + semáforo de
> 5 buckets, observaciones, tabla de temas de atención (issues) y botón "Sincronizar datos de sesión".
> Reutiliza `AspersionMapModal`, los hooks de sesión y el formulario de creación de sesión.

### API real (Fase AC backend) a consumir
- `GET/POST /field_ops/session-reports/` — list (scoped) / create. Filtro: `?session_type=aspersion&object_id=<uuid header>`.
- `GET /field_ops/session-reports/<id>/` · `PATCH .../update/` · `DELETE .../delete/`
- `POST /field_ops/session-reports/<id>/sync/` — "Sincronizar datos de sesión" (recalcula snapshots; **409** si publicado).
- `GET/POST /field_ops/session-issues/` (`?report=<uuid>`) · `PATCH .../update/` · `DELETE .../delete/`
- **Crear reporte:** body `{ session_type:"aspersion", object_id:<uuid>, resume_text, report_date?, day_temperature?, lead?, ranch_manager?, status? }`.
- **`stats_snapshot`:** `points_count, area_cobertura_ha, dosis_promedio_l, media_meta_l, volumen_total_l, fecha_inicio, fecha_fin, variables{velocidad,flujo_liquido,presion → {avg,min,max,unit}}, proporcion_meta[], semaforo{sobredosis|excelente|esperada|baja|deficiente → {color,area_ha,pct_area_total}}`.
- **`general_snapshot`:** `actividad, productor, rancho, parcela, superficie_parcela_ha, ubicacion, cultivo, fecha_aplicacion`.
- **Permisos (D8):** lectura con scope; escritura `IsTechnician` (nivel ≥2); borrar reporte `IsSupervisor`.
- **D3:** editar texto NO recalcula stats; solo "Sincronizar" lo hace; al publicar, congelado.

> **Sesión 23 (2026-06-30/07-01) — Reporteador FRONTEND: ✅ IMPLEMENTADO en rama `dev-reports`.**
> Homologación DIFERIDA: `dev-reports` (front) + `dev-session-report` (back) se mergean juntas a
> `dev`→`master` solo tras validar ambas. 205/205 tests, typecheck sin errores propios (5 ajenos = GAP-FR-RS-001).

### FR-RS.A — Acceso e infraestructura
- [x] **FR-RS.A1** Toggle "Reportes" en el visor de aspersión (`AspersionMapModal` + `GeodataDashboard`) vía `SessionReportToggle` reutilizable + `SessionReportPanel` (Sheet ancho). Gate: `import_status==='done' && points_count>0 && role_level>=SUPERVISOR`.
- [x] **FR-RS.A2** Mismo acceso desde Task Manager (`SesionModal`/AspersionView) reutilizando el panel.
- [x] **FR-RS.A3** Hooks `useSessionReport` / `useSessionIssues` / `useSyncSessionReport` (+ create/update/delete) con `apiClient` tipado. Tipos OpenAPI regenerados (`npm run types:gen`) contra Fase AC.

### FR-RS.B — Tarjeta + formulario de reporte
- [x] **FR-RS.B1** `ReportCard` desde `general_snapshot`+`stats_snapshot` (Agricultor/Granja/Actividad/Área/Proporción meta/Área cobertura/Dosis/Volumen + variables velocidad/flujo/presión avg·min·max + Fecha inicio/fin).
- [x] **FR-RS.B2** `SemaforoBadges` de 5 buckets con `pct_area_total` y `area_ha`. **CORRECCIÓN:** el `color` del backend es un NOMBRE (`azul_electrico|verde|verde_amarillento|amarillo|rojo`), no hex, y los buckets difieren de `APPLICATION_CATEGORIES` → se usa `resolveSemaforoColor` (F3/GAP-AC-004), NO se reutiliza `aspersionLayers`.
- [x] **FR-RS.B3** "Generar reporte de actividad" (si el GET filtrado viene vacío) → `POST` con `session_type:"aspersion"` + `object_id` (`ReportForm` mode=create).
- [x] **FR-RS.B4** Campos editables (`ReportForm`): `resume_text`(oblig), `report_date`(default hoy/no futura), `lead`, `ranch_manager`, `day_temperature`, `status`. `PATCH .../update/` (no recalcula stats — verificado por smoke). Errores DRF por campo con `applyDrfErrors`.
- [x] **FR-RS.B5** `SyncReportButton` → `POST .../sync/`; oculto si `status==='publicado'` (maneja 409 → `ReportPublishedError`).

### FR-RS.C — Tabla de temas de atención (issues)
- [x] **FR-RS.C1** `SessionIssuesTable` + `IssueForm` (CRUD inline): título/`issue_type`/`relevancia`/`attention_status`/`registered_at`/`followed_up_at`/detalle/sugerencia/acción. Vía `session-issues/`.
- [x] **FR-RS.C2** Responsable: interno `assigned_user` (Select `useDatacentralUsers` cuando hay `datacentralId`; muestra `assigned_user_name`) o externo `outer_assigned_user` (texto). Deep-link a perfil pendiente (no hay ruta per-ID; muestra nombre).
- [ ] **FR-RS.C3** (DIFERIDO — F4, ver GAP-FR-RS-004) "Lanzar actividad relacionada": ligar una sesión (aspersión **o fitosanitaria**) al issue. **VIABLE**, desbloqueable reutilizando infra. Distinción clave: *enlazar* una sesión NO necesita el adapter de reporte (GAP-AC-001 no bloquea el enlace phyto). Ruta (5 pasos): **BACK** (1) alias write `related_session_type` en `SessionIssueSerializer` (espejo de `session_type`) → resuelve `content_type` vía `SESSION_TYPE_ALIASES`; (2) añadir `phyto` a `SESSION_TYPE_ALIASES` (solo para enlazar). **FRONT** (3) `CreateSessionDialog` (ya crea aspersión y phyto) devuelve el `id`; (4) selector de programa/master destino; (5) issue → elegir tipo → crear → `PATCH` `related_session_type`+`related_object_id`. La creación de sesiones ya existe; lo pendiente es el **enganche**.

### FR-RS.E — Añadidos UX del panel (sesión 23, 2026-07-01)
- [x] **FR-RS.E1** Encabezado + botón "Sincronizar" **fijos** arriba del panel (`SheetContent` a columna flex: cabecera con borde + cuerpo scrollable).
- [x] **FR-RS.E2** `AspersionMap` gana prop **`locked`** (mapa estático acotado a la parcela: sin zoom/paneo/rotación/perspectiva, `maxBounds` a la parcela; conserva selector de capas). No afecta el visor.
- [x] **FR-RS.E3** Botón vertical **"Ver mapa"** en el borde izquierdo del panel → drawer fijo a la izquierda con `<AspersionMap locked>` (referencia satelital de la parcela; montaje lazy; oculto en móvil).

### FR-RS.F — (FASE FUTURA) Compartir reportes públicos por liga — ver GAP-FR-RS-006
- [ ] **Dictamen: VIABLE (alta).** Compartir un reporte `publicado` con clientes (con o sin usuario) por liga pública.
- [ ] **Enfoque SIMPLE (dev 2026-07-01):** **sin campo `share_token` ni migración** — se reutiliza el **UUID que el reporte ya tiene** (uuid4 = no adivinable). Liga = `/r/<report_uuid>`. **Revocar = despublicar** (status ≠ `publicado` → la liga deja de responder). v1 incluye **todo + el mapa**.
- [ ] **Back:** endpoint público `AllowAny` `GET /field_ops/public/session-reports/<uuid>/` (solo `publicado`, sin scope, read-only) + serializer público (omite PII) + **endpoint público de puntos** para el mapa (ligado al reporte publicado). **Sin migración.**
- [ ] **Front:** botón "Compartir/Copiar liga" (solo `publicado`, copia `/r/<uuid>`) + ruta pública `/r/<uuid>` fuera del shell autenticado + vista read-only (ReportCard/Semáforo/issues + `AspersionMap locked`).
- [ ] **Coordinada back+front, homologación conjunta.** Seguridad: UUID no adivinable, solo publicado, revocar=despublicar, decisión de PII, rate-limit. Descartado: `share_token` dedicado (permitiría rotar sin despublicar, a cambio de migración).

### FR-RS.D — Cierre
- [x] **FR-RS.D1** Tests Vitest+RTL (18 nuevos: semáforo, fechas, schema, panel) + typecheck. Smoke autenticado contra Fase AC (create/update/sync 200+409/issues CRUD). Demo manual validada a ojo por el dev (steps 2–3).
- [x] **FR-RS.D2** Logs frontend (dev_log/development/roadmap/gap_log) + memoria `.CLAUDE/`.
- [ ] **FR-RS.D3** (Futuro) Botón "Generar reporte en PDF" (GAP-AC-003).
- [ ] **Pendiente de cierre:** demo manual completa del dev (create→sync→issues) y homologación conjunta con `dev-session-report`.

### FR-RS.G — Saneamiento de gaps pre-homologación (rama `dev-saneamiento-gaps`, 2026-07-06)
- [x] **GAP-FR-RS-001** typecheck roto por `id` requerido en bodies de `create`. Confirmado que el
  backend ya marca `id` `read_only` (commit `a7af1b6`); el error persiste porque
  `SPECTACULAR_SETTINGS["COMPONENT_SPLIT_REQUEST"]=False` es deliberado (rompería
  `GeoFeatureModelSerializer` en otras apps). Fix: cast `as never` + comentario en los 4 call sites
  (`CreateDataCentralDialog`, `CreateDataCentralMainDialog`, `DataCentralMainPanel`,
  `FirstUseWizard` ×2). `npm run typecheck` → 0 errores.
- [x] **GAP-FR-RS-005** ESLint en `AspersionMap.tsx`: ternario→`if/else` (línea del toggle de
  buckets) + extracción de `ESRI_STYLE`/`sumAreaByBucket`/`areaShareByBucket`/`formatHa` a
  `lib/aspersionMap.helpers.ts` (ya no exporta nada salvo el componente). Imports actualizados en
  `RanchPlotsMap.tsx`, `ProducerRanchesMap.tsx`, `CategoryStatsCard.tsx`, `AspersionMap.test.tsx`.
  ESLint limpio, `npm run test` 210/210 verde.
- [x] **GAP-FR-RS-007** (nota, fix real en backend) — ver roadmap del back. `rate_quality` ya no se
  sobrescribe a `""` en `import_aspersion_csv`; el visor deja de perder el dato crudo del CSV.
- **No homologado.** Recomendado commit/push en `dev-saneamiento-gaps` (front); homologación diferida
  y conjunta con el reporteador (ver `.CLAUDE/`).

---

## FASE FT — Sesiones fitosanitarias: asignación, stats y mapa (Task Manager, 2026-07-06/09)

Símil fitosanitario de lo que ya tenía aspersión, dentro del `SesionModal`/`PhytoView`. Backend en
`CIAgro_alpha_back` (FASE AE). Ramas `dev-session-assign-guard`, `dev-phyto-stats`, `dev-phyto-map`.

- [x] **FT.1 — Responsable obligatorio + estado vacío** (`dev-session-assign-guard`). Una sesión
  fitosanitaria sin `assigned_to` queda huérfana/invisible en la app móvil (`PhytoHeaderListView`
  fuerza `assigned_to=<técnico>`). Se hace **obligatorio** el Responsable al crear phyto (aspersión
  queda opcional: su listado filtra por scope, no por `assigned_to`). Estado vacío en los 4 selects de
  Responsable (crear/editar × aspersión/phyto) cuando la CIA no tiene técnicos asignados.
- [x] **FT.2 — Tarjeta de estadísticas** (`dev-phyto-stats`). `PhytoStatsCard` + hook
  `usePhytoSessionStats` (GET `/phyto/headers/<id>/stats/`): totales, semáforo de presencia y desglose
  por problema. Montada en `PhytoView` cuando hay checkpoints. Análoga al resumen de aspersión.
- [x] **FT.3 — Mapa fitosanitario** (`dev-phyto-map`). Botón "Ver mapa" (gateado a rol ≥ Supervisor y
  con checkpoints) abre `PhytoMapModal`. `PhytoMap`: satelital ESRI + parcela en **verde** + **heatmap
  rojo** ponderado (`critical`=1, `warning`=0.7, `low`=0; rampa translúcida sin halo blanco) +
  **marcadores por punto** agrupados por coordenada (color = peor presencia; los puntos sin peligro no
  se marcan). Clic → popup con **tablita** de todos los hallazgos del punto (problema/tipo/etapa/
  cantidad/presencia + columna **Foto** miniatura→modal + columna **Nota** link→modal). Hook
  `usePhytoCheckPoints` (GET `/phyto/headers/<id>/checkpoints-geojson/`). Reusa `ESRI_STYLE` y
  `usePlotGeometry`.
- **Verificación:** `npm run typecheck` 0 errores, ESLint limpio, `npm run test` 212/212, build OK.

---

## FASE FV — Sesiones fitosanitarias en el Visor de Datos (2026-07-11)

Hasta ahora el Visor de Datos Agrícolas (`geodata-visor`) solo exponía sesiones de **aspersión**. Se
extiende para que las sesiones **fitosanitarias** sean accesibles por las mismas dos vías, reutilizando
el `PhytoMap`/`PhytoStatsCard` del Task Manager (FASE FT). Rama `dev-visor-fitosanitario`. Backend:
`checkpoints_count` anotado en `PhytoHeaderListView` + serializer (sin migración).

- [x] **FV.1 — Explorador agrupado por tipo.** Bajo cada parcela del árbol (`GeodataExplorer`) las
  sesiones se muestran en dos grupos con encabezado propio: **Aspersión** (icono capas) y
  **Fitosanitarias** (icono bug). Nuevo hook `usePhytoSessionHeaders` (GET `/phyto/headers/?plot=`,
  scope por rol vía `PhytoScopeFilterMixin`). La selección lleva `kind: 'aspersion' | 'phyto'`.
- [x] **FV.2 — Mapa por parcela.** Al explorar el mapa y seleccionar la parcela, la columna flotante
  apila **ambos** paneles de sesiones (`SessionsPanel` + nuevo `PhytoSessionsPanel`, con filtro por
  rango de fechas en cliente). Al elegir una sesión fitosanitaria el dashboard monta `PhytoMap`
  (heatmap de checkpoints) con `PhytoStatsCard` arriba y el panel de sesiones en la columna; al elegir
  una de aspersión sigue montando `AspersionMap` como antes. El nivel parcela suma la stat "Sesiones
  fitosanitarias".
- **Backend:** `PhytoMonitoringHeaderSerializer.checkpoints_count` (SerializerMethodField que lee la
  anotación `checkpoints_count_annot` en lista y cae a COUNT en detalle) + `annotate` en
  `PhytoHeaderListView`. Sin migración (solo anotación). `manage.py check` limpio.
- [x] **FV.3 — Encuadre + mejoras visuales del `PhytoMap`.** (a) **Fix de encuadre**: `PhytoMap` solo
  usaba `initialViewState`; si el polígono de la parcela llegaba tras montar el mapa quedaba en la
  vista por defecto (zoom 6 sobre México). Se replicó el patrón de `AspersionMap` (`mapRef` +
  `useEffect` que hace `fitBounds` al cambiar `mapBounds`). (b) **Leyenda**: entrada verde "Baja / Sin
  monitorear" (estado base = relleno de parcela) + icono **(i)** con la interpretación de cada color.
  (c) **Relleno de parcela** más sólido (verde `#15803d`, opacidad 0.95). (d) Toggle **"Visualización"**:
  *Mapa de calor* (heatmap con `heatmap-radius` dependiente del zoom → la mancha escala como la
  parcela) vs *Discos* (círculos geográficos reales en metros, sin dependencias). (e) **Radio de mancha
  fijo 7.5 m** + **lector de superficie** en la leyenda: "Con problemas" vs "Baja / sin monitoreo" en
  **ha** y % sobre el área de la parcela (menos ambiguo que el % por conteo). (f) En modo mapa de calor
  las manchas se declaran **sobre** los puntos de datos.
- **Verificación:** `npm run typecheck` 0 errores, ESLint limpio, `npm run test` 216/216 (nuevo
  `PhytoSessionsPanel.test`), build OK.

---

## FASE RP — Reporte de aspersión: liga pública + PDF (rama `dev-report-public-pdf`, 2026-07-21)

**Estado:** `[✅] Implementada — rama dev-report-public-pdf.` Cierra `GAP-FR-RS-006` y el pendiente
`FR-RS.D3` (PDF). Coordinada con el backend (misma rama allá). Pendiente: validación manual del dev.

**Decisión que define el alcance del front:** el maquetado del reporte **no se rehace en React**.
El layout A4 vive en **un template Django** que sirve tanto la vista pública `/r/<uuid>` como el
PDF (WeasyPrint) — así no hay dos diseños que mantener sincronizados, y existe un endpoint real
de PDF (que `window.print()` no podría dar). Esto reduce el trabajo de front a tres piezas:
capturar el mapa, subir la firma y ofrecer los botones.

- [x] **RP-F1 — Spike de captura del canvas.** ⏸ **Pausa, va primero.** `AspersionMap` con
  `preserveDrawingBuffer: true` + `map.getCanvas().toDataURL('image/png')`. Si los tiles ESRI no
  responden con CORS, el canvas queda "manchado" y `toDataURL()` lanza `SecurityError` — eso
  tumbaría la captura en navegador (Opción A del prompt). **Resultado: descartado** — las tres
  fuentes de tiles de ESRI responden con `Access-Control-Allow-Origin: *`, verificado por HTTP.
- [x] **RP-F2 — Captura al publicar.** En `SessionReportPanel`, publicar implica: montar el mapa,
  esperar `idle`, capturar el canvas, `PATCH` multipart de `map_snapshot`, y sólo entonces marcar
  `publicado`. `preserveDrawingBuffer` se pasa **solo** en este contexto (degrada el rendimiento
  del visor si se deja siempre activo). El snapshot queda **congelado**: re-capturar = despublicar
  y volver a publicar.
- [x] **RP-F3 — Compartir liga + firma.** Botón "Copiar liga" visible sólo si `status ===
  'publicado'` (copia `${origin}/r/${report.id}`; revocar = despublicar) + entrada "Subir firma de
  Analista Agrícola" (`PATCH` multipart de `analyst_signature`). El nombre del analista sale de
  `created_by`, no es campo nuevo.
- [x] **RP-F4 — Descargar PDF.** Botón en la misma sección de Reporte contra el endpoint
  autenticado del backend.
- [x] **RP-F5 — Deploy + tests.** `location /r/` hacia el backend en `nginx.default.conf.template`
  (hoy sólo proxya `/api/` y `/media/`); Vitest sobre visibilidad del botón de compartir y la
  lógica de captura/subida; `typecheck` + ESLint limpios.
- **Nota de sincronía:** los colores del semáforo pasan a tener su fuente de verdad en el backend
  (`SEMAFORO_COLORS` en `report_adapters.py`), porque el PDF se renderiza server-side.
  `APPLICATION_CATEGORIES` en `aspersionLayers.ts` queda con un comentario cruzado apuntando allá.

---

## FASE V1F — Sesiones NDVI en el frontend: gestión + visor + catálogo de configuración (rama `dev-visor-ndvi`, 2026-07-28/29)

**Estado:** `[✅] Implementada — rama dev-visor-ndvi.` Replica el patrón de aspersión/fitosanitario
para el tipo de sesión NDVI que el backend expuso en su propia fase (V1 backend: header/points,
import CSV, catálogo `analytics_config`). Cubre el flujo pedido por el dev: crear sesión en un
subprograma → cargar CSV → abrir visor desde la sesión o desde "Visor de datos" → configurar cómo
se pintan las variables. Pendiente: validación manual del dev sobre datos reales en el entorno
final y homologación a `dev`/`master`.

- [x] **V1F-1 — Tipos + gestión de sesiones.** Tipos OpenAPI regenerados. `CreateSessionDialog`
  gana tercer tipo "Índices vegetativos" (`NdviForm`, sin evaluación). `NdviImportDialog` sin
  plantillas (mapeo automático en backend, incluye acentos). `NdviSesionModal` **dedicado**, no una
  rama dentro de `SesionModal` (1077 líneas acopladas a aspersión/fito) — NDVI no usa evaluación,
  variable-stats ni reporteador.
- [x] **V1F-2 — Visibilidad en árbol y visor (bugs cerrados en vivo).** Las sesiones NDVI no
  aparecían en el árbol Gantt del task-manager (`GanttHierarchy` tenía el agregado de
  aspersión/fito hardcodeado) ni en la tarjeta de sesiones del visor a nivel parcela (faltaba
  `NdviSessionsPanel`). Ambos corregidos.
- [x] **V1F-3 — Visor: superficie interpolada (4 iteraciones con el dev sobre resultados reales).**
  Descartados en orden: contornos precomputados del backend (erráticos) → puntos con blur/radio por
  zoom (seguían viéndose separados) → superficie IDW recortada al polígono completo de la parcela
  (manchas por extrapolación fuera del área con datos). Solución: recorte al **casco convexo de los
  puntos** + mapeo de color por **rango percentil** (ecualización de histograma, no lineal) +
  **kriging ordinario** (`lib/kriging.ts`, variograma exponencial) como motor final. Medido con
  toggle Kriging/IDW: diferencia visual **nula** con los datos reales — se investigó y se confirmó
  que el CSV es una rejilla regular de ~10 m rotada, no un muestreo disperso; a esa densidad ambos
  motores convergen. Se fijó kriging, IDW queda de fallback interno. Motor aislado (`predictAt`)
  para no repetir el costo de re-evaluar.
- [x] **V1F-4 — Catálogo de definición de variables.** `NdviVariablesSection`
  (`/admin/config-variables`, rol Gerente): por cada una de las 15 variables, modo Automático
  (cuartiles) o Manual (editor de intervalos Vmin–x1..xn–Vmax, etiqueta, color hex). El visor
  consume la config: bandas del especialista en modo manual, gradiente ecualizado en automático,
  fallback silencioso si el usuario no tiene permiso de lectura (403).

**Gap conocido (para la siguiente fase, ver `gap_log.csv`):** el visor lee la config del **tenant
del usuario logueado**, no del **tenant dueño de la parcela** que se está viendo. Un técnico en una
parcela ajena no hereda los umbrales de esa organización. Requiere ajuste backend: resolver tenant
por parcela (no por usuario) + relajar el permiso de lectura de la config.

**Nota técnica para retomar si la resolución visual se vuelve limitante:** el techo real de detalle
es la separación de la rejilla de puntos del CSV origen (~10 m); ninguna interpolación —incluido
kriging— recupera variación más fina que eso. El salto de fidelidad, si hiciera falta, vendría de
ingerir a mayor resolución (o el GeoTIFF original), no de cambiar de algoritmo.

**Verificación:** `npm run typecheck` 0 errores; ESLint limpio en archivos NDVI (persisten warnings
preexistentes de `react-refresh` ajenos a esta fase); `npm run test` 218/218 (el único "error" de
vitest es `maplibre-gl` en jsdom dentro de `SessionReportPanel.test.tsx`, preexistente).

---

## FASE AS — Búsqueda avanzada en el explorador del Visor de Datos (rama `dev-visor-advanced-search`, 2026-08-10)

**Estado:** `[✅] Implementada y VALIDADA — 2026-08-10 — rama dev-visor-advanced-search`. Prueba manual del desarrollador positiva. Pendiente: homologación a dev y master. Caso de uso
`.context/usecases/use-case-advanced-filters-visor-datos-explorer.md`: botón de lupa en el
encabezado del explorador que abre un modal (rango de fechas, organización, productor, rancho,
parcela, tipo) y actualiza el propio panel izquierdo con el árbol de coincidencias ya expandido,
más el mapa encuadrando todas las parcelas involucradas. Lupa tachada = limpiar. Solo lectura.

Consume el endpoint agregador `GET /monitoring/sessions/advanced-search/` (fase AS del backend), que
devuelve la jerarquía productor → rancho → parcela → sesiones de los **cuatro** tipos ya armada. La
búsqueda se persiste en la URL con `validateSearch` de zod, copiando el patrón ya existente en
`routes/w.$dc.task-manager.tsx`.

- [x] **AS-6** `validateSearch` (zod) en `routes/visor-datos.tsx`: `from`, `to`, `dateMode`, `org`,
      `producers`, `ranches`, `plots`, `types`. `.catch(undefined)` para ignorar valores inválidos.
- [x] **AS-7** `useAdvancedSessionSearch` + tipos del árbol de resultados (reusa `SessionKind`).
- [x] **AS-8** `MultiSelectSearch`: buscador con debounce contra `?search=` + selección múltiple.
      Sin librería nueva (no hay combobox en `components/ui/`).
- [x] **AS-9** `AdvancedSearchModal` sobre `dialog.tsx`, con la cascada productor → rancho → parcela.
- [x] **AS-10** Botón lupa / lupa tachada en `GeodataVisorShell` y reparto de criterios a ambos paneles.
- [x] **AS-11** Modo resultados de `GeodataExplorer` (árbol de la API, expandido, reusando `TreeRow`).
      El modo perezoso actual queda intacto cuando no hay búsqueda.
- [x] **AS-12** Mapa multiparcela con ajuste dinámico (extiende `boundsOf` de `RanchPlotsMap`) y
      paneles de sesión acotados a la búsqueda.
- [x] **AS-13** Vitest + `tsc --noEmit` + guion de pruebas manuales.

**Trampa a respetar:** el visor vive fuera de `/w/$dc`; el ámbito NDVI viaja por prop
(`tenantId={selection.org.id}`), nunca por `useParams`. El árbol de resultados debe seguir
emitiendo `org` en cada `VisorSelection` (ver `.CLAUDE/visor-contours-tenant-progress.md`).

---

## FASE KM — Exportar KML del reporte + traer el clima del día (rama `dev-report-kml`, 2026-08-18)

**Estado:** `[🔄] Implementada — pendiente prueba manual del desarrollador en Google Earth`.
Dos botones nuevos en el reporte de sesión. El backend de esta fase se registra en
`../CIAgro_alpha_back/logs/roadmap.md` (KM-1 a KM-8).

- [x] **KM-9** `useDownloadReportKmz` en `hooks/useReportAssets.ts`. Calca `useOpenReportPdf` porque
      el endpoint es autenticado y no se puede enlazar la URL directo (no llevaría el Bearer): se
      baja como blob y se dispara la descarga desde memoria. **Siempre descarga**, nunca abre
      pestaña — un KMZ mostrado en el navegador no sirve de nada — y por eso tampoco necesita el
      baile con el bloqueador de popups que sí hace el PDF.
- [x] **KM-10** Botón "Exportar KML" en `ReportDeliverables.tsx`, junto a "Ver PDF". **Sin** el
      `disabled` por `hasMap`: esa condición es del PDF, el KMZ no depende de la captura del mapa.
- [x] **KM-11** Clima en `ReportForm.tsx`: hook `useReportWeather`, dos campos nuevos (mínima y
      máxima) y botón "Traer clima del día de aplicación" con degradado cielo→ámbar e icono
      `CloudSun`. El botón **rellena el formulario con `setValue`, no guarda**: el analista ve el
      valor antes de persistirlo y lo puede corregir, y así funciona igual en un reporte publicado.
      `available: false` (POWER va 4-5 días atrás) se avisa con `toast.info`, no como error.
- [x] **KM-12** Tests (`ReportForm.test.tsx` nuevo + `sessionReport.test.ts` ampliado) y
      `npm run types:gen`. 387 tests en 67 archivos, `tsc --noEmit` limpio.

**Trampas encontradas:**

1. **`step="0.1"` rompía el guardado.** El navegador exige que el valor sea múltiplo del `step`, y
   POWER devuelve dos decimales (12.04, 30.84): eso es un *stepMismatch*, y su mensaje nativo en
   español es "Introduce un valor válido", que no dice cuál es el problema y no se puede traducir.
   Se pasa a `step="any"` y la regla vive en zod con mensaje propio. Decisión del dev: las
   temperaturas se acotan a **grados enteros**; la columna sigue siendo `decimal(5,2)`, así que
   volver a decimales es quitar el redondeo, sin migración.
2. **Coma decimal.** El `input type="number"` pinta el valor con el separador del locale (en es-MX,
   19.94 se ve "19,94") y algunos navegadores dejan teclearla. `Number("19,94")` es `NaN`, así que
   un valor correcto se rechazaría como inválido: se normaliza a punto al validar y al enviar.
3. **Acoplamiento del test del panel.** Al meter un hook nuevo en `ReportForm`, `SessionReportPanel.test.tsx`
   se rompió por falta de `QueryClient`, porque renderiza el formulario. Todo hook nuevo del
   formulario hay que mockearlo también ahí.

---

## FASES FRONTEND 3–10 · MÓDULOS RESTANTES
**Estado:** `[ ] Pendientes — UX/UI por pulir`

> Las siguientes fases tienen backend listo (✅ 100% testeado) pero la
> especificación UX detallada se está terminando de definir. Pueden empezarse
> en paralelo a Fase 2 si hay capacidad.

### Fase Frontend 3 · Visor de sesiones (Módulo 4)
**Sprints:** 1.5 dev-weeks. **Backend:** ✅. **UX:** 🔄 por pulir.
- Lista paginada de sesiones con filtros por status/técnico/parcela.
- Detalle de sesión (panel reutilizable con Fase 2).
- Endpoints: `GET /monitoring/aspersion/headers/`, `GET /monitoring/phyto/headers/`.

### Fase Frontend 4 · Visor de mapas (Módulo 3)
**Sprints:** 2 dev-weeks. **Backend:** ✅. **UX:** 🔄 por pulir (heatmap+capas).
- Mapa principal con polígonos de parcelas (MapLibre GL + GeoJSON).
- Capas conmutables: parcelas, monitoreos, heatmap de aspersiones.
- Endpoints: `GET /geo_assets/plots/`, `GET /monitoring/points/heatmap/`.

### Fase Frontend 5 · Vista del Técnico (Flujo 3)
**Sprints:** 1 dev-week. **Backend:** ✅. **UX:** 🔄 por pulir.
- Lista de sesiones del día asignadas al técnico (filtro implícito por scope).
- Carga CSV simplificada (reutiliza Sprint 2.D).
- Pensado para tablet/móvil — revisar responsive de shadcn.

### Fase Frontend 6 · Central de datos (Módulo 5)
**Sprints:** 2.5 dev-weeks. **Backend:** ✅. **UX:** 🔄 por definir gráficos.
- Dashboard de históricos: gráficos de aspersión por mes/cultivo/parcela.
- Decisión pendiente: librería de charts (Recharts vs Visx vs Tremor) — abrir en Fase 6 inicio.
- Endpoints: `GET /monitoring/headers/`, `GET /monitoring/aspersion/headers/<uuid>/stats/`.

### Fase Frontend 7 · Catálogos (Módulo 6)
**Sprints:** 2 dev-weeks. **Backend:** ✅. **UX:** 🔄 por pulir.
- CRUD de AgroUnit, Ranch, Plot, Crop, Phytosanitary, Evaluation.
- Edición de polígonos de Plot con `maplibre-gl-draw` (futuro).
- Patrón "DataTable shadcn" + dialog de edición compartido entre catálogos.

### Fase Frontend 8 · Administración (Módulo 7)
**Sprints:** 2 dev-weeks. **Backend:** ✅. **UX:** 🔄 por pulir invitación/activación.
**Sub-fases completadas:**
- [✅] **Admin Fase 1** (Sesión 8, 2026-05-18): Gestión de Users, UserAssignments, activación de usuarios pending.
- [✅] **Admin Fase 2** (Sesión 9, 2026-05-19): AgroUnidades, AgroSectores, Contactos y ContactAssignments.
  - `AgroUnitsSection` con 2 tabs (Unidades / Sectores), `AgroUnitPanel` (view+edit+contactos).
  - `CreateSectorDialog`, `CreateAgroUnitDialog`, `CreateContactDialog`.
  - Hooks: `useAgroSectors`, `useAgroUnits`, `useContacts`. 85/85 tests Vitest.
- [✅] **Admin Fase 3** (Sesión 10, 2026-05-19): Organizaciones, DataCentrals y Asignaciones.
  - `OrganizationsSection`, `DataCentralMainPanel`, `DataCentralPanel`. Componente `AssignCombobox` reutilizable.
  - Hooks: `useDataCentrals`, `useUserAssignments`, `useDataCentralAssignments`. 91/91 tests Vitest.
- [✅] **Admin Fase 4** (Sesión 11, 2026-05-20): Catálogos Agrícolas (Cultivos y Fitosanitarios).
  - `CatalogsSection`, `CropPanel`, `PhytosanitaryPanel`. Primer uso de `FormData` multipart para fotos.
  - Hooks: `useCrops`, `usePhytosanitary`. 99/99 tests Vitest.
- [✅] **Admin Fase 5** (Sesión 13, 2026-05-21): Activos Agrícolas — Ranchos, Parcelas y Aliados.
  - `AssetsSection`, `RanchPanel` (tabs Detalle/Parcelas/Aliados), `PlotPanel` (tabs Detalle/Mapa/Vértices).
  - `RanchFormDialog` (cascada País→Estado), `PlotFormDialog`, `PlotVerticesImport`.
  - Hooks: `useRanches`, `usePlots`, `useRanchPartners`, `useProducers`. GeoJSON FeatureCollection aplanado en hooks.
  - Permisos: Gerente (rol ≥4) → crear/editar/importar vértices dentro de su scope; Admin (rol 5) → eliminar.
  - Backend: 4 ajustes de permisos en `geo_assets/views.py` + 5 tests nuevos (44/44). 109/109 vitest, tsc 0 errores.
**Pendiente:** invitación de nuevos usuarios, activación por email (UX por pulir).

### Fase Frontend 9 · Onboarding wizard (primer SuperAdmin)
**Sprints:** 1.5 dev-weeks. **Backend:** ✅ (`/onboarding/`). **UX:** 🔄 por pulir.
- Wizard paso a paso para configurar Tenant + DataCentralMain + DataCentral inicial.
- Open question (sección 9 product-doc): ¿interrumpible y reanudable? (backend hoy es atómico).

### Fase Frontend 10 · Dashboard inicial + métricas
**Sprints:** 1.5 dev-weeks. **Backend:** ✅ endpoints existen. **UX:** 🔄 por definir layout.
- Widgets: parcelas activas, tareas pendientes, último monitoreo, mapa resumen.
- Decisión pendiente: layout grid (react-grid-layout vs custom CSS Grid).

---

## ORDEN RECOMENDADO DE EJECUCIÓN

```
✅ Fase 0      → Stack + scaffolding (Sesión 1, 2026-05-12)
✅ Fase 1      → Auth + workspace selector (Sesión 2, 2026-05-13)
✅ Fase 8.1    → Admin: Usuarios (Sesión 8, 2026-05-18)
✅ Fase 8.2    → Admin: Agrounidades + Sectores + Contactos (Sesión 9, 2026-05-19)
✅ Fase 8.3    → Admin: Organizaciones / DataCentrals (Sesión 10, 2026-05-19)
✅ Fase 8.4    → Admin: Catálogos Agrícolas (Sesión 11, 2026-05-20)
✅ Fase 8.5    → Admin: Activos Agrícolas (Sesión 13, 2026-05-21)
✅ Sesión 14   → Task Manager Aspersión: importación CSV + homologador + plantillas + resumen; mejoras subprograma/parcela; bug fixes scope/owner-gerente/layout (2026-05-25)
🔄 Sesión 15   → Visor de capas de aspersión — implementado (6.B–6.E), pendiente demo manual (2026-05-25)
🔄 Sesión 17   → Visor de Datos Agrícolas (Fase 7 fr.) — 7.B–7.E implementado + 4 fixes auth Fase 1 (refresh-on-load, rotación, user preload, cross-tab logout), pendiente demo manual (2026-05-28)
🔒 Fase 2      → Task Manager Gantt (4 dev-weeks, depende de Fase 1)
🔒 Fase 3      → Visor de sesiones (1.5 dw)         ┐ pueden correr en paralelo
🔒 Fase 4      → Visor de mapas (2 dw)              │ a Fase 2 cierre o entre sí,
🔒 Fase 5      → Vista Técnico (1 dw)               │ según prioridad de producto
🔒 Fase 6      → Central de datos (2.5 dw)          │
🔒 Fase 7      → Catálogos (2 dw)                   │
🔒 Fase 8.6    → Admin: Onboarding / Invitaciones (pendiente UX) │
🔒 Fase 9      → Onboarding wizard (1.5 dw)         │
🔒 Fase 10     → Dashboard + métricas (1.5 dw)      ┘
```

**Total estimado:** ~22 dev-weeks frontend (~5 meses con 1 dev senior full-time).

**Dependencias críticas:**
- Fase 1 bloquea todas las siguientes (es el ingreso a la app).
- Fase 2 requiere Fase 1 cerrada (`datacentral_id` persistido en URL + cliente HTTP estable).
- Fases 3–10 pueden correr en paralelo entre sí una vez Fase 1 cerrada.
- GAP-BACKEND-001 (seed) bloquea Fase 1 entera.

---

## FASE PS: SCOPE POR PARCELA — FRONTEND
**Estado:** `[✅] Implementada y VALIDADA manualmente — rama dev-plot-scope, 2026-08-21; pendiente homologación`

Contraparte de la fase PS del backend (ver `../../CIAgro_alpha_back/logs/roadmap.md`, PS-0 a PS-7,
ya completos). El backend ya resuelve el alcance con dos granos: la CIAgro y, opcionalmente,
parcelas concretas dentro de ella.

- [x] **PS-8** Hooks compartidos: paginacion real en `useProducers`/`useRanches`/`usePlots` + filtro `producer_in`
- [x] **PS-9** Modal de alcance en `DataCentralPanel`, pestaña Usuarios
- [x] **PS-10** Poda de ramas vacias en el explorador del Visor

**PS-8 — por que era necesario antes del modal.** Los tres hooks leian `data.results` y se
quedaban con la PRIMERA pagina, descartando el resto sin ningun aviso. `StandardPagination` sirve
100 por pagina (maximo 1000), asi que una CIAgro con mas de 100 parcelas mostraba un selector
recortado en silencio. En un arbol de navegacion eso es un nodo que falta; en un selector de
permisos son parcelas que el gerente cree haber asignado y no asigno. Se resolvio con
`src/lib/api/paginated.ts`: pide de golpe el maximo que el backend admite y solo encadena mas
paginas si el `count` dice que faltan, asi que en la practica es UNA peticion salvo en los casos
grandes de verdad.

Los tres hooks alimentan **los dos** casos de uso —el selector del modal y el explorador del
Visor—, por eso se extienden una sola vez antes de tocar ninguna pantalla.

**Endpoints que consume el modal (ya disponibles):**

```
GET  /api/v1/users/assignments/<id>/scope/          modo actual + parcelas con sus ancestros
PUT  /api/v1/users/assignments/<id>/scope/          { access_mode, plot_ids[] } idempotente
GET  /api/v1/organizations/?datacentral=<id>        productores de la CIAgro
GET  /api/v1/geo_assets/plots/?producer_in=<csv>    sus parcelas, para el selector
```

**Aviso para el modal (PS-9):** hay CIAgros con productores pero sin ninguna parcela
(`CIA-ejemplo-01` en la base de desarrollo tiene 5 productores y 0 parcelas). El selector debe
distinguir "no hay parcelas que asignar" de "todavia cargando" o de un fallo, o parecera roto.

---

## FASE NV: EL VISOR COMO PANTALLA PRINCIPAL Y NAVEGACION EN PESTAÑA
**Estado:** `[✅] Implementada y VALIDADA por el dev — ramas dev-plot-scope y dev-nav-entrada, 2026-08-21`

Es el hallazgo **H9** del analisis de la fase PS ("rediseño de navegacion, sesion aparte"), que el
desarrollador decidio hacer en la misma rama. Se dejo en commits separados para poder revertir uno
sin el otro.

- [x] **NV-1** El Visor como entrada de una CIAgro (`/w/$dc/visor`)
- [x] **NV-2** Poligonos de las parcelas bajo los pines a nivel de productor
- [x] **NV-3** Navegacion en pestaña desplegable y Visor a sangre completa
- [x] **NV-4** Barra superior sin atajos duplicados y un solo Visor
- [x] **NV-5** Raiz del explorador segun el alcance del usuario
- [x] **NV-6** Icono de silos para las CIAgros hijas
- [x] **NV-7** El login entra al Visor; el selector solo para el Task Manager
- [x] **NV-8** Etiqueta de CIAgro activa solo en el Task Manager
- [x] **NV-9** Migas de pan navegables en el panel del Visor

**Decisiones que conviene no reabrir sin releer el porque:**

0. **El login entra al Visor, no al selector.** Toda la decision de arranque vive en un
   despachador en el `beforeLoad` de `/visor-datos`: sin CIAgros va a `/workspaces` (wizard o
   sin acceso), con una entra directo a la suya, con varias se queda en el Visor. El selector
   sobrevive SOLO en el camino del Task Manager, cuyos datos si son de una CIAgro concreta.

1. **El Visor esta abierto a TODOS los roles** dentro de su CIAgro. Exigia Supervisor (3), pero
   mandar a todos al Visor al entrar dejaba a Guest y Tecnico en un bucle de redireccion. Es ademas
   coherente con el caso de uso 2 de la fase PS: el usuario delimitado es un tecnico y el explorador
   se diseño para el. El alcance por parcela limita lo que cada uno ve.
2. **Un solo Visor.** `/visor-datos` redirige: era la MISMA pantalla, porque el arbol lista todas
   las organizaciones alcanzables en cualquier caso. La ruta se conserva redirigiendo para no romper
   las busquedas avanzadas compartidas, que viven en la URL.
3. **La raiz del explorador colapsa los niveles con un solo hijo**, deteniendose en agrounidad, y
   cuenta lo que el usuario REALMENTE ve, no sus filas de asignacion.
4. **Los colores por rancho van en orden fijo y no se ciclan**: el septimo rancho cae a un gris
   neutro. Repetir el primer color haria creer que dos ranchos son el mismo.

**Trampas encontradas:**

- El shell del Visor imponia `h-dvh` y dentro del layout cuelga bajo una cabecera de 64px: se
  desbordaba exactamente esos pixeles y sacaba un scroll. Cada contenedor define el alto.
- Los tests existentes no tocan el store de autenticacion, asi que la regla de colapso "paso" sin
  ejercitarse. Verificado por mutacion.
- El fixture de `GeodataExplorer.test.tsx` mockeaba ranchos sin `producer` y parcelas sin `ranch`,
  campos que la API real si devuelve.
- **Cambiar el destino de una navegacion exige buscar TODAS las llamadas.** Habia tres puertas al
  selector —`useLogin`, `useChangePassword` y un boton del propio Visor— y cambiar la ruta raiz
  no bastaba. Lo detecto la prueba manual; ni los tipos ni los tests ven que falte una.
- **Al subir por las migas hay que descartar los descendientes**, o el panel muestra los datos de
  un nivel con el titulo de otro.

39 tests nuevos. Suite: 83 archivos, 468 tests.

---

## FASE SL: CARGA POR CAPA DEL MAPA DE SUELO — FRONTEND (PENDIENTE DE PLANEAR)

**Estado:** `[x] Implementada (2026-08-25). Medido de punta a punta: 55.73 s -> ~3.7 s y 22.87 MB -> 2.91 MB. Pendiente validacion manual del dev en el navegador.`

El backend cerro la FASE SL en `CIAgro_alpha_back` (rama `dev-soilmap-layer-load`, 2026-08-24): el
endpoint de puntos de suelo acepta `?fields=` y existe un endpoint de estadisticas por variable.
**Nada de eso se nota todavia**, porque el bucle que provoca la sobrecarga vive aqui, en
`useSoilMapPoints.ts`. Contrato y trampas completas en `.CLAUDE/soilmap-load-optimization-progress.md`.

**El problema, MEDIDO EN NAVEGADOR contra la sesion real de 16,944 puntos (2026-08-25):** abrir una
sesion de Mapeo de Suelo dispara **9 peticiones encadenadas de 4 a 7 segundos cada una** — los 57
campos de cada punto, 22.83 MB — con la UI en "cargando puntos" **entre 36 y 63 segundos** antes de
que aparezca un solo punto, todo para pintar **una** de las **49** capas del catalogo.

No es la red: se midio en localhost. Son 4-7 s de CPU del servidor armando 2.8 MB de JSON por
pagina. La misma pagina con `fields=id,geom` tarda **0.373 s**, once veces menos.

| | Hoy | Con el contrato nuevo |
|---|---|---|
| Por pagina | 4-7 s | 0.373 s |
| 9 paginas en serie | **36-63 s** | ~3.4 s |
| 9 paginas en paralelo | — | **~1 s** |

Total proyectado hasta la primera capa pintada: **2-4 s en serie, ~1.5 s paralelizando**, contra los
36-63 s de hoy. Payload: **2.90 MB contra 22.83 MB (-87.3%)**.

- [x] **SL-F0** Backend: `text_variables` en `/variable-stats/` para que las 3 capas categoricas no
      desaparezcan del combobox (conteo que excluye cadenas vacias, no solo nulos)
- [x] **SL-F1** `fetchAllSoilMapPoints` pide `fields=id,geom` y calcula las paginas desde `count`.
      **Las paginas quedaron EN SERIE, contra lo planeado:** se implemento en paralelo y la medicion
      lo desmintio — 3.1 s en serie contra 4.7 s en paralelo. En desarrollo corre `runserver` (un
      proceso con GIL) y en produccion son 3 workers de gunicorn, asi que 8 peticiones simultaneas
      los ocuparian todos. La ganancia venia de `?fields=`, no de la concurrencia
- [x] **SL-F2** `useSoilMapLayerValues`: `fields=id,<campo>` sin repetir `geom`, union por `id`,
      cacheado 5 min por react-query
- [x] **SL-F3** `layerCounts` sustituido por el `count` por variable de `/variable-stats/`
- [x] **SL-F4** `SoilMapPointGeom` como tipo estrecho local; `api.d.ts` no se relaja
- [x] **SL-F5** Medido de punta a punta: **55.73 s -> ~3.7 s**, **22.87 MB -> 2.91 MB**

**RESUELTO EN SL-W (2026-08-25), despues de que el desarrollador lo reportara al probar SL-F:** la
interpolacion se movio a un Web Worker (el primero del proyecto) y se cacheo por capa. La aplicacion
ya no se congela: el calculo sigue tardando 1-3 s pero corre en otro hilo, y volver a una capa ya
vista es inmediato. Nota importante para quien retome el tema: un bloqueo del hilo principal NO
tiene alcance parcial —o bloquea todo o no bloquea nada—, asi que "congelar solo el visor" no era
posible; lo que se logro es que no se congele nada. Lo que sigue pendiente si algun dia estorba es
REDUCIR los 1-3 s, y para eso habria que bajar la malla de 260x260, que altera cortes y colores
validados con el proveedor.

**Contexto original del gap:** el tiron al **cambiar de capa** no lo
arregla nada de esto. Es `analyzeSoilSurface`, que **no dibuja nada**: simula un raster de 260x260
celdas para sacar los cortes de la leyenda y las hectareas por rango de `SoilMapStatsCard`, corre
**sincrono dentro de un `useMemo`** y por eso congela la pestaña. **Medido en navegador: 1-3 s**
(una estimacion previa en Node dio 773 ms y se quedo corta por un factor de 2 a 4; no repriorizar
con mediciones tomadas fuera del entorno real).

Son dos cuellos distintos y esta fase ataca el que pesa. Cambiar de capa **no mejora ni empeora**
de forma perceptible con SL-F: la descarga de una capa suelta son decimas de segundo contra 1-3 s
de interpolacion que dominan igual. Se ataca como fase propia DESPUES de medir SL-F. Ver
`GAP-SUELO-001`.

**El intercambio, dicho completo:** hoy cambiar de capa cuesta 0 bytes porque todo esta en memoria;
con este diseño cuesta 1.03 MB, cacheado. Conviene mientras se miren menos de ~20 capas por sesion.
Con 3-8, que es lo realista, gana ampliamente.

---

## GAPS ABIERTOS A LA FECHA (ver `gap_log.csv` para detalle)

| ID | Categoría | Prioridad | Disparador para resolver |
|---|---|---|---|
| `GAP-BACKEND-001` | backend | **alta** | Bloqueante de Fase 1 — pedir al equipo backend en próxima sesión |
| `GAP-FUTURO-001` | seguridad | media | Cuando frontend y backend compartan dominio |
| `GAP-RIESGO-001` | arquitectura | media | Final de Sprint 2.C — re-evaluar gantt-task-react |
| `GAP-FUTURO-002` | producto | baja | Cuando aparezca requisito real de multi-idioma |
| `GAP-INFRA-001` | infra | baja | Cuando tráfico se acerque a 100k tile loads/mes |
| `GAP-INFRA-002` | infra | baja | Si los olvidos de regenerar tipos generan bugs frecuentes |
