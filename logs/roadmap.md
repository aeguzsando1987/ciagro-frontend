# ROADMAP — CIAgro Alpha Frontend

> **Estado actual:** Fase 0 (Selección de stack y scaffolding) — 17/17 pasos completados.
> **Última actualización:** 2026-05-12
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
- Gestión de Users (level 4+).
- UserAssignments (asignar usuarios a DataCentrals).
- Activación de usuarios pending (`/users/pending/`, `/users/<uuid>/activate/`).

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
🔒 Fase 2      → Task Manager Gantt (4 dev-weeks, depende de Fase 1)
🔒 Fase 3      → Visor de sesiones (1.5 dw)         ┐ pueden correr en paralelo
🔒 Fase 4      → Visor de mapas (2 dw)              │ a Fase 2 cierre o entre sí,
🔒 Fase 5      → Vista Técnico (1 dw)               │ según prioridad de producto
🔒 Fase 6      → Central de datos (2.5 dw)          │
🔒 Fase 7      → Catálogos (2 dw)                   │
🔒 Fase 8      → Administración (2 dw)              │
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
