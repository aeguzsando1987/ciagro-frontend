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

export function ndviContoursQueryOptions(headerId: string | null, index: string | null) {
  return queryOptions({
    queryKey: [...NDVI_CONTOURS_KEY, { header: headerId ?? null, index: index ?? null }] as const,
    enabled: !!headerId && !!index,
    queryFn: async (): Promise<NdviContourCollection> => {
      const { data, error } = await apiClient.GET(
        '/api/v1/monitoring/ndvi/headers/{id}/contours/',
        {
          params: {
            path: { id: headerId as string },
            query: { index } as never,
          },
        },
      )
      if (error) throw new Error('No se pudieron cargar los contornos de NDVI')
      return (data as unknown as NdviContourCollection) ?? { type: 'FeatureCollection', features: [] }
    },
    staleTime: 60_000,
  })
}

export function useNdviContours(headerId: string | null, index: string | null) {
  return useQuery(ndviContoursQueryOptions(headerId, index))
}
