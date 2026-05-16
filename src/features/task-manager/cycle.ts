/**
 * Utilidades del ciclo de cosecha de un Subprograma.
 *
 * Espejan el validador `validate_cycle` del backend (apps/field_ops/models.py):
 *   - formato: `<Temporada>-<AAAA>` o `<Temporada1>-<Temporada2>-<AAAA>`
 *   - temporadas válidas y su orden anual: Primavera < Verano < Otoño < Invierno
 *   - año entre 2000 y 2050
 *   - si hay Temporada2, debe ser posterior a Temporada1 en el orden del año
 *
 * Caso de uso §3.5.4: el ciclo se captura con 3 controles (temporada1,
 * temporada2 opcional, año), no como texto libre.
 */

export const SEASONS = ['Primavera', 'Verano', 'Otoño', 'Invierno'] as const
export type Season = (typeof SEASONS)[number]

export const CYCLE_MIN_YEAR = 2000
export const CYCLE_MAX_YEAR = 2050

/** Años seleccionables para el ciclo (2000–2050). */
export const CYCLE_YEARS: number[] = Array.from(
  { length: CYCLE_MAX_YEAR - CYCLE_MIN_YEAR + 1 },
  (_, i) => CYCLE_MIN_YEAR + i,
)

const SEASON_ORDER: Record<string, number> = Object.fromEntries(
  SEASONS.map((s, i) => [s, i]),
)

/**
 * Construye el string de ciclo a partir de sus partes.
 * Devuelve '' si falta la temporada 1 o el año (ciclo incompleto → no se envía).
 */
export function buildCycle(
  season1: string | undefined,
  season2: string | undefined,
  year: string | number | undefined,
): string {
  if (!season1 || !year) return ''
  const parts = season2 ? [season1, season2, year] : [season1, year]
  return parts.join('-')
}

export interface CycleParts {
  season1?: Season
  season2?: Season
  year?: number
}

/**
 * Descompone un string de ciclo en sus partes, para precargar el formulario
 * de edición. Tolera valores nulos o con formato inesperado.
 */
export function parseCycle(cycle: string | null | undefined): CycleParts {
  if (!cycle) return {}
  const segments = cycle.split('-')
  const year = Number(segments[segments.length - 1])
  const seasons = segments
    .slice(0, -1)
    .filter((s): s is Season => (SEASONS as readonly string[]).includes(s))
  return {
    season1: seasons[0],
    season2: seasons[1],
    year: Number.isFinite(year) ? year : undefined,
  }
}

/**
 * Valida que Temporada2, si existe, sea posterior a Temporada1 en el orden
 * del año. Espeja la regla de `validate_cycle` del backend.
 */
export function isSeason2AfterSeason1(season1?: string, season2?: string): boolean {
  if (!season2) return true
  if (!season1) return false
  return (SEASON_ORDER[season2] ?? -1) > (SEASON_ORDER[season1] ?? -1)
}
