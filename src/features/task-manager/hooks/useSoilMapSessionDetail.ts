import { queryOptions, useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api/client'
import type { components } from '@/types/api'

export type SoilMapSessionDetail = components['schemas']['SoilMapHeader']

export function soilMapSessionDetailQueryOptions(id: string | null) {
  return queryOptions({
    queryKey: ['soil-map-detail', id] as const,
    enabled: !!id,
    queryFn: async (): Promise<SoilMapSessionDetail> => {
      const { data, error } = await apiClient.GET('/api/v1/monitoring/soil-map/headers/{id}/', {
        params: { path: { id: id! } },
      })
      if (error || !data) throw new Error('No se pudo cargar la sesión de mapeo de suelo')
      return data
    },
    staleTime: 30_000,
    refetchInterval: (query) => (query.state.data?.import_status === 'processing' ? 2500 : false),
  })
}

export function useSoilMapSessionDetail(id: string | null) {
  return useQuery(soilMapSessionDetailQueryOptions(id))
}
