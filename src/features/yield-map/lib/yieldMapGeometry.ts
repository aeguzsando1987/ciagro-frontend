import { rectangleRing } from '@/features/task-manager/lib/plotRectangles'
import type { YieldMapPoint } from '../types'
import { yieldBucket, type YieldClass } from './yieldMapLayers'

export interface YieldRectProps {
  id: string
  bucket: string
  yield_t_ha: number | null
  moisture_pct: number | null
  speed_kmh: number | null
  grain_flow_t_h: number | null
  elevation_m: number | null
  course_deg: number | null
  swath_width_m: number | null
  distance_m: number | null
  area_ha: number | null
  grain_mass_t: number | null
  pass_number: number | null
}

export function yieldPointsToRectangles(
  points: YieldMapPoint[],
  activeValue: (point: YieldMapPoint) => number | null,
  classes: YieldClass[],
): GeoJSON.FeatureCollection<GeoJSON.Polygon, YieldRectProps> {
  const features: GeoJSON.Feature<GeoJSON.Polygon, YieldRectProps>[] = []
  for (const point of points) {
    const coords = point.geom?.coordinates
    if (!coords || coords.length < 2) continue
    const lon = Number(coords[0])
    const lat = Number(coords[1])
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue
    const width = Number(point.swath_width_m ?? 0)
    const distance = Number(point.distance_m ?? 0)
    if (!(width > 0) || !(distance > 0)) continue
    const heading = Number(point.course_deg ?? point.vehicle_heading ?? 0)
    const bucket = yieldBucket(activeValue(point), classes)
    if (!bucket) continue
    features.push({
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: [rectangleRing(lon, lat, heading, width, distance)] },
      properties: {
        id: point.id,
        bucket,
        yield_t_ha: point.yield_t_ha,
        moisture_pct: point.moisture_pct,
        speed_kmh: point.speed_kmh,
        grain_flow_t_h: point.grain_flow_t_h,
        elevation_m: point.elevation_m,
        course_deg: point.course_deg,
        swath_width_m: point.swath_width_m,
        distance_m: point.distance_m,
        area_ha: point.area_ha,
        grain_mass_t: point.grain_mass_t,
        pass_number: point.pass_number,
      },
    })
  }
  return { type: 'FeatureCollection', features }
}

/**
 * Respaldo visual para monitores que entregan coordenadas + rendimiento pero no
 * ancho/distancia de pasada. Así una importación válida nunca queda como mapa vacío:
 * cuando no podemos formar rectángulos, mostramos las lecturas como puntos coloreados.
 */
export function yieldPointsToPointFeatures(
  points: YieldMapPoint[],
  activeValue: (point: YieldMapPoint) => number | null,
  classes: YieldClass[],
): GeoJSON.FeatureCollection<GeoJSON.Point, YieldRectProps> {
  const features: GeoJSON.Feature<GeoJSON.Point, YieldRectProps>[] = []
  for (const point of points) {
    const coords = point.geom?.coordinates
    if (!coords || coords.length < 2) continue
    const lon = Number(coords[0])
    const lat = Number(coords[1])
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue
    const bucket = yieldBucket(activeValue(point), classes)
    if (!bucket) continue
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [lon, lat] },
      properties: {
        id: point.id,
        bucket,
        yield_t_ha: point.yield_t_ha,
        moisture_pct: point.moisture_pct,
        speed_kmh: point.speed_kmh,
        grain_flow_t_h: point.grain_flow_t_h,
        elevation_m: point.elevation_m,
        course_deg: point.course_deg,
        swath_width_m: point.swath_width_m,
        distance_m: point.distance_m,
        area_ha: point.area_ha,
        grain_mass_t: point.grain_mass_t,
        pass_number: point.pass_number,
      },
    })
  }
  return { type: 'FeatureCollection', features }
}
