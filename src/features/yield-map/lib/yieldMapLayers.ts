import type { YieldLayerKey } from '../types'

export interface YieldLayerDef {
  key: YieldLayerKey
  label: string
  shortLabel: string
  unit: string
  palette: string[]
  description: string
}

export const YIELD_LAYERS: YieldLayerDef[] = [
  {
    key: 'yield_t_ha',
    label: 'Rendimiento (t/ha)',
    shortLabel: 'Rendimiento',
    unit: 't/ha',
    palette: ['#b91c1c', '#ef4444', '#f97316', '#facc15', '#bef264', '#4ade80', '#15803d'],
    description: 'Rojo = menor rendimiento; verde = mayor rendimiento.',
  },
  {
    key: 'moisture_pct',
    label: 'Humedad (%)',
    shortLabel: 'Humedad',
    unit: '%',
    palette: ['#e0f2fe', '#bae6fd', '#7dd3fc', '#38bdf8', '#0ea5e9', '#0369a1', '#1e3a8a'],
    description: 'Azul claro = menor humedad; azul oscuro = mayor humedad.',
  },
  {
    key: 'speed_kmh',
    label: 'Velocidad (km/h)',
    shortLabel: 'Velocidad',
    unit: 'km/h',
    palette: ['#ffe4e6', '#fecdd3', '#fda4af', '#fb7185', '#e11d48', '#9f1239', '#4c0519'],
    description: 'Rosa/rojo = menor velocidad; guinda = mayor velocidad.',
  },
  {
    key: 'grain_flow_t_h',
    label: 'Producción (t/h)',
    shortLabel: 'Producción',
    unit: 't/h',
    palette: ['#fff1f2', '#fecdd3', '#fda4af', '#f43f5e', '#be123c', '#881337', '#4c0519'],
    description: 'Flujo de grano de la cosechadora: rojo a guinda.',
  },
  {
    key: 'elevation_m',
    label: 'Elevación (m)',
    shortLabel: 'Elevación',
    unit: 'm',
    palette: ['#fff7ed', '#fed7aa', '#fdba74', '#fb7185', '#e11d48', '#9f1239', '#4c0519'],
    description: 'Altitud relativa de las lecturas: claro a rojo/guinda.',
  },
]

export interface YieldClass {
  key: string
  min: number
  max: number
  color: string
  label: string
}

function quantile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  if (sorted.length === 1) return sorted[0]!
  const index = (sorted.length - 1) * p
  const lower = Math.floor(index)
  const upper = Math.ceil(index)
  if (lower === upper) return sorted[lower]!
  const weight = index - lower
  return sorted[lower]! * (1 - weight) + sorted[upper]! * weight
}

export function buildYieldClasses(values: Array<number | null | undefined>, layer: YieldLayerDef): YieldClass[] {
  const sorted = values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v)).sort((a, b) => a - b)
  if (sorted.length === 0) return []

  const min = sorted[0]!
  const max = sorted[sorted.length - 1]!
  if (min === max) {
    return [{ key: 'band-0', min, max, color: layer.palette[Math.floor(layer.palette.length / 2)]!, label: `${formatYieldValue(min)} ${layer.unit}` }]
  }

  const breakSet = new Set<number>([min])
  for (let i = 1; i < layer.palette.length; i += 1) {
    breakSet.add(quantile(sorted, i / layer.palette.length))
  }
  breakSet.add(max)
  const breaks = Array.from(breakSet).sort((a, b) => a - b)
  const classes: YieldClass[] = []
  for (let i = 0; i < breaks.length - 1; i += 1) {
    const low = breaks[i]!
    const high = breaks[i + 1]!
    if (high < low) continue
    const colorIndex = Math.min(i, layer.palette.length - 1)
    classes.push({
      key: `band-${classes.length}`,
      min: low,
      max: high,
      color: layer.palette[colorIndex]!,
      label: `${formatYieldValue(low)}–${formatYieldValue(high)} ${layer.unit}`,
    })
  }
  return classes
}

export function yieldBucket(value: number | null | undefined, classes: YieldClass[]): string | null {
  if (value == null || !Number.isFinite(value) || classes.length === 0) return null
  for (let i = 0; i < classes.length; i += 1) {
    const entry = classes[i]!
    if (value <= entry.max || i === classes.length - 1) return entry.key
  }
  return classes[classes.length - 1]!.key
}

export function formatYieldValue(value: number | null | undefined, digits = 2): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return new Intl.NumberFormat('es-MX', { maximumFractionDigits: digits, minimumFractionDigits: 0 }).format(value)
}
