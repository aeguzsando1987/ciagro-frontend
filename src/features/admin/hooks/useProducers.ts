import { queryOptions, useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api/client'
import type { AgroUnit } from '../types'

export const PRODUCERS_KEY = ['admin', 'producers'] as const

export function producersQueryOptions() {
  return queryOptions({
    queryKey: PRODUCERS_KEY,
    queryFn: async (): Promise<AgroUnit[]> => {
      // ?unit_type=Productor — openapi-fetch URL-encodes automáticamente
      const { data, error } = await apiClient.GET('/api/v1/organizations/', {
        params: { query: { unit_type: 'Productor' } },
      })
      if (error) throw new Error('No se pudieron cargar los productores')
      return data?.results ?? []
    },
    staleTime: 60_000,
  })
}

export function useProducers() {
  return useQuery(producersQueryOptions())
}
