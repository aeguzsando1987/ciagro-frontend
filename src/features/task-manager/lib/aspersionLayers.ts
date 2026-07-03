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

export type LayerKey =
  | 'application'
  | 'target_rate'
  | 'rate_quality'
  | 'liquid_flow'
  | 'boom_pressure'
  | 'production'
  | 'speed'
export type LayerKind = 'category' | 'quartile' | 'target' | 'quality'

export interface LayerDef {
  key: LayerKey
  label: string
  /** Campo de RectangleProps que alimenta la capa. */
  field: keyof RectangleProps
  kind: LayerKind
  unit: string
  /** Unidad alterna opcional: convierte el valor para mostrarlo también (p. ej. bar→PSI). */
  altUnit?: { label: string; factor: number }
}

/**
 * Lista ordenada de las capas (el índice 0 = capa activa por defecto).
 * `boom_pressure` muestra además PSI (bar × 14.538) en el tooltip.
 */
export const ASPERSION_LAYERS: LayerDef[] = [
  { key: 'application',   label: 'Proporción volumen', field: 'applied_rate_l',    kind: 'category', unit: '%'    },
  { key: 'liquid_flow',   label: 'Caudal',             field: 'liquid_flow_ls',    kind: 'quartile', unit: 'L/s'  },
  { key: 'boom_pressure', label: 'Presión',            field: 'boom_pressure_bar', kind: 'quartile', unit: 'bar', altUnit: { label: 'PSI', factor: 14.538 } },
  { key: 'production',    label: 'Productividad',      field: 'production_hah',    kind: 'quartile', unit: 'ha/h' },
  { key: 'speed',         label: 'Velocidad',          field: 'speed_kmh',         kind: 'quartile', unit: 'km/h' },
  { key: 'target_rate',   label: 'Proporción meta',    field: 'target_rate_l',     kind: 'target',   unit: 'L/ha' },
  { key: 'rate_quality',  label: 'Rate Quality',       field: 'rate_quality',      kind: 'quality',  unit: ''     },
]

// ─── Capa 1 · Semáforo de % de aplicación ────────────────────────────────────

/**
 * Semáforo de "Proporción volumen" (applied_rate_l / target_rate_l).
 * Unificado con el semáforo del reporte: mismas keys, umbrales (75/90/100/115%) y colores.
 * `sin_meta` es un fallback cuando falta applied/target (no aparece en la leyenda).
 */
export type ApplicationCategoryKey =
  | 'deficiente'
  | 'baja'
  | 'esperada'
  | 'excelente'
  | 'sobredosis'
  | 'sin_meta'

export interface CategoryDef {
  key: string
  label: string
  color: string
  /** Solo en el semáforo categórico (rango de %); ausente en capas por valor/calidad. */
  range?: string
}

export const APPLICATION_CATEGORIES: CategoryDef[] = [
  { key: 'deficiente', label: 'Deficiente', color: '#dc2626', range: '< 75%'    },
  { key: 'baja',       label: 'Baja',       color: '#eab308', range: '75–90%'   },
  { key: 'esperada',   label: 'Esperada',   color: '#84cc16', range: '90–100%'  },
  { key: 'excelente',  label: 'Excelente',  color: '#5bb304', range: '100–115%' },
  { key: 'sobredosis', label: 'Sobredosis', color: '#4052D6', range: '> 115%'   },
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
 * Clasifica un punto según el semáforo de proporción de volumen.
 * Umbrales (unificados con el reporte): <75 Deficiente | 75–90 Baja | 90–100 Esperada |
 *   100–115 Excelente | >115 Sobredosis.
 * Si applied o target son nulos/cero, devuelve 'sin_meta'.
 */
export function classifyApplication(
  applied: number | null,
  target: number | null,
): ApplicationCategoryKey {
  const p = applicationPercent(applied, target)
  if (p == null) return 'sin_meta'
  if (p < 75)  return 'deficiente'
  if (p < 90)  return 'baja'
  if (p < 100) return 'esperada'
  if (p <= 115) return 'excelente'
  return 'sobredosis'
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

/** Capas que se pintan por cuartiles (las demás usan category/target/quality). */
export type QuartileLayerKey = 'liquid_flow' | 'boom_pressure' | 'production' | 'speed'

/** Paletas de 4 tonos por capa (q1=más claro → q4=más oscuro). */
export const QUARTILE_PALETTES: Record<QuartileLayerKey, [string, string, string, string]> = {
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

// ─── Capa · Rate Quality (semáforo simple de 3 buckets) ──────────────────────

/**
 * Semáforo simple por `rate_quality` (texto que viene del CSV): Bajo objetivo → rojo,
 * Bien → verde, Sobre objetivo → azul. `sin_dato` es el fallback (no se lista).
 */
export const RATE_QUALITY_CATEGORIES: CategoryDef[] = [
  { key: 'bajo',  label: 'Bajo objetivo',  color: '#dc2626' },
  { key: 'bien',  label: 'Bien',           color: '#16a34a' },
  { key: 'sobre', label: 'Sobre objetivo', color: '#2563eb' },
]

/** Normaliza el texto de `rate_quality` a una key del semáforo simple. */
export function classifyRateQuality(value: string | null | undefined): string {
  if (!value) return 'sin_dato'
  const s = value.trim().toLowerCase()
  if (s.startsWith('bajo')) return 'bajo'
  if (s.startsWith('bien')) return 'bien'
  if (s.startsWith('sobre')) return 'sobre'
  return 'sin_dato'
}

// ─── Capa · Proporción meta (categórica por valor distinto de target_rate_l) ──

/** Paleta cualitativa para valores distintos de meta (se cicla si hay más de 10). */
export const TARGET_PALETTE: string[] = [
  '#2563eb', '#16a34a', '#f59e0b', '#9333ea', '#dc2626',
  '#0891b2', '#c026d3', '#65a30d', '#ea580c', '#4f46e5',
]

/** Key de bucket para un valor de meta (string estable) o `sin_meta` si falta. */
export function targetBucketOf(value: number | null): string {
  return value == null || !Number.isFinite(value) ? 'sin_meta' : String(value)
}

/** Construye la leyenda de "Proporción meta" a partir de los valores distintos presentes. */
export function buildTargetDefs(values: (number | null)[]): CategoryDef[] {
  const distinct = Array.from(
    new Set(values.filter((v): v is number => v != null && Number.isFinite(v))),
  ).sort((a, b) => a - b)
  return distinct.map((v, i) => ({
    key: String(v),
    label: `${v.toFixed(2)} L/ha`,
    color: TARGET_PALETTE[i % TARGET_PALETTE.length]!,
  }))
}
