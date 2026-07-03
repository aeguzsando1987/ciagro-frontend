import type { SemaforoBucketKey, StatsSnapshot } from '../types'

/**
 * Semáforo de cobertura (5 buckets).
 *
 * El color es **fuente de verdad del backend** (`stats_snapshot.semaforo[bucket].color`,
 * ver GAP-AC-004: los rangos son placeholder y no deben hardcodearse en el front). Aquí solo
 * definimos el orden de presentación y las etiquetas legibles; los buckets del visor
 * (`APPLICATION_CATEGORIES`) usan otros cortes y NO aplican a este semáforo.
 */

export const SEMAFORO_ORDER: SemaforoBucketKey[] = [
  'sobredosis',
  'excelente',
  'esperada',
  'baja',
  'deficiente',
]

export const SEMAFORO_LABELS: Record<SemaforoBucketKey, string> = {
  sobredosis: 'Sobredosis',
  excelente: 'Excelente',
  esperada: 'Esperada',
  baja: 'Baja',
  deficiente: 'Deficiente',
}

/**
 * El backend envía `color` como **nombre** (no hex): `azul_electrico | verde |
 * verde_amarillento | amarillo | rojo` (ver `report_adapters.py`). Lo traducimos a hex.
 * Si algún día el backend mandara un hex (`#...`) lo dejamos pasar tal cual.
 */
// Paleta unificada con el visor (semáforo de "Proporción volumen"):
// sobredosis=#4052D6 (azul_electrico) · excelente=#5bb304 (verde) · esperada=#84cc16 ·
// baja=#eab308 · deficiente=#dc2626.
const COLOR_NAME_TO_HEX: Record<string, string> = {
  azul_electrico: '#4052D6',
  verde: '#5bb304',
  verde_amarillento: '#84cc16',
  amarillo: '#eab308',
  rojo: '#dc2626',
}

const FALLBACK_COLOR = '#94a3b8'

export function resolveSemaforoColor(color: string | null | undefined): string {
  if (!color) return FALLBACK_COLOR
  if (color.startsWith('#')) return color
  return COLOR_NAME_TO_HEX[color] ?? FALLBACK_COLOR
}

export interface SemaforoRow {
  key: SemaforoBucketKey
  label: string
  color: string
  areaHa: number | null
  pctAreaTotal: number | null
}

function toNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : null
}

/**
 * Normaliza `stats_snapshot.semaforo` a filas ordenadas y listas para render.
 * Omite los buckets que el backend no envió.
 */
export function semaforoRows(stats: StatsSnapshot): SemaforoRow[] {
  const semaforo = stats.semaforo ?? {}
  return SEMAFORO_ORDER.flatMap((key) => {
    const bucket = semaforo[key]
    if (!bucket) return []
    return [
      {
        key,
        label: SEMAFORO_LABELS[key],
        color: resolveSemaforoColor(bucket.color),
        areaHa: toNumber(bucket.area_ha),
        pctAreaTotal: toNumber(bucket.pct_area_total),
      },
    ]
  })
}
