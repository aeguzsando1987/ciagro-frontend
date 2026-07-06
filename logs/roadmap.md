# ROADMAP — CIAgro Alpha Frontend

> **Estado actual:** Sesión 18 — Tanda de mejoras de producto: wizard de primer uso convertido en mini-tutorial (org → CIAgros → productores → asignaciones → info usuarios) con animación; UX de Administración (banners de asignación, labels "Dueño de organización"/"Código o nombre", combobox inline + transición de tamaño); visor con mapa de ranchos por productor (pines) y toolbar flotante; fix Manager dueño de org sin CIAs (no más NoAccessScreen); organizaciones inactivas deshabilitadas en selector/visor con guard de expulsión en caliente. Apoyado en cambios de backend Sesión 18.
> **Última actualización:** 2026-06-03
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

## GAPS ABIERTOS A LA FECHA (ver `gap_log.csv` para detalle)

| ID | Categoría | Prioridad | Disparador para resolver |
|---|---|---|---|
| `GAP-BACKEND-001` | backend | **alta** | Bloqueante de Fase 1 — pedir al equipo backend en próxima sesión |
| `GAP-FUTURO-001` | seguridad | media | Cuando frontend y backend compartan dominio |
| `GAP-RIESGO-001` | arquitectura | media | Final de Sprint 2.C — re-evaluar gantt-task-react |
| `GAP-FUTURO-002` | producto | baja | Cuando aparezca requisito real de multi-idioma |
| `GAP-INFRA-001` | infra | baja | Cuando tráfico se acerque a 100k tile loads/mes |
| `GAP-INFRA-002` | infra | baja | Si los olvidos de regenerar tipos generan bugs frecuentes |
