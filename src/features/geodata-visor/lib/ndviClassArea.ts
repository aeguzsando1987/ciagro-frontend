/**
 * Reparto de superficie por clase de un indice NDVI, en hectareas.
 *
 * El area sale de CONTAR CELDAS de la superficie ya interpolada, no de contar puntos:
 * cada celda representa un trozo igual de terreno, asi que el reparto es espacial y no
 * depende de que el muestreo sea uniforme. Es la misma leccion que ya estaba aprendida en
 * soilMapArea.buildSoilRasterAreaStats. El conteo de puntos se conserva como dato
 * secundario, util para contrastar: con una malla de muestreo regular ambos numeros deben
 * quedar cerca, y una divergencia grande delata un problema en el reparto.
 *
 * El 100% es el AREA CUBIERTA POR LOS DATOS, no la parcela: la superficie se recorta al
 * casco convexo de los puntos, asi que prorratear contra el total de la parcela atribuiria
 * hectareas a zonas donde no se midio nada.
 */
import type { ColorBand, ValueGrid } from './ndviInterpolation'

/** Banda con lo necesario para etiquetarla en la tarjeta. min/max null = ±infinito. */
export interface ClassBand extends ColorBand {
  label?: string
}

export interface NdviClassArea {
  order: number
  label: string
  color: string
  min: number | null
  max: number | null
  areaHa: number
  /** Porcentaje sobre el area cubierta por los datos. */
  pctArea: number
  cells: number
  pointCount: number
  /** Porcentaje sobre los puntos con valor en este indice. */
  pctPoints: number
}

export interface NdviClassAreaSummary {
  classes: NdviClassArea[]
  /** Celdas con dato que no caen en ninguna banda configurada. */
  outsideCells: number
  outsideAreaHa: number
  pctOutside: number
  /** Suma de todas las celdas con dato: el area realmente medida. */
  coveredAreaHa: number
  /** Puntos con valor en el indice activo (denominador de pctPoints). */
  pointsWithValue: number
}

/**
 * Indice de la banda que contiene v, o -1 si ninguna.
 *
 * MISMA regla que bandColor en ndviInterpolation (min <= v < max, null = ±infinito): si
 * las dos divergieran, el histograma contradiria al mapa que dice resumir.
 */
export function bandIndexOf(value: number, bands: readonly ClassBand[]): number {
  for (let i = 0; i < bands.length; i++) {
    const b = bands[i]!
    if ((b.min === null || value >= b.min) && (b.max === null || value < b.max)) return i
  }
  return -1
}

/** Celdas por banda sobre la malla ya clasificada. Las celdas NaN quedan fuera del casco. */
export function countCellsByBand(
  grid: Float32Array,
  bands: readonly ClassBand[],
): { perBand: number[]; outside: number; withData: number } {
  const perBand = new Array<number>(bands.length).fill(0)
  let outside = 0
  let withData = 0

  for (let i = 0; i < grid.length; i++) {
    const v = grid[i]!
    if (Number.isNaN(v)) continue
    withData++
    const b = bandIndexOf(v, bands)
    if (b < 0) outside++
    else perBand[b]! += 1
  }

  return { perBand, outside, withData }
}

/** Puntos por banda. Los puntos sin valor en el indice activo no cuentan. */
export function countPointsByBand(
  values: readonly (number | null | undefined)[],
  bands: readonly ClassBand[],
): { perBand: number[]; withValue: number } {
  const perBand = new Array<number>(bands.length).fill(0)
  let withValue = 0

  for (const v of values) {
    if (typeof v !== 'number' || Number.isNaN(v)) continue
    withValue++
    const b = bandIndexOf(v, bands)
    if (b >= 0) perBand[b]! += 1
  }

  return { perBand, withValue }
}

function pct(part: number, total: number): number {
  return total > 0 ? (part / total) * 100 : 0
}

function defaultLabel(b: ClassBand, i: number): string {
  if (b.label) return b.label
  return `Clase ${i + 1}`
}

/**
 * Une el reparto por celdas (principal) con el conteo de puntos (secundario).
 * Devuelve null si no hay bandas o la malla no tiene una sola celda con dato.
 */
export function buildNdviClassAreas(
  field: Pick<ValueGrid, 'grid' | 'cellAreaHa'>,
  bands: readonly ClassBand[],
  pointValues: readonly (number | null | undefined)[] = [],
): NdviClassAreaSummary | null {
  if (bands.length === 0) return null

  const cells = countCellsByBand(field.grid, bands)
  if (cells.withData === 0) return null

  const points = countPointsByBand(pointValues, bands)
  const coveredAreaHa = cells.withData * field.cellAreaHa

  const classes: NdviClassArea[] = bands.map((b, i) => {
    const c = cells.perBand[i]!
    return {
      order: i,
      label: defaultLabel(b, i),
      color: b.color,
      min: b.min,
      max: b.max,
      cells: c,
      areaHa: c * field.cellAreaHa,
      pctArea: pct(c, cells.withData),
      pointCount: points.perBand[i]!,
      pctPoints: pct(points.perBand[i]!, points.withValue),
    }
  })

  return {
    classes,
    outsideCells: cells.outside,
    outsideAreaHa: cells.outside * field.cellAreaHa,
    pctOutside: pct(cells.outside, cells.withData),
    coveredAreaHa,
    pointsWithValue: points.withValue,
  }
}

/** Rango de una clase para la etiqueta del eje: "0.700 – 0.800", con ±inf en los extremos. */
export function formatBandRange(min: number | null, max: number | null, digits = 2): string {
  const fmt = (v: number) => v.toFixed(digits)
  if (min === null && max === null) return 'todo'
  if (min === null) return `< ${fmt(max!)}`
  if (max === null) return `≥ ${fmt(min)}`
  return `${fmt(min)} – ${fmt(max)}`
}
