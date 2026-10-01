import type { PlantingLayerKey } from '../types'

export type PlantingLayerKind = 'numeric' | 'category'

export interface PlantingLayerDef {
  key: PlantingLayerKey
  label: string
  unit: string
  kind: PlantingLayerKind
  palette: string[]
}

export interface PlantingClass {
  key: string
  label: string
  color: string
  min?: number
  max?: number
  category?: string
}

export const PLANTING_MAP_LAYERS: PlantingLayerDef[] = [
  { key: 'applied_rate', label: 'Proporción aplicada', unit: 'ksds/ha', kind: 'numeric', palette: ['#ef1b0c','#ff8c00','#ffd400','#d8ef00','#00e600','#00c8df','#001eff'] },
  { key: 'target_rate', label: 'Proporción meta', unit: 'ksds/ha', kind: 'numeric', palette: ['#6d5dfc','#8f7cff','#b19aff','#d0bcff','#eadfff'] },
  { key: 'mass_flow', label: 'Flujo de masa', unit: 'tonne/s', kind: 'numeric', palette: ['#f4f6f5','#dcebe3','#bed8ca','#8fbea5','#5b9e7c','#2f7f59','#0d6b42'] },
  { key: 'applied_rate_mass', label: 'Proporción aplicada (masa)', unit: 'kg/ha', kind: 'numeric', palette: ['#ef1b0c','#ff8c00','#ffd400','#d8ef00','#00e600','#00c8df','#001eff'] },
  { key: 'target_rate_mass', label: 'Proporción meta (masa)', unit: 'kg/ha', kind: 'numeric', palette: ['#6d5dfc','#8f7cff','#b19aff','#d0bcff','#eadfff'] },
  { key: 'density', label: 'Densidad', unit: 'ksds/ha', kind: 'numeric', palette: ['#f4f6f5','#dcebe3','#bed8ca','#8fbea5','#5b9e7c','#2f7f59','#0d6b42'] },
  { key: 'singulation', label: 'Singulación', unit: '%', kind: 'numeric', palette: ['#ef1b0c','#ff7a00','#ffae00','#ffd400','#d8ef00','#8bea00','#00f000'] },
  { key: 'seed_spacing', label: 'Espaciamiento de semillas', unit: 'cm', kind: 'numeric', palette: ['#ef1b0c','#ff7a00','#ffae00','#ffd400','#d8ef00','#7bea00','#00e600'] },
  { key: 'skips', label: 'Saltos', unit: '%', kind: 'numeric', palette: ['#00e600','#7bea00','#d8ef00','#ffd400','#ffae00','#ff7a00','#ef1b0c'] },
  { key: 'doubles', label: 'Dobles', unit: '%', kind: 'numeric', palette: ['#00e600','#7bea00','#d8ef00','#ffd400','#ffae00','#ff7a00','#ef1b0c'] },
  { key: 'rate_quality', label: 'Rate Quality', unit: '', kind: 'category', palette: ['#075985','#8cc63f','#f4c430','#f97316','#dc2626','#7c3aed'] },
  { key: 'speed', label: 'Velocidad', unit: 'km/h', kind: 'numeric', palette: ['#ef1b0c','#ff8c00','#ffd400','#d8ef00','#00e600'] },
  { key: 'productivity', label: 'Productividad', unit: 'ha/h', kind: 'numeric', palette: ['#ef1b0c','#ff8c00','#ffd400','#d8ef00','#00e600'] },
]

export const PLANTING_LAYER_BY_KEY = Object.fromEntries(
  PLANTING_MAP_LAYERS.map((layer) => [layer.key, layer]),
) as Record<PlantingLayerKey, PlantingLayerDef>

export function buildPlantingClasses(
  values: Array<number | string>,
  layer: PlantingLayerDef,
): PlantingClass[] {
  if (layer.kind === 'category') {
    const categories = Array.from(new Set(values.map((value) => String(value ?? '').trim()).filter(Boolean)))
    return categories.map((category, index) => ({
      key: `cat-${index}`,
      label: category,
      category,
      color: layer.palette[index % layer.palette.length] ?? '#64748b',
    }))
  }

  const numbers = values.filter(
    (value): value is number => typeof value === 'number' && Number.isFinite(value),
  )
  if (numbers.length === 0) return []

  const min = Math.min(...numbers)
  const max = Math.max(...numbers)
  if (min === max) {
    return [{
      key: 'range-0',
      min,
      max,
      label: formatRange(min, max, layer.unit),
      color: layer.palette[layer.palette.length - 1] ?? '#16a34a',
    }]
  }

  const bucketCount = Math.min(layer.palette.length, 7)
  const step = (max - min) / bucketCount

  return Array.from({ length: bucketCount }, (_, index) => {
    const lower = min + step * index
    const upper = index === bucketCount - 1 ? max : min + step * (index + 1)
    return {
      key: `range-${index}`,
      min: lower,
      max: upper,
      label: formatRange(lower, upper, layer.unit),
      color: layer.palette[index] ?? layer.palette[layer.palette.length - 1] ?? '#16a34a',
    }
  })
}

export function bucketForValue(
  value: number | string,
  classes: PlantingClass[],
  kind: PlantingLayerKind,
): string | null {
  if (kind === 'category') {
    const text = String(value ?? '').trim()
    return classes.find((entry) => entry.category === text)?.key ?? null
  }

  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  for (const [index, entry] of classes.entries()) {
    if (entry.min == null || entry.max == null) continue
    const isLast = index === classes.length - 1
    if (value >= entry.min && (value < entry.max || (isLast && value <= entry.max))) {
      return entry.key
    }
  }
  return null
}

export function formatPlantingValue(value: number | string | null | undefined): string {
  if (value == null || value === '') return '—'
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return '—'
    return value.toLocaleString('es-MX', { maximumFractionDigits: 2 })
  }
  return value
}

function formatRange(min: number, max: number, unit: string): string {
  const fmt = (value: number) =>
    value.toLocaleString('es-MX', { maximumFractionDigits: 2 })
  return `${fmt(min)} – ${fmt(max)}${unit ? ` ${unit}` : ''}`
}
