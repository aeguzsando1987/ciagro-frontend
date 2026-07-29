/**
 * Interpolación de una superficie continua a partir de puntos, en el CLIENTE.
 *
 * Genera una malla sobre el CASCO CONVEXO de los puntos (su footprint real, no el polígono
 * de la parcela: los puntos suelen cubrir solo una sub-zona), interpola cada celda con IDW y
 * la colorea con una rampa vívida. Devuelve una imagen (dataURL) + las coordenadas de sus
 * esquinas para usarla como `image source` en MapLibre; las celdas fuera del casco quedan
 * transparentes, de modo que el gradiente se recorta al área con datos.
 *
 * El motor de interpolación (idwValue) está AISLADO: para Kriging real se sustituye esa
 * función sin tocar el resto.
 */

import { krigingTrain, krigingPredict } from './kriging'

export type InterpMethod = 'idw' | 'kriging'

// Kriging invierte una matriz n x n (O(n^3)); se submuestrea para acotar tiempo/memoria.
const MAX_KRIGING_POINTS = 700

export interface InterpPoint {
  lon: number
  lat: number
  value: number
}

export interface InterpolatedImage {
  dataUrl: string
  coordinates: [[number, number], [number, number], [number, number], [number, number]]
  min: number
  max: number
}

/** Banda de color para el modo manual (config del tenant). min/max null = ±∞. */
export interface ColorBand {
  min: number | null
  max: number | null
  color: string
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [
    parseInt(h.substring(0, 2), 16) || 0,
    parseInt(h.substring(2, 4), 16) || 0,
    parseInt(h.substring(4, 6), 16) || 0,
  ]
}

/** Color de la banda cuyo intervalo contiene v, o null si ninguna. */
function bandColor(v: number, bands: ColorBand[]): [number, number, number] | null {
  for (const b of bands) {
    if ((b.min === null || v >= b.min) && (b.max === null || v < b.max)) return hexToRgb(b.color)
  }
  return null
}

// Rampa vívida (saturada) bajo -> alto: rojo -> naranja -> verde -> cian -> azul.
// Se evitan los tonos pálidos para que el gradiente no se vea lavado.
const RAMP: [number, number, number][] = [
  [211, 47, 47],   // rojo
  [245, 124, 0],   // naranja
  [56, 142, 60],   // verde
  [0, 172, 193],   // cian
  [21, 101, 192],  // azul
]

function rampColor(t: number): [number, number, number] {
  const clamped = Math.max(0, Math.min(1, t))
  const seg = clamped * (RAMP.length - 1)
  const i = Math.min(RAMP.length - 2, Math.floor(seg))
  const f = seg - i
  const a = RAMP[i]!
  const b = RAMP[i + 1]!
  return [
    Math.round(a[0] + (b[0] - a[0]) * f),
    Math.round(a[1] + (b[1] - a[1]) * f),
    Math.round(a[2] + (b[2] - a[2]) * f),
  ]
}

/** Casco convexo (Andrew monotone chain). Devuelve el anillo [ [lon,lat], ... ]. */
function convexHull(pts: InterpPoint[]): number[][] {
  const p = pts.map((q) => [q.lon, q.lat] as [number, number])
    .sort((u, v) => (u[0] - v[0]) || (u[1] - v[1]))
  if (p.length < 3) return p
  const cross = (o: number[], a: number[], b: number[]) =>
    (a[0]! - o[0]!) * (b[1]! - o[1]!) - (a[1]! - o[1]!) * (b[0]! - o[0]!)
  const lower: number[][] = []
  for (const pt of p) {
    while (lower.length >= 2 && cross(lower[lower.length - 2]!, lower[lower.length - 1]!, pt) <= 0) lower.pop()
    lower.push(pt)
  }
  const upper: number[][] = []
  for (let i = p.length - 1; i >= 0; i--) {
    const pt = p[i]!
    while (upper.length >= 2 && cross(upper[upper.length - 2]!, upper[upper.length - 1]!, pt) <= 0) upper.pop()
    upper.push(pt)
  }
  lower.pop()
  upper.pop()
  return lower.concat(upper)
}

function pointInRing(x: number, y: number, ring: number[][]): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i]![0]!, yi = ring[i]![1]!
    const xj = ring[j]![0]!, yj = ring[j]![1]!
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi
    if (intersect) inside = !inside
  }
  return inside
}

/**
 * Fracción de rango percentil de `v` dentro de `sorted` (ascendente) -> [0,1].
 * Ecualiza el histograma: reparte el color parejo sobre la distribución de los datos, de
 * modo que un rango de valores estrecho use TODA la rampa (máximo contraste).
 */
function rankFraction(v: number, sorted: number[]): number {
  const n = sorted.length
  if (n <= 1) return 0.5
  let lo = 0
  let hi = n
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (sorted[mid]! < v) lo = mid + 1
    else hi = mid
  }
  return lo / (n - 1)
}

/**
 * Motor de interpolación (intercambiable). IDW con potencia BAJA para suavizar: potencia
 * alta crea el artefacto 'bullseye' (discos uniformes de color alrededor de cada punto)
 * cuando los puntos están separados. El contraste ya lo aporta la ecualización por
 * percentiles, así que aquí se prioriza suavidad.
 */
