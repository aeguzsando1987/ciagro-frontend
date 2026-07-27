/**
 * Lista de sesiones de NDVI de una parcela, ordenadas por fecha desc.
 *
 * GET /api/v1/monitoring/ndvi/headers/?plot=<uuid>
 *
 * El backend (NdviSessionHeaderListView.get_queryset) filtra por `plot` y aplica el scope
 * por rol vía ScopeFilterMixin (no se reimplementa en cliente). El schema OpenAPI tipa la
 * query como `never` (drf-spectacular no documenta estos query_params manuales), de ahi el
 * cast `as never` — igual que useAspersionSessionHeaders.
 */
import { queryOptions, useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api/client'
import type { components } from '@/types/api'

export type NdviSessionHeader = components['schemas']['NdviSessionHeader']

export const NDVI_HEADERS_KEY = ['ndvi', 'headers'] as const

export function ndviSessionHeadersQueryOptions(plotId: string | null) {
  return queryOptions({
    queryKey: [...NDVI_HEADERS_KEY, { plot: plotId ?? null }] as const,
    enabled: !!plotId,
    queryFn: async (): Promise<NdviSessionHeader[]> => {
      const { data, error } = await apiClient.GET('/api/v1/monitoring/ndvi/headers/', {
        params: { query: { plot: plotId } as never },
      })
      if (error) throw new Error('No se pudieron cargar las sesiones de NDVI')
      return data?.results ?? []
    },
    staleTime: 30_000,
  })
}

export function useNdviSessionHeaders(plotId: string | null) {
  return useQuery(ndviSessionHeadersQueryOptions(plotId))
}
