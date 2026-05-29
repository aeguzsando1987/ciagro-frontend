/**
 * Estadísticas por nivel del Visor de Datos Agrícolas (decisión 7.D.0: cómputo en
 * cliente sobre los arrays ya cargados; el GAP-VISOR-STATS backend queda documentado
 * como opción futura si el volumen lo exige).
 *
 * Funciones puras y testeables: cuentan elementos y suman superficies. El dashboard
 * decide qué listas cargar por nivel y delega aquí el cálculo y el etiquetado.
 */

/** Una estadística mostrable en una tarjeta. */
export interface StatEntry {
  label: string
  value: string
}

/** Parsea un decimal del backend (string | null) a número; null/NaN → 0. */
export function parseArea(value: string | null | undefined): number {
  if (value == null) return 0
  const n = parseFloat(value)
  return Number.isFinite(n) ? n : 0
}

/** Suma `total_area` (decimal-string) de una lista de parcelas/ranchos. */
export function sumArea(items: Array<{ total_area?: string | null }>): number {
  return items.reduce((acc, it) => acc + parseArea(it.total_area), 0)
}

/** Formatea hectáreas a es-MX con 2 decimales. */
export function formatHa(value: number): string {
  return `${value.toLocaleString('es-MX', { maximumFractionDigits: 2 })} ha`
}

// ─── Constructores de tarjetas por nivel ──────────────────────────────────────

export function datacentralStats(producers: number, ranches: number, plots: number): StatEntry[] {
  return [
    { label: 'Productores', value: String(producers) },
    { label: 'Ranchos', value: String(ranches) },
    { label: 'Parcelas', value: String(plots) },
  ]
}

export function producerStats(ranches: number, plots: number, areaHa: number): StatEntry[] {
  return [
    { label: 'Ranchos', value: String(ranches) },
    { label: 'Parcelas', value: String(plots) },
    { label: 'Superficie', value: formatHa(areaHa) },
  ]
}

export function ranchStats(plots: number, areaHa: number): StatEntry[] {
  return [
    { label: 'Parcelas', value: String(plots) },
    { label: 'Superficie', value: formatHa(areaHa) },
  ]
}

export function plotStats(areaHa: number, sessions: number): StatEntry[] {
  return [
    { label: 'Superficie', value: formatHa(areaHa) },
    { label: 'Sesiones de aspersión', value: String(sessions) },
  ]
}
