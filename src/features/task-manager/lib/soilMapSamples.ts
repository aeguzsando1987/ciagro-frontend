/**
 * Union de la precarga geométrica con los valores de una capa.
 *
 * El Visor carga los puntos en dos partes: primero dónde están (`id` + `geom`,
 * `useSoilMapPoints`) y después qué valen en la capa activa (`id` + valor,
 * `useSoilMapLayerValues`). Esta función las junta por `id`.
 *
 * Es el punto donde puede fallar toda la fase de forma silenciosa: si las dos
 * fuentes se desalinean, el mapa pinta valores creíbles en los puntos
 * equivocados y no hay nada visible que lo delate. Por eso vive aparte, pura y
 * con test propio, en vez de estar enterrada en el componente.
 */
import type { SoilMapLayerDef } from './soilMapLayers'
import type { SoilMapLayerValue } from '../hooks/useSoilMapLayerValues'

export interface SoilMapPointGeometry {
  id: string
  geom: { coordinates?: number[] | null } | null
}

export interface SoilMapSample {
  id: string
  lng: number
  lat: number
  value: number | string
}

/**
 * Descarta un punto cuando no tiene coordenadas usables o cuando no tiene valor
 * en la capa activa. El criterio por tipo de capa es el mismo de siempre: en las
 * numéricas solo pasan los números finitos, y en las categóricas solo el texto
 * no vacío. Un punto sin entrada en `values` simplemente no se pinta.
 */
export function buildSamples(
  points: SoilMapPointGeometry[] | undefined,
  values: Map<string, SoilMapLayerValue> | undefined,
  layer: SoilMapLayerDef
): SoilMapSample[] {
  if (!points || !values) return []
  const samples: SoilMapSample[] = []

  for (const point of points) {
    const coordinates = point.geom?.coordinates
    if (
      !coordinates ||
      coordinates.length < 2 ||
      !Number.isFinite(coordinates[0]) ||
      !Number.isFinite(coordinates[1])
    ) {
      continue
    }

    const rawValue = values.get(point.id)
    if (layer.kind === 'numeric') {
      if (typeof rawValue !== 'number' || !Number.isFinite(rawValue)) continue
      samples.push({
        id: point.id,
        lng: coordinates[0]!,
        lat: coordinates[1]!,
        value: rawValue,
      })
      continue
    }

    if (typeof rawValue !== 'string' || rawValue.trim() === '') continue
    samples.push({
      id: point.id,
      lng: coordinates[0]!,
      lat: coordinates[1]!,
      value: rawValue.trim(),
    })
  }

  return samples
}
