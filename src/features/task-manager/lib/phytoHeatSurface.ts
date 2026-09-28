export interface PhytoHeatPoint {
  lon: number
  lat: number
  /** Valor normalizado de 0 a 1. */
  value: number
}

export interface PhytoHeatSurface {
  dataUrl: string
  coordinates: [[number, number], [number, number], [number, number], [number, number]]
  /** Fracción del área interpolada clasificada como problemática (amarillo/naranja/rojo). */
  problemFraction: number
}

type HeatClass = 'veryLow' | 'low' | 'medium' | 'high' | 'veryHigh'

const CLASS_BREAKS: Array<{ max: number; cls: HeatClass }> = [
  { max: 0.18, cls: 'veryLow' },
  { max: 0.38, cls: 'low' },
  { max: 0.58, cls: 'medium' },
  { max: 0.78, cls: 'high' },
  { max: Number.POSITIVE_INFINITY, cls: 'veryHigh' },
]

const CLASS_COLOR: Record<HeatClass, [number, number, number]> = {
  veryLow: [22, 128, 61],
  low: [132, 204, 92],
  medium: [245, 238, 169],
  high: [251, 176, 89],
  veryHigh: [220, 73, 57],
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function classify(value: number): HeatClass {
  const normalized = clamp01(value)
  for (const band of CLASS_BREAKS) {
    if (normalized < band.max) return band.cls
  }
  return 'veryHigh'
}

function pointInRing(lon: number, lat: number, ring: number[][]): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i]![0]!
    const yi = ring[i]![1]!
    const xj = ring[j]![0]!
    const yj = ring[j]![1]!
    const intersects =
      yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / ((yj - yi) || Number.EPSILON) + xi
    if (intersects) inside = !inside
  }
  return inside
}

function idwValue(lon: number, lat: number, points: PhytoHeatPoint[], cosLat: number): number {
  let numerator = 0
  let denominator = 0

  for (const point of points) {
    const dx = (lon - point.lon) * cosLat
    const dy = lat - point.lat
    const distanceSquared = dx * dx + dy * dy
    if (distanceSquared < 1e-16) return clamp01(point.value)

    const weight = 1 / Math.pow(distanceSquared, 0.95)
    numerator += weight * clamp01(point.value)
    denominator += weight
  }

  return denominator > 0 ? clamp01(numerator / denominator) : 0
}

function blurGrid(src: Float32Array, width: number, height: number, radius: number): Float32Array {
  if (radius < 1) return src
  const r = Math.round(radius)
  let current = src

  for (let pass = 0; pass < 2; pass++) {
    const horizontal = new Float32Array(width * height)
    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        let sum = 0
        let count = 0
        for (let k = Math.max(0, col - r); k <= Math.min(width - 1, col + r); k++) {
          const value = current[row * width + k]!
          if (!Number.isNaN(value)) {
            sum += value
            count++
          }
        }
        horizontal[row * width + col] = count ? sum / count : Number.NaN
      }
    }

    const vertical = new Float32Array(width * height)
    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        let sum = 0
        let count = 0
        for (let k = Math.max(0, row - r); k <= Math.min(height - 1, row + r); k++) {
          const value = horizontal[k * width + col]!
          if (!Number.isNaN(value)) {
            sum += value
            count++
          }
        }
        vertical[row * width + col] = count ? sum / count : Number.NaN
      }
    }

    current = vertical
  }

  return current
}

/**
 * Construye una superficie interpolada por IDW, recortada exactamente al polígono de la
 * parcela y clasificada por bandas de color al estilo QGIS.
 */
export function buildPhytoHeatSurface(
  points: PhytoHeatPoint[],
  ring: number[][],
  width = 420
): PhytoHeatSurface | null {
  if (typeof document === 'undefined' || points.length === 0 || ring.length < 3) return null

  const lons = ring.map((point) => point[0]!)
  const lats = ring.map((point) => point[1]!)
  const west = Math.min(...lons)
  const east = Math.max(...lons)
  const south = Math.min(...lats)
  const north = Math.max(...lats)
  if (east <= west || north <= south) return null

  const midLat = (north + south) / 2
  const cosLat = Math.max(0.15, Math.cos((midLat * Math.PI) / 180))
  const geoWidth = Math.max((east - west) * cosLat, 1e-9)
  const geoHeight = north - south
  const height = Math.max(120, Math.min(520, Math.round(width * (geoHeight / geoWidth))))

  const values = new Float32Array(width * height)
  values.fill(Number.NaN)

  // Con 1 o 2 puntos no hay suficientes muestras para estimar toda la parcela con
  // confianza. Por eso solo pintamos una zona local de influencia alrededor de las
  // muestras. El resto queda transparente y se conserva el verde base de la parcela.
  // Con 3 o más puntos sí se interpola toda la parcela.
  const sparseSampling = points.length <= 2
  const parcelDiagonal = Math.hypot(geoWidth, geoHeight)
  const influenceRadius = parcelDiagonal * (points.length === 1 ? 0.16 : 0.20)

  for (let row = 0; row < height; row++) {
    const lat = north - ((row + 0.5) / height) * (north - south)
    for (let col = 0; col < width; col++) {
      const lon = west + ((col + 0.5) / width) * (east - west)
      if (!pointInRing(lon, lat, ring)) continue

      if (sparseSampling) {
        let nearestDistance = Number.POSITIVE_INFINITY
        for (const point of points) {
          const dx = (lon - point.lon) * cosLat
          const dy = lat - point.lat
          nearestDistance = Math.min(nearestDistance, Math.hypot(dx, dy))
        }
        if (nearestDistance > influenceRadius) continue
      }

      values[row * width + col] = idwValue(lon, lat, points, cosLat)
    }
  }

  const smoothed = blurGrid(
    values,
    width,
    height,
    sparseSampling ? Math.max(1, width / 180) : Math.max(1, width / 120)
  )

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) return null

  const image = context.createImageData(width, height)
  let insideCount = 0
  let problemCount = 0

  for (let i = 0; i < smoothed.length; i++) {
    const offset = i * 4
    const value = smoothed[i]!
    if (Number.isNaN(value)) {
      image.data[offset + 3] = 0
      continue
    }

    insideCount++
    const cls = classify(value)
    const color = CLASS_COLOR[cls]
    image.data[offset] = color[0]
    image.data[offset + 1] = color[1]
    image.data[offset + 2] = color[2]
    image.data[offset + 3] = 208

    if (cls === 'medium' || cls === 'high' || cls === 'veryHigh') problemCount++
  }

  context.putImageData(image, 0, 0)

  return {
    dataUrl: canvas.toDataURL('image/png'),
    coordinates: [
      [west, north],
      [east, north],
      [east, south],
      [west, south],
    ],
    problemFraction: insideCount > 0 ? problemCount / insideCount : 0,
  }
}
