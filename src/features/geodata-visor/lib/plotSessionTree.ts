import type { SessionKind } from '../types'

/**
 * Arbol de sesiones de una parcela (FASE CV): Generales (mapeos > año > sesiones) + un nodo
 * por temporada del subprograma (tipo > sesiones). Sin nodos vacios.
 * Lo comparten el explorador, la busqueda avanzada y el modal de subprograma.
 */

export interface TreeSession {
  id: string
  kind: SessionKind
  /** Fecha canonica del tipo (ISO yyyy-mm-dd) o null. */
  date: string | null
  points_count: number
  /** `Programa.cycle`; null o vacio = sin temporada. */
  cycle: string | null
}

export interface YearGroup {
  key: string
  label: string
  sessions: TreeSession[]
}

export interface TypeGroup {
  key: string
  kind: SessionKind
  label: string
  sessions: TreeSession[]
}

export interface CycleGroup {
  key: string
  label: string
  types: TypeGroup[]
}

export interface PlotTree {
  generales: YearGroup[]
  cycles: CycleGroup[]
}

export const GENERALES_LABEL = 'Generales'
export const NO_CYCLE_LABEL = 'Sin ciclo'
const CYCLE_PREFIX = 'Ciclo productivo'
const NO_DATE_LABEL = 'Sin fecha'

/** Orden fijo de los tipos dentro de un ciclo. Mapeo de suelo va aparte, en Generales. */
const CYCLE_KINDS: SessionKind[] = ['ndvi', 'aspersion', 'phyto', 'planting_map', 'yield_map']

export const TYPE_LABELS: Record<SessionKind, string> = {
  soil_map: GENERALES_LABEL,
  ndvi: 'Seguimiento a campo',
  aspersion: 'Aplicaciones',
  phyto: 'Fitosanitario',
  planting_map: 'Siembra',
  yield_map: 'Rendimiento',
}

/** El año solo agrupa en Generales: un ciclo productivo ya acota la temporada. */
const GENERALES_YEAR_LABEL = 'Mapeos'

/** Fecha desc, sin fecha al final. */
function byDateDesc(a: TreeSession, b: TreeSession): number {
  if (a.date === b.date) return 0
  if (a.date === null) return 1
  if (b.date === null) return -1
  return b.date.localeCompare(a.date)
}

function latestDate(sessions: TreeSession[]): string | null {
  return sessions.reduce<string | null>(
    (max, s) => (s.date !== null && (max === null || s.date > max) ? s.date : max),
    null,
  )
}

/** "Primavera-Verano-2026" -> "Ciclo productivo Primavera-Verano 2026". */
export function cycleLabel(cycle: string | null): string {
  if (!cycle) return NO_CYCLE_LABEL
  return `${CYCLE_PREFIX} ${cycle.replace(/-(\d{4})$/, ' $1')}`
}

function normalizedCycle(cycle: string | null): string | null {
  const trimmed = cycle?.trim()
  return trimmed ? trimmed : null
}

function buildYears(sessions: TreeSession[], parentKey: string): YearGroup[] {
  const byYear = new Map<string | null, TreeSession[]>()
  for (const s of sessions) {
    const year = s.date ? s.date.slice(0, 4) : null
    byYear.set(year, [...(byYear.get(year) ?? []), s])
  }
  return [...byYear.entries()]
    .sort(([a], [b]) => (a === null ? 1 : b === null ? -1 : b.localeCompare(a)))
    .map(([year, list]) => ({
      key: `${parentKey}/${year ?? 'sin-fecha'}`,
      label: `${GENERALES_YEAR_LABEL} (${year ?? NO_DATE_LABEL})`,
      sessions: [...list].sort(byDateDesc),
    }))
}

function buildTypes(sessions: TreeSession[], parentKey: string): TypeGroup[] {
  return CYCLE_KINDS.flatMap((kind) => {
    const list = sessions.filter((s) => s.kind === kind)
    if (list.length === 0) return []
    const key = `${parentKey}/${kind}`
    return [{ key, kind, label: TYPE_LABELS[kind], sessions: [...list].sort(byDateDesc) }]
  })
}

function buildGenerales(sessions: TreeSession[]): YearGroup[] {
  return buildYears(sessions.filter((s) => s.kind === 'soil_map'), 'generales')
}

/** Arbol del Visor: Generales + ciclos (por sesion mas reciente, "Sin ciclo" al final). */
export function buildPlotTree(sessions: TreeSession[]): PlotTree {
  const byCycle = new Map<string | null, TreeSession[]>()
  for (const s of sessions) {
    if (s.kind === 'soil_map') continue
    const cycle = normalizedCycle(s.cycle)
    byCycle.set(cycle, [...(byCycle.get(cycle) ?? []), s])
  }

  const cycles = [...byCycle.entries()]
    .map(([cycle, list]) => ({ cycle, list, latest: latestDate(list) }))
    .sort((a, b) => {
      if (a.cycle === null) return 1
      if (b.cycle === null) return -1
      if (a.latest === b.latest) return a.cycle.localeCompare(b.cycle)
      if (a.latest === null) return 1
      if (b.latest === null) return -1
      return b.latest.localeCompare(a.latest)
    })
    .map(({ cycle, list }) => {
      const key = `ciclo:${cycle ?? 'sin-ciclo'}`
      return { key, label: cycleLabel(cycle), types: buildTypes(list, key) }
    })

  return { generales: buildGenerales(sessions), cycles }
}

/** Arbol del modal de subprograma: es un solo ciclo, asi que va sin ese nivel. */
export function buildProgramTree(sessions: TreeSession[]): { generales: YearGroup[]; types: TypeGroup[] } {
  return { generales: buildGenerales(sessions), types: buildTypes(sessions, 'programa') }
}

/** Ids de sesion bajo un nodo; sirve para abrir la rama de la sesion seleccionada. */
export function sessionIdsOf(node: YearGroup | TypeGroup | CycleGroup): Set<string> {
  if ('sessions' in node) return new Set(node.sessions.map((s) => s.id))
  return new Set(node.types.flatMap((type) => type.sessions.map((s) => s.id)))
}
