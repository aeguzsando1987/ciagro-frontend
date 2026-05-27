/**
 * Geometría de los rectángulos de telemetría de aspersión.
 *
 * El backend entrega cada punto como un objeto plano con `geom` (GeoJSON Point) y
 * los demás campos como decimal-strings. Aquí convertimos cada punto en el polígono
 * rectangular orientado que lo representa en el mapa de calor:
 *   - centro      = geom (lon/lat)
 *   - orientación = course_deg (fallback vehicle_heading) — rumbo de brújula 0°=Norte
 *   - base        = boom_width_m (ancho del brazo aspersor)
 *   - altura      = distance_m (avance del vehículo en el intervalo)
 *
 * Decisión 6.B.0 (propose): geometría por trigonometría manual con aproximación plana
 * metros→grados, SIN dependencias nuevas (regla crítica #2). A esta escala
 * (rectángulos de ~2–14 m × ~1.3 m, latitud ≈ 20.5°N) el error por ignorar la
 * curvatura terrestre es sub-centimétrico, irrelevante frente al tamaño del rectángulo.
 */
import type { components } from '@/types/api'

/** Punto de telemetría tal como lo entrega el backend (campos numéricos como decimal-string). */
export type AspersionPoint = components['schemas']['AspersionSessionPoints']

/** Metros por grado de latitud (constante WGS84 esférica aprox.). */
const M_PER_DEG_LAT = 111_320

/** Convierte un decimal-string del backend a number, o null si falta/no es finito. */
export function parseDecimal(value: string | null | undefined): number | null {
  if (value == null) return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

/** Propiedades numéricas que viajan con cada rectángulo (para color, filtro y tooltip). */
export interface RectangleProps {
  id: string
  lon: number
  lat: number
  course_deg: number
  boom_width_m: number
  distance_m: number
  applied_rate_l: number | null
  target_rate_l: number | null
  liquid_flow_ls: number | null
  boom_pressure_bar: number | null
  production_hah: number | null
  speed_kmh: number | null
  /** Superficie del punto en hectáreas (para sumar área total y por categoría). */
  area_ha: number | null
  /** Categoría/cuartil de la capa activa; lo escribe el visor antes de pintar (ver aspersionLayers). */
  bucket?: string
}

/**
 * Calcula el anillo cerrado (5 posiciones [lon,lat]) del rectángulo orientado de un punto.
 *
 * Sistema local: eje +Y = avance del vehículo (rumbo), eje +X = a la derecha (ancho del brazo).
 * Un rumbo de brújula H (0°=Norte, horario) define:
 *   adelante f = (sin H, cos H)  en (este, norte)
 *   derecha  r = (cos H, -sin H) en (este, norte)
 * Por eso una esquina local (x,y) se proyecta a:
 *   este  = x·cos H + y·sin H
 *   norte = -x·sin H + y·cos H
 * y luego se convierte de metros a grados con el factor de cada eje.
 */
export function rectangleRing(
  lon: number,
  lat: number,
  headingDeg: number,
  widthM: number,
  heightM: number,
): GeoJSON.Position[] {
  const mPerDegLon = M_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180)
  const halfWidth = widthM / 2
  const halfHeight = heightM / 2
  const rad = (headingDeg * Math.PI) / 180
  const sin = Math.sin(rad)
  const cos = Math.cos(rad)

  // Esquinas locales (x = ancho, y = avance), recorridas en orden para formar el polígono.
  const localCorners: ReadonlyArray<readonly [number, number]> = [
    [-halfWidth, -halfHeight],
    [halfWidth, -halfHeight],
    [halfWidth, halfHeight],
    [-halfWidth, halfHeight],
  ]

  const ring: GeoJSON.Position[] = localCorners.map(([x, y]) => {
    const east = x * cos + y * sin
    const north = -x * sin + y * cos
    return [lon + east / mPerDegLon, lat + north / M_PER_DEG_LAT]
  })
  ring.push(ring[0]!) // cerrar el anillo
  return ring
}

/**
 * Convierte la lista de puntos del backend en un FeatureCollection de rectángulos listo
 * para MapLibre. Descarta puntos sin geom, sin ancho de brazo o sin distancia (no se
 * puede dibujar un rectángulo sin esos tres datos). El rumbo usa course_deg y cae a
 * vehicle_heading, o 0 si ambos faltan.
 */
export function pointsToRectangleCollection(
  points: AspersionPoint[],
): GeoJSON.FeatureCollection<GeoJSON.Polygon, RectangleProps> {
  const features: GeoJSON.Feature<GeoJSON.Polygon, RectangleProps>[] = []

  for (const point of points) {
    const coords = point.geom?.coordinates
    if (!coords || coords.length < 2) continue
    const lon = coords[0]!
    const lat = coords[1]!

    const widthM = parseDecimal(point.boom_width_m)
    const heightM = parseDecimal(point.distance_m)
    if (widthM == null || widthM <= 0 || heightM == null || heightM <= 0) continue

    const headingDeg = parseDecimal(point.course_deg) ?? parseDecimal(point.vehicle_heading) ?? 0
    const ring = rectangleRing(lon, lat, headingDeg, widthM, heightM)

    features.push({
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: [ring] },
      properties: {
        id: point.id,
        lon,
        lat,
        course_deg: headingDeg,
        boom_width_m: widthM,
        distance_m: heightM,
        applied_rate_l: parseDecimal(point.applied_rate_l),
        target_rate_l: parseDecimal(point.target_rate_l),
        liquid_flow_ls: parseDecimal(point.liquid_flow_ls),
        boom_pressure_bar: parseDecimal(point.boom_pressure_bar),
        production_hah: parseDecimal(point.production_hah),
        speed_kmh: parseDecimal(point.speed_kmh),
        area_ha: parseDecimal(point.area_ha),
      },
    })
  }

  return { type: 'FeatureCollection', features }
}
