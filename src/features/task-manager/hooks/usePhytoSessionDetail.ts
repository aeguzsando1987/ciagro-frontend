import { queryOptions, useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api/client'
import type { components } from '@/types/api'

export type PhytoSessionDetail = components['schemas']['PhytoMonitoringHeader']

export function phytoSessionDetailQueryOptions(id: string | null) {
  return queryOptions({
    queryKey: ['phyto-detail', id] as const,
    enabled: !!id,
    queryFn: async (): Promise<PhytoSessionDetail> => {
      const { data, error } = await apiClient.GET('/api/v1/monitoring/phyto/headers/{id}/', {
        params: { path: { id: id! } },
      })
      if (error) throw new Error('No se pudo cargar la sesión fitosanitaria')
      return data!
    },
    staleTime: 30_000,
  })
}

export function usePhytoSessionDetail(id: string | null) {
  return useQuery(phytoSessionDetailQueryOptions(id))
}
