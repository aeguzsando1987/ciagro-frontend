/**
 * Valores de UNA capa del mapa de suelo, indexados por id de punto.
 *
 * GET /api/v1/monitoring/soil-map/points/?smh_header=<id>&fields=id,<campo>
 *
 * El Visor pinta una capa de 49 a la vez. Pedir los 57 campos de cada punto para
 * usar uno significaba mover el ancho completo de la tabla: 22.83 MB por sesión
 * contra 1.03 MB de una capa suelta.
 *
 * No se pide `geom`: la geometría ya vino en la precarga (`useSoilMapPoints`) y
 * repetirla en cada cambio de capa duplicaría el payload. La unión se hace por
 * `id`, que el backend incluye siempre aunque no se pida.
 */
import { queryOptions, useQuery } from '@tanstack/react-query'
import { fetchSoilMapPointPages } from './useSoilMapPoints'

/** Valor crudo de una capa: número en las numéricas, texto en las categóricas. */
export type SoilMapLayerValue = number | string

/** Lo que devuelve el endpoint con `fields=id,<campo>`: el id y una sola clave más. */
type SoilMapValueRow = { id: string } & Record<string, unknown>

export const SOIL_MAP_LAYER_VALUES_KEY = 'soil-map-layer-values'

export async function fetchSoilMapLayerData(headerId: string, field: string) {
  const fields =
    field === 'Elevation' ? 'id,Elevation,elevation_unit,elevation_relative_pct' : `id,${field}`
  const rows = await fetchSoilMapPointPages<SoilMapValueRow>(headerId, fields)

  const values = new Map<string, SoilMapLayerValue>()
  const relativeElevations = new Map<string, number>()
  for (const row of rows) {
    // Un backend anterior no declara metros: evita etiquetar pies como metros
    // durante un despliegue con versiones diferentes.
    if (field === 'Elevation' && row.elevation_unit !== 'm') {
      throw new Error('La API de elevación debe actualizarse a metros.')
    }
    const raw = row[field]
    // Los nulos no se guardan: `buildSamples` trata "sin entrada en el Map" y
    // "valor nulo" como lo mismo —el punto no se pinta— y una sola forma de
    // representar la ausencia evita que las dos se desincronicen.
    if (typeof raw === 'number' || typeof raw === 'string') {
      values.set(row.id, raw)
    }
    if (
      typeof row.elevation_relative_pct === 'number' &&
      Number.isFinite(row.elevation_relative_pct)
    ) {
      relativeElevations.set(row.id, row.elevation_relative_pct)
    }
  }
  return { values, relativeElevations }
}

export async function fetchSoilMapLayerValues(headerId: string, field: string) {
  return (await fetchSoilMapLayerData(headerId, field)).values
}

function layerDataOptions(headerId: string | null, field: string | null, enabled: boolean) {
  return queryOptions({
    queryKey: [SOIL_MAP_LAYER_VALUES_KEY, headerId, field] as const,
    enabled: !!headerId && !!field && enabled,
    queryFn: () => fetchSoilMapLayerData(headerId!, field!),
    staleTime: 5 * 60_000,
  })
}

/**
 * `staleTime` de 5 minutos: volver a una capa ya vista se resuelve desde el caché
 * de react-query, sin red. Los valores solo cambian si se reimporta la sesión.
 */
export function useSoilMapLayerValues(
  headerId: string | null,
  field: string | null,
  enabled = true
) {
  return useQuery({
    ...layerDataOptions(headerId, field, enabled),
    select: (data) => data.values,
  })
}

/** Comparte petición y caché con Elevation: no descarga otra copia de los puntos. */
export function useSoilMapRelativeElevations(headerId: string | null, enabled: boolean) {
  return useQuery({
    ...layerDataOptions(headerId, 'Elevation', enabled),
    select: (data) => data.relativeElevations,
  })
}
