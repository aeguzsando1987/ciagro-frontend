/**
 * Lista de sesiones de mapeo de suelo de una parcela.
 *
 * GET /api/v1/monitoring/soil-map/headers/?plot=<uuid>
 *
 * El backend filtra por `plot` y aplica los permisos mediante ScopeFilterMixin.
 * El schema OpenAPI no documenta este query-param manual, por eso el cast
 * localizado a `never`, igual que en los hooks de aspersión y fitosanitario.
 */
import { queryOptions, useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api/client'
import type { components } from '@/types/api'

export type SoilMapSessionHeader = components['schemas']['SoilMapHeader']

export const SOIL_MAP_HEADERS_KEY = ['soil-map', 'headers'] as const

export function soilMapSessionHeadersQueryOptions(plotId: string | null) {
  return queryOptions({
    queryKey: [...SOIL_MAP_HEADERS_KEY, { plot: plotId ?? null }] as const,
    enabled: !!plotId,
    queryFn: async (): Promise<SoilMapSessionHeader[]> => {
      const { data, error } = await apiClient.GET('/api/v1/monitoring/soil-map/headers/', {
        params: { query: { plot: plotId } as never },
      })
      if (error) throw new Error('No se pudieron cargar las sesiones de mapeo de suelo')
      return data?.results ?? []
    },
    staleTime: 30_000,
  })
}

export function useSoilMapSessionHeaders(plotId: string | null) {
  return useQuery(soilMapSessionHeadersQueryOptions(plotId))
}
