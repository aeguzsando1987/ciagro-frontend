/**
 * Definición centralizada de las 5 capas de análisis de aspersión y sus funciones
 * de clasificación (puras, testeables). La paleta, los umbrales y los campos de dato
 * viven aquí; el modal solo consume este módulo para pintar y filtrar.
 *
 * Capas:
 *  1. application  — % de aplicación (applied_rate_l / target_rate_l), semáforo categórico
 *  2. liquid_flow  — Flujo líquido (liquid_flow_ls), 4 cuartiles, tonos verdes
 *  3. boom_pressure— Presión de brazo (boom_pressure_bar), 4 cuartiles, tonos azules
 *  4. production   — Producción (production_hah), 4 cuartiles, tonos morados
 *  5. speed        — Velocidad (speed_kmh), 4 cuartiles, tonos rojizos
 */
import type { RectangleProps } from './plotRectangles'

// ─── Tipos de capa ────────────────────────────────────────────────────────────

export type LayerKey = 'application' | 'liquid_flow' | 'boom_pressure' | 'production' | 'speed'
export type LayerKind = 'category' | 'quartile'

export interface LayerDef {
  key: LayerKey
  label: string
  /** Campo numérico de RectangleProps que alimenta la capa. */
  field: keyof RectangleProps
  kind: LayerKind
  unit: string
}

/** Lista ordenada de las 5 capas (el índice 0 = Capa 1 = capa activa por defecto). */
export const ASPERSION_LAYERS: LayerDef[] = [
  { key: 'application',   label: '% de aplicación', field: 'applied_rate_l', kind: 'category',  unit: '%'    },
  { key: 'liquid_flow',   label: 'Flujo líquido',    field: 'liquid_flow_ls', kind: 'quartile',  unit: 'L/s'  },
  { key: 'boom_pressure', label: 'Presión de brazo', field: 'boom_pressure_bar', kind: 'quartile', unit: 'bar' },
  { key: 'production',    label: 'Producción',       field: 'production_hah', kind: 'quartile',  unit: 'ha/h' },
  { key: 'speed',         label: 'Velocidad',        field: 'speed_kmh',      kind: 'quartile',  unit: 'km/h' },
]

// ─── Capa 1 · Semáforo de % de aplicación ────────────────────────────────────

/**
 * Categorías exactas del caso de uso geodata_analysis_usecases.md.
 * Se definen 5 buckets; los dos últimos son ambos "Sobredosis" pero con rangos distintos.
 */
export type ApplicationCategoryKey =
  | 'deficiente'
  | 'regular'
  | 'excelente'
  | 'sobredosis'
  | 'sobredosis_alta'
  | 'sin_meta'

export interface CategoryDef {
  key: ApplicationCategoryKey
  label: string
  color: string
  range: string
}

export const APPLICATION_CATEGORIES: CategoryDef[] = [
  { key: 'deficiente',      label: 'Deficiente',      color: '#dc2626', range: '< 80%'     },
  { key: 'regular',         label: 'Regular',         color: '#f59e0b', range: '80–95%'    },
  { key: 'excelente',       label: 'Excelente',       color: '#16a34a', range: '95–105%'   },
  { key: 'sobredosis',      label: 'Sobredosis',      color: '#f97316', range: '105–120%'  },
  { key: 'sobredosis_alta', label: 'Sobredosis alta', color: '#7f1d1d', range: '> 120%'    },
]

/** Calcula el % de aplicación de un punto. Devuelve null si falta target o target es 0. */
export function applicationPercent(
  applied: number | null,
  target: number | null,
): number | null {
  if (applied == null || target == null || target === 0) return null
  return (applied / target) * 100
}

/**
 * Clasifica un punto según el semáforo de % de aplicación (Capa 1).
 * Umbrales del caso de uso: <80 Deficiente | 80–95 Regular | 95–105 Excelente |
 *   105–120 Sobredosis | >120 Sobredosis alta.
 * Si applied o target son nulos/cero, devuelve 'sin_meta'.
 */
export function classifyApplication(
  applied: number | null,
  target: number | null,
): ApplicationCategoryKey {
  const p = applicationPercent(applied, target)
  if (p == null) return 'sin_meta'
  if (p < 80)  return 'deficiente'
  if (p < 95)  return 'regular'
  if (p < 105) return 'excelente'
  if (p <= 120) return 'sobredosis'
  return 'sobredosis_alta'
}

// ─── Capas 2–5 · Cuartiles ───────────────────────────────────────────────────

/** Cortes de cuartiles calculados sobre la distribución de valores cargados. */
export interface QuartileCuts {
  min: number
  q1: number
  q2: number
  q3: number
  max: number
}

export type QuartileKey = 'q1' | 'q2' | 'q3' | 'q4'

export interface QuartileDef {
  key: QuartileKey
  label: string
  color: string
}

/** Paletas de 4 tonos por capa (q1=más claro → q4=más oscuro). */
export const QUARTILE_PALETTES: Record<Exclude<LayerKey, 'application'>, [string, string, string, string]> = {
  liquid_flow:   ['#bbf7d0', '#4ade80', '#16a34a', '#14532d'],
  boom_pressure: ['#bfdbfe', '#60a5fa', '#2563eb', '#1e3a8a'],
  production:    ['#e9d5ff', '#c084fc', '#9333ea', '#581c87'],
  speed:         ['#fecaca', '#f87171', '#dc2626', '#7f1d1d'],
}

/** Construye las 4 entradas de leyenda para una capa cuartil con sus cortes y colores. */
export function buildQuartileDefs(
  palette: [string, string, string, string],
  cuts: QuartileCuts,
  unit: string,
): QuartileDef[] {
  return [
    { key: 'q1', label: `Q1 < ${cuts.q1.toFixed(2)} ${unit}`, color: palette[0] },
    { key: 'q2', label: `Q2 ${cuts.q1.toFixed(2)}–${cuts.q2.toFixed(2)} ${unit}`, color: palette[1] },
    { key: 'q3', label: `Q3 ${cuts.q2.toFixed(2)}–${cuts.q3.toFixed(2)} ${unit}`, color: palette[2] },
    { key: 'q4', label: `Q4 ≥ ${cuts.q3.toFixed(2)} ${unit}`, color: palette[3] },
  ]
}

/**
 * Calcula los cuartiles (Q1, Q2/mediana, Q3) de un arreglo de valores usando
 * interpolación lineal. Devuelve null si no hay valores finitos.
 */
export function computeQuartiles(values: number[]): QuartileCuts | null {
  const sorted = values.filter(Number.isFinite).slice().sort((a, b) => a - b)
  if (sorted.length === 0) return null

  const quantile = (p: number): number => {
    const idx = (sorted.length - 1) * p
    const lo = Math.floor(idx)
    const hi = Math.ceil(idx)
    if (lo === hi) return sorted[lo]!
    return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (idx - lo)
  }

  return {
    min: sorted[0]!,
    q1:  quantile(0.25),
    q2:  quantile(0.5),
    q3:  quantile(0.75),
    max: sorted[sorted.length - 1]!,
  }
}

/** Asigna el cuartil de un valor dado los cortes computados. Devuelve null si el valor falta. */
export function quartileOf(value: number | null, cuts: QuartileCuts): QuartileKey | null {
  if (value == null || !Number.isFinite(value)) return null
  if (value < cuts.q1) return 'q1'
  if (value < cuts.q2) return 'q2'
  if (value < cuts.q3) return 'q3'
  return 'q4'
}
