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
import { useQuery } from '@tanstack/react-query'
import { fetchSoilMapPointPages } from './useSoilMapPoints'

/** Valor crudo de una capa: número en las numéricas, texto en las categóricas. */
export type SoilMapLayerValue = number | string

/** Lo que devuelve el endpoint con `fields=id,<campo>`: el id y una sola clave más. */
type SoilMapValueRow = { id: string } & Record<string, unknown>

export const SOIL_MAP_LAYER_VALUES_KEY = 'soil-map-layer-values'

export async function fetchSoilMapLayerValues(
  headerId: string,
  field: string
): Promise<Map<string, SoilMapLayerValue>> {
  const rows = await fetchSoilMapPointPages<SoilMapValueRow>(headerId, `id,${field}`)

  const values = new Map<string, SoilMapLayerValue>()
  for (const row of rows) {
    const raw = row[field]
    // Los nulos no se guardan: `buildSamples` trata "sin entrada en el Map" y
    // "valor nulo" como lo mismo —el punto no se pinta— y una sola forma de
    // representar la ausencia evita que las dos se desincronicen.
    if (typeof raw === 'number' || typeof raw === 'string') {
      values.set(row.id, raw)
    }
  }
  return values
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
    queryKey: [SOIL_MAP_LAYER_VALUES_KEY, headerId, field] as const,
    enabled: !!headerId && !!field && enabled,
    queryFn: () => fetchSoilMapLayerValues(headerId!, field!),
    staleTime: 5 * 60_000,
  })
}
