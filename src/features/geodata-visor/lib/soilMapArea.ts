export type SoilAreaSource = 'plot' | 'plot_geometry'

export interface SoilMapBoundary {
  ring: number[][]
  totalAreaHa: number
  source: SoilAreaSource
}

export interface SoilBucketAreaStat {
  count: number
  percentage: number
  areaHa: number | null
}

function isFiniteCoordinate(point: number[] | undefined): point is [number, number] {
  return Boolean(point && Number.isFinite(point[0]) && Number.isFinite(point[1]))
}

function closeRing(points: Array<[number, number]>) {
  if (points.length === 0) return []
  const first = points[0]!
  const last = points[points.length - 1]!
  return first[0] === last[0] && first[1] === last[1] ? points : [...points, first]
}

/**
 * Área aproximada en hectáreas usando una proyección equirectangular local.
 * Para parcelas agrícolas pequeñas la diferencia frente a PostGIS/UTM es mínima.
 */
export function polygonAreaHa(ring: number[][]) {
  const valid = ring.filter(isFiniteCoordinate)
  if (valid.length < 3) return 0

  const closed = closeRing(valid)
  const latitudeReference = closed.reduce((total, point) => total + point[1], 0) / closed.length
  const metersPerDegree = 111_320
  const longitudeScale = Math.cos((latitudeReference * Math.PI) / 180)

  let twiceAreaM2 = 0
  for (let index = 0; index < closed.length - 1; index += 1) {
    const current = closed[index]!
    const next = closed[index + 1]!
    const currentX = current[0] * metersPerDegree * longitudeScale
    const currentY = current[1] * metersPerDegree
    const nextX = next[0] * metersPerDegree * longitudeScale
    const nextY = next[1] * metersPerDegree
    twiceAreaM2 += currentX * nextY - nextX * currentY
  }

  return Math.abs(twiceAreaM2) / 2 / 10_000
}

function positiveArea(value: string | number | null | undefined) {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(value ?? '')
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

/**
 * Fuente de verdad del área:
 * 1. polígono + `properties.total_area` del endpoint de la parcela;
 * 2. área calculada del polígono si el total todavía no fue persistido;
 *
 * Sin polígono no se inventa un límite con la nube de muestras: una coordenada
 * atípica podría convertir una parcela pequeña en miles de hectáreas.
 */
export function resolveSoilMapBoundary(
  plotRing: number[][] | null | undefined,
  plotTotalArea: string | number | null | undefined
): SoilMapBoundary | null {
  const validPlotRing = plotRing?.filter(isFiniteCoordinate) ?? []
  if (validPlotRing.length >= 3) {
    const ring = closeRing(validPlotRing)
    const endpointArea = positiveArea(plotTotalArea)
    const geometryArea = polygonAreaHa(ring)
    const totalAreaHa = endpointArea ?? positiveArea(geometryArea)
    if (totalAreaHa) {
      return {
        ring,
        totalAreaHa,
        source: endpointArea ? 'plot' : 'plot_geometry',
      }
    }
  }

  return null
}

function areaStatsFromCounts(
  bucketKeys: readonly string[],
  counts: Record<string, number>,
  totalAreaHa: number | null
) {
  const total = bucketKeys.reduce((sum, key) => sum + (counts[key] ?? 0), 0)
  return Object.fromEntries(
    bucketKeys.map((key) => {
      const count = counts[key] ?? 0
      const percentage = total > 0 ? (count / total) * 100 : 0
      return [
        key,
        {
          count,
          percentage,
          areaHa: totalAreaHa != null ? (percentage / 100) * totalAreaHa : null,
        },
      ]
    })
  ) as Record<string, SoilBucketAreaStat>
}

/** Fallback para variables categóricas, que se siguen mostrando como muestras. */
export function buildSoilBucketAreaStats(
  bucketKeys: readonly string[],
  sampleBuckets: readonly string[],
  totalAreaHa: number | null
) {
  const counts = Object.fromEntries(bucketKeys.map((key) => [key, 0])) as Record<string, number>
  for (const bucket of sampleBuckets) {
    if (bucket in counts) counts[bucket] = (counts[bucket] ?? 0) + 1
  }

  return areaStatsFromCounts(bucketKeys, counts, totalAreaHa)
}

/**
 * Calcula porcentajes y hectáreas desde las celdas de la superficie interpolada.
 * Cada celda clasificada representa una porción del polígono, por lo que el
 * reparto es espacial y deja de depender de cuántas muestras caen en cada cuantil.
 */
export function buildSoilRasterAreaStats(
  bucketKeys: readonly string[],
  bucketCellCounts: Record<string, number>,
  totalAreaHa: number | null
) {
  return areaStatsFromCounts(bucketKeys, bucketCellCounts, totalAreaHa)
}
