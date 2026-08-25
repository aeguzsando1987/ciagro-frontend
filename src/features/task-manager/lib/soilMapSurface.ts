import { numericBucket } from './soilMapLayers'

export interface SoilSample {
  lng: number
  lat: number
  value: number
}

export interface SoilSurfaceAnalysis {
  min: number
  max: number
  breaks: number[]
  bucketCellCounts: Record<string, number>
}

const MAX_INTERPOLATION_SAMPLES = 1_000
const IDW_NEIGHBORS = 2

export function pointInRing(lng: number, lat: number, ring: number[][]) {
  let inside = false
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
    const currentPoint = ring[index]!
    const previousPoint = ring[previous]!
    const currentLng = currentPoint[0]!
    const currentLat = currentPoint[1]!
    const previousLng = previousPoint[0]!
    const previousLat = previousPoint[1]!
    const intersects =
      currentLat > lat !== previousLat > lat &&
      lng <
        ((previousLng - currentLng) * (lat - currentLat)) /
          (previousLat - currentLat || Number.EPSILON) +
          currentLng
    if (intersects) inside = !inside
  }
  return inside
}

/**
 * Interpolación IDW local. Usa las dos muestras más cercanas para conservar
 * la variación espacial; ponderar toda la parcela aplana los extremos y
 * produce áreas artificialmente concentradas en los rangos centrales.
 */
export function interpolateIdw(
  lng: number,
  lat: number,
  samples: SoilSample[],
  latitudeReference = lat
) {
  const longitudeScale = Math.cos((latitudeReference * Math.PI) / 180)
  const nearest: Array<{ distanceSquared: number; value: number }> = []

  for (const sample of samples) {
    const deltaLng = (lng - sample.lng) * longitudeScale
    const deltaLat = lat - sample.lat
    const distanceSquared = deltaLng * deltaLng + deltaLat * deltaLat
    if (distanceSquared < 1e-16) return sample.value

    const candidate = { distanceSquared, value: sample.value }
    const insertAt = nearest.findIndex((current) => distanceSquared < current.distanceSquared)
    if (insertAt >= 0) nearest.splice(insertAt, 0, candidate)
    else if (nearest.length < IDW_NEIGHBORS) nearest.push(candidate)
    if (nearest.length > IDW_NEIGHBORS) nearest.pop()
  }

  let weightedTotal = 0
  let weightTotal = 0
  for (const sample of nearest) {
    const weight = 1 / sample.distanceSquared
    weightedTotal += sample.value * weight
    weightTotal += weight
  }
  return weightTotal > 0 ? weightedTotal / weightTotal : null
}

function interpolationSamples(samples: SoilSample[]) {
  if (samples.length <= MAX_INTERPOLATION_SAMPLES) return samples
  const step = samples.length / MAX_INTERPOLATION_SAMPLES
  return Array.from(
    { length: MAX_INTERPOLATION_SAMPLES },
    (_, index) => samples[Math.floor(index * step)]!
  )
}

function quantile(sorted: number[], position: number) {
  const index = (sorted.length - 1) * position
  const lower = Math.floor(index)
  const fraction = index - lower
  const low = sorted[lower]!
  const high = sorted[Math.min(lower + 1, sorted.length - 1)]!
  return low + (high - low) * fraction
}

export interface AnalyzeSoilSurfaceOptions {
  ring: number[][]
  samples: SoilSample[]
  paletteSize: number
  maxSize?: number
}

/**
 * Reproduce el flujo estadístico de un raster GIS:
 * 1. interpola todo el rectángulo que contiene la parcela;
 * 2. obtiene los cuantiles desde ese raster completo;
 * 3. recorta con el polígono y cuenta las celdas de cada clase.
 *
 * Calcular los cortes desde los puntos crudos conserva outliers que el raster
 * suaviza y produce límites distintos a los reportes exportados.
 */
export function analyzeSoilSurface({
  ring,
  samples,
  paletteSize,
  maxSize = 260,
}: AnalyzeSoilSurfaceOptions): SoilSurfaceAnalysis | null {
  if (ring.length < 3 || samples.length < 3 || paletteSize === 0) return null

  const lngValues = ring.map((point) => point[0]!).filter(Number.isFinite)
  const latValues = ring.map((point) => point[1]!).filter(Number.isFinite)
  if (lngValues.length === 0 || latValues.length === 0) return null

  const minLng = Math.min(...lngValues)
  const maxLng = Math.max(...lngValues)
  const minLat = Math.min(...latValues)
  const maxLat = Math.max(...latValues)
  if (minLng === maxLng || minLat === maxLat) return null

  const latitudeReference = (minLat + maxLat) / 2
  const widthMeters = (maxLng - minLng) * Math.cos((latitudeReference * Math.PI) / 180)
  const heightMeters = maxLat - minLat
  const aspect = widthMeters / heightMeters
  const width = Math.max(96, Math.round(aspect >= 1 ? maxSize : maxSize * aspect))
  const height = Math.max(96, Math.round(aspect >= 1 ? maxSize / aspect : maxSize))
  const selectedSamples = interpolationSamples(samples)
  const values = new Float64Array(width * height)
  const inside = new Uint8Array(width * height)

  for (let y = 0; y < height; y += 1) {
    const lat = maxLat - ((y + 0.5) / height) * (maxLat - minLat)
    for (let x = 0; x < width; x += 1) {
      const lng = minLng + ((x + 0.5) / width) * (maxLng - minLng)
      const pixelIndex = y * width + x
      const value = interpolateIdw(lng, lat, selectedSamples, latitudeReference)
      if (value == null) return null
      values[pixelIndex] = value
      if (pointInRing(lng, lat, ring)) inside[pixelIndex] = 1
    }
  }

  const sorted = Array.from(values).sort((left, right) => left - right)
  const min = sorted[0]!
  const max = sorted[sorted.length - 1]!
  const breaks = Array.from({ length: Math.max(0, paletteSize - 1) }, (_, index) =>
    quantile(sorted, (index + 1) / paletteSize)
  )
  const bucketCellCounts: Record<string, number> = {}

  for (let index = 0; index < values.length; index += 1) {
    if (!inside[index]) continue
    const bucket = numericBucket(values[index]!, breaks, paletteSize)
    bucketCellCounts[bucket] = (bucketCellCounts[bucket] ?? 0) + 1
  }

  return { min, max, breaks, bucketCellCounts }
}
