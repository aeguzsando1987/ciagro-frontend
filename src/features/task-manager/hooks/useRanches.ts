import { queryOptions, useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api/client'
import type { components } from '@/types/api'

export type Ranch = components['schemas']['Ranch']

export function ranchesQueryOptions(producerId: string | undefined) {
  return queryOptions({
    queryKey: ['ranches', producerId] as const,
    queryFn: async (): Promise<Ranch[]> => {
      const { data, error } = await apiClient.GET('/api/v1/geo_assets/ranches/', {
        params: { query: { producer: producerId } as never },
      })
      if (error) throw new Error('No se pudieron cargar los ranchos')
      return data?.results?.features ?? []
    },
    enabled: !!producerId,
    staleTime: 60_000,
  })
}

export function useRanches(producerId: string | undefined) {
  return useQuery(ranchesQueryOptions(producerId))
}