function idwValue(x: number, y: number, pts: InterpPoint[], power = 1.2): number {
  let num = 0
  let den = 0
  for (const p of pts) {
    const dx = x - p.lon
    const dy = y - p.lat
    const d2 = dx * dx + dy * dy
    if (d2 === 0) return p.value
    const w = 1 / Math.pow(d2, power / 2)
    num += w * p.value
    den += w
  }
  return den === 0 ? NaN : num / den
}

/** Submuestrea uniformemente (por paso) a un maximo de puntos. */
function subsample(pts: InterpPoint[], max: number): InterpPoint[] {
  if (pts.length <= max) return pts
  const step = Math.ceil(pts.length / max)
  const out: InterpPoint[] = []
  for (let i = 0; i < pts.length; i += step) out.push(pts[i]!)
  return out
}

/**
 * Cortes de cuantiles de `values` en `n` clases: devuelve n+1 límites
 * [min, q1, ..., q(n-1), max]. La clase i cubre [breaks[i], breaks[i+1]).
 */
export function quantileBreaks(values: number[], n: number): number[] {
  const sorted = [...values].sort((a, b) => a - b)
  if (sorted.length === 0) return []
  const count = Math.max(2, n)
  const at = (frac: number): number => {
    if (sorted.length === 1) return sorted[0]!
    const pos = frac * (sorted.length - 1)
    const lo = Math.floor(pos)
    const hi = Math.min(sorted.length - 1, lo + 1)
    return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (pos - lo)
  }
  const breaks = [sorted[0]!]
  for (let i = 1; i < count; i++) breaks.push(at(i / count))
  breaks.push(sorted[sorted.length - 1]!)
  return breaks
}

export function buildInterpolatedImage(
  pts: InterpPoint[],
  method: InterpMethod = 'idw',
  bands: ColorBand[] | null = null,
  quartileColors: string[] | null = null,
  gridSize = 260,
): InterpolatedImage | null {
  if (pts.length < 3) return null

  const hull = convexHull(pts)
  if (hull.length < 3) return null

  // Motor de interpolacion: kriging (con fallback a IDW si el ajuste no converge) o IDW.
  let predictAt: (lon: number, lat: number) => number
  if (method === 'kriging') {
    const sub = subsample(pts, MAX_KRIGING_POINTS)
    const variogram = krigingTrain(
      sub.map((p) => p.value),
      sub.map((p) => p.lon),
      sub.map((p) => p.lat),
    )
    predictAt = variogram
      ? (lon, lat) => krigingPredict(lon, lat, variogram)
      : (lon, lat) => idwValue(lon, lat, pts)
  } else {
    predictAt = (lon, lat) => idwValue(lon, lat, pts)
  }

  const xs = hull.map((c) => c[0]!)
  const ys = hull.map((c) => c[1]!)
  const xmin = Math.min(...xs)
  const xmax = Math.max(...xs)
  const ymin = Math.min(...ys)
  const ymax = Math.max(...ys)
  if (xmax === xmin || ymax === ymin) return null

  const values = pts.map((p) => p.value)
  const vmin = Math.min(...values)
  const vmax = Math.max(...values)
  // Arreglo ordenado para el mapeo de color por percentiles (ecualizacion).
  const sorted = [...values].sort((a, b) => a - b)

  const w = gridSize
  const h = Math.max(1, Math.round((gridSize * (ymax - ymin)) / (xmax - xmin)))

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  const img = ctx.createImageData(w, h)

  for (let row = 0; row < h; row++) {
    const lat = ymax - (row / (h - 1)) * (ymax - ymin)
    for (let col = 0; col < w; col++) {
      const lon = xmin + (col / (w - 1)) * (xmax - xmin)
      const idx = (row * w + col) * 4
      if (!pointInRing(lon, lat, hull)) {
        img.data[idx + 3] = 0
        continue
      }
      const v = predictAt(lon, lat)
      if (Number.isNaN(v)) {
        img.data[idx + 3] = 0
        continue
      }
      // Manual: color por banda de la config. Quartile con colores: clase discreta
      // por percentil. Sin colores: gradiente continuo ecualizado.
      let rgb: [number, number, number] | null
      if (bands) {
        rgb = bandColor(v, bands)
      } else if (quartileColors && quartileColors.length > 0) {
        const cls = Math.min(quartileColors.length - 1, Math.floor(rankFraction(v, sorted) * quartileColors.length))
        rgb = hexToRgb(quartileColors[cls]!)
      } else {
        rgb = rampColor(rankFraction(v, sorted))
      }
      if (!rgb) {
        img.data[idx + 3] = 0
        continue
      }
      img.data[idx] = rgb[0]
      img.data[idx + 1] = rgb[1]
      img.data[idx + 2] = rgb[2]
      img.data[idx + 3] = 255
    }
  }

  ctx.putImageData(img, 0, 0)

  return {
    dataUrl: canvas.toDataURL('image/png'),
    coordinates: [
      [xmin, ymax],
      [xmax, ymax],
      [xmax, ymin],
      [xmin, ymin],
    ],
    min: vmin,
    max: vmax,
  }
}
