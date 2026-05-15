import { queryOptions, useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api/client'
import type { components } from '@/types/api'

export type Plot = components['schemas']['Plot']

export function plotsQueryOptions(ranchId: string | undefined) {
  return queryOptions({
    queryKey: ['plots', ranchId] as const,
    queryFn: async (): Promise<Plot[]> => {
      const { data, error } = await apiClient.GET('/api/v1/geo_assets/plots/', {
        params: { query: { ranch: ranchId } as never },
      })
      if (error) throw new Error('No se pudieron cargar las parcelas')
      return data?.results?.features ?? []
    },
    enabled: !!ranchId,
    staleTime: 60_000,
  })
}

export function usePlots(ranchId: string | undefined) {
  return useQuery(plotsQueryOptions(ranchId))
}
