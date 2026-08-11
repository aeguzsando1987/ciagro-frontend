/**
 * Criterios de la búsqueda avanzada del Visor (fase AS).
 *
 * Viven en la URL para que una búsqueda sea compartible y sobreviva al refresh, igual
 * que los filtros del Gantt (`routes/w.$dc.task-manager.tsx`). Aquí está toda la
 * conversión entre las tres representaciones que necesita el feature:
 *
 *   search params (CSV en la URL)  ⇄  criterios (arrays, para la UI)  →  query de API
 *
 * Es lógica pura a propósito: es donde se cuelan los errores sutiles (un array vacío
 * que se serializa como cadena vacía y termina filtrando por "ningún productor"), y
 * así se prueba sin montar un solo componente.
 */
import type { AdvancedSearchResult, SessionKind } from '../types'

export const SESSION_KINDS: SessionKind[] = ['aspersion', 'phyto', 'ndvi', 'soil_map']

export const SESSION_KIND_LABELS: Record<SessionKind, string> = {
  aspersion: 'Aspersión',
  phyto: 'Fitosanitaria',
  ndvi: 'NDVI',
  soil_map: 'Mapeo de suelo',
}

export type DateMode = 'planned' | 'actual'

export const DATE_MODE_LABELS: Record<DateMode, string> = {
  planned: 'Fecha programada',
  actual: 'Fecha real',
}

/** Forma de los search params en la URL: todo string, todo opcional. */
export interface VisorSearchParams {
  from?: string
  to?: string
  dateMode?: DateMode
  org?: string
  producers?: string
  ranches?: string
  plots?: string
  types?: string
}

/** Forma que consume la UI: arrays y valores siempre presentes. */
export interface AdvancedSearchCriteria {
  from: string
  to: string
  dateMode: DateMode
  org: string | null
  producers: string[]
  ranches: string[]
  plots: string[]
  types: SessionKind[]
}

export const EMPTY_CRITERIA: AdvancedSearchCriteria = {
  from: '',
  to: '',
  dateMode: 'planned',
  org: null,
  producers: [],
  ranches: [],
  plots: [],
  types: [],
}

function splitCsv(value: string | undefined): string[] {
  if (!value) return []
  return value.split(',').map((chunk) => chunk.trim()).filter(Boolean)
}

function joinCsv(values: string[]): string | undefined {
  // `undefined` (no cadena vacía) para que la clave desaparezca de la URL en vez de
  // quedar como `?producers=`, que ensucia el enlace y no significa nada.
  return values.length ? values.join(',') : undefined
}

export function criteriaFromSearch(search: VisorSearchParams): AdvancedSearchCriteria {
  const types = splitCsv(search.types).filter((kind): kind is SessionKind =>
    (SESSION_KINDS as string[]).includes(kind)
  )
  return {
    from: search.from ?? '',
    to: search.to ?? '',
    dateMode: search.dateMode === 'actual' ? 'actual' : 'planned',
    org: search.org ?? null,
    producers: splitCsv(search.producers),
    ranches: splitCsv(search.ranches),
    plots: splitCsv(search.plots),
    types,
  }
}

export function searchFromCriteria(criteria: AdvancedSearchCriteria): VisorSearchParams {
  return {
    from: criteria.from || undefined,
    to: criteria.to || undefined,
    // El modo por defecto no se escribe: solo ensuciaría la URL sin aportar nada.
    dateMode: criteria.dateMode === 'actual' ? 'actual' : undefined,
    org: criteria.org ?? undefined,
    producers: joinCsv(criteria.producers),
    ranches: joinCsv(criteria.ranches),
    plots: joinCsv(criteria.plots),
    types: joinCsv(criteria.types),
  }
}

/**
 * ¿Hay una búsqueda en curso?
 *
 * `dateMode` NO cuenta: por sí solo no acota nada, y si contara, el explorador
 * entraría en modo resultados con un filtro vacío que devuelve la base entera.
 */
export function isSearchActive(criteria: AdvancedSearchCriteria): boolean {
  return Boolean(
    criteria.from ||
      criteria.to ||
      criteria.org ||
      criteria.producers.length ||
      criteria.ranches.length ||
      criteria.plots.length ||
      criteria.types.length
  )
}

/** Query params del endpoint. Se omite lo vacío para no mandar filtros que no filtran. */
export function criteriaToQuery(criteria: AdvancedSearchCriteria): Record<string, string> {
  const query: Record<string, string> = {}
  if (criteria.from) query.date_from = criteria.from
  if (criteria.to) query.date_to = criteria.to
  if (criteria.dateMode === 'actual') query.date_mode = 'actual'
  if (criteria.org) query.organization = criteria.org
  if (criteria.producers.length) query.producer = criteria.producers.join(',')
  if (criteria.ranches.length) query.ranch = criteria.ranches.join(',')
  if (criteria.plots.length) query.plot = criteria.plots.join(',')
  // Los cuatro tipos equivalen a no filtrar por tipo: se omite para que el backend
  // aplique su propio default y la query quede más corta.
  if (criteria.types.length && criteria.types.length < SESSION_KINDS.length) {
    query.type = criteria.types.join(',')
  }
  return query
}

/**
 * Ids de sesión de una parcela que pertenecen al resultado, por tipo.
 *
 * Devuelve `null` cuando no hay búsqueda: los paneles de sesiones lo interpretan como
 * "sin filtro" y siguen listando todo, que es su comportamiento de siempre. Es la
 * diferencia importante frente a devolver un array vacío, que significaría "ninguna".
 */
export function sessionIdsForPlot(
  result: AdvancedSearchResult | null,
  plotId: string,
  kind: SessionKind
): string[] | null {
  if (!result) return null
  for (const producer of result.producers) {
    for (const ranch of producer.ranches) {
      for (const plot of ranch.plots) {
        if (plot.id !== plotId) continue
        return plot.sessions.filter((s) => s.kind === kind).map((s) => s.id)
      }
    }
  }
  // La parcela no aparece en el resultado: con búsqueda activa no le toca ninguna.
  return []
}

/** Ids de las parcelas del resultado, o `null` si no hay búsqueda. */
export function plotIdsFromResult(result: AdvancedSearchResult | null): string[] | null {
  return result ? result.plot_ids : null
}

/**
 * ¿Esta sesión sobrevive al filtro de búsqueda?
 *
 * `allowedIds` nulo o indefinido = no hay búsqueda, pasa todo. Se comparte entre los
 * cuatro paneles de sesiones para no repetir la misma condición (y su caso nulo) en
 * cada uno.
 */
export function isAllowedSession(
  id: string | undefined,
  allowedIds: string[] | null | undefined
): boolean {
  if (!allowedIds) return true
  return Boolean(id) && allowedIds.includes(id!)
}
