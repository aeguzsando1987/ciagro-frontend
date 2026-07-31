/**
 * Contornos (coropleta) de un indice NDVI de una sesion, como FeatureCollection GeoJSON.
 *
 * GET /api/v1/monitoring/ndvi/headers/<id>/contours/?index=<clave>
 *
 * El backend precalcula las bandas (interpolacion IDW -> reclass por la config del tenant ->
 * poligonos). Cada feature trae en properties: index_key, band_order, band_min, band_max,
 * label y color (#hex). El mapa las pinta con fill-color = ['get','color'] y arma la leyenda.
 */
import { queryOptions, useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api/client'

export interface NdviBandProps {
  id: string
  index_key: string
  band_order: number
  band_min: number | null
  band_max: number | null
  label: string | null
  color: string | null
  value_mode: string
}

export type NdviContourCollection = GeoJSON.FeatureCollection<GeoJSON.MultiPolygon, NdviBandProps>

export const NDVI_CONTOURS_KEY = ['ndvi', 'contours'] as const

/**
 * `dcId` es la CIAgro del workspace activo: la coropleta se genera con la config de SU
 * organizacion, asi que dos workspaces sobre la misma sesion devuelven bandas distintas
 * y no pueden compartir entrada de cache.
 *
 * El backend genera de forma perezosa: si esa organizacion aun no tiene coropleta
 * responde 202 y la encola. Aqui se reintenta hasta que este lista.
 */
export function ndviContoursQueryOptions(
  headerId: string | null,
  index: string | null,
  dcId?: string,
) {
  return queryOptions({
    queryKey: [
      ...NDVI_CONTOURS_KEY,
      { header: headerId ?? null, index: index ?? null, dc: dcId ?? null },
    ] as const,
    enabled: !!headerId && !!index,
    queryFn: async (): Promise<NdviContourCollection> => {
      const { data, error, response } = await apiClient.GET(
        '/api/v1/monitoring/ndvi/headers/{id}/contours/',
        {
          params: {
            path: { id: headerId as string },
            query: { index, ...(dcId ? { dc: dcId } : {}) } as never,
          },
        },
      )
      if (response.status === 202) {
        // Aun generandose: se lanza para que react-query reintente con backoff.
        throw new Error('CONTOURS_PROCESSING')
      }
      if (error) throw new Error('No se pudieron cargar los contornos de NDVI')
      return (data as unknown as NdviContourCollection) ?? { type: 'FeatureCollection', features: [] }
    },
    // Reintenta mientras el backend siga generando; ante otro error se rinde pronto.
    retry: (count, err) => err.message === 'CONTOURS_PROCESSING' && count < 10,
    retryDelay: 2_000,
    staleTime: 60_000,
  })
}

export function useNdviContours(headerId: string | null, index: string | null, dcId?: string) {
  return useQuery(ndviContoursQueryOptions(headerId, index, dcId))
}
