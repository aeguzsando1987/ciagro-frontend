/**
 * Indices NDVI que ya tienen contornos generados para una sesion.
 *
 * GET /api/v1/monitoring/ndvi/headers/<id>/contours/indices/
 *
 * Devuelve { header_id, contour_status, indices: string[] }. El visor lo usa para poblar el
 * selector de indice y para saber si el contorneo ya termino (contour_status === 'done').
 */
import { queryOptions, useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api/client'

export interface NdviContourIndices {
  header_id: string
  contour_status: string | null
  indices: string[]
}

export const NDVI_CONTOUR_INDICES_KEY = ['ndvi', 'contour-indices'] as const

export function ndviContourIndicesQueryOptions(headerId: string | null) {
  return queryOptions({
    queryKey: [...NDVI_CONTOUR_INDICES_KEY, { header: headerId ?? null }] as const,
    enabled: !!headerId,
    queryFn: async (): Promise<NdviContourIndices> => {
      const { data, error } = await apiClient.GET(
        '/api/v1/monitoring/ndvi/headers/{id}/contours/indices/',
        { params: { path: { id: headerId as string } } },
      )
      if (error) throw new Error('No se pudieron cargar los indices de contorno')
      return (data as unknown as NdviContourIndices) ?? {
        header_id: headerId as string,
        contour_status: null,
        indices: [],
      }
    },
    // El contorneo corre async en Celery; refresca hasta que termine.
    refetchInterval: (query) =>
      (query.state.data as NdviContourIndices | undefined)?.contour_status === 'done'
        ? false
        : 4000,
    staleTime: 10_000,
  })
}

export function useNdviContourIndices(headerId: string | null) {
  return useQuery(ndviContourIndicesQueryOptions(headerId))
}
