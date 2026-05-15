import { queryOptions, useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api/client'
import type { components } from '@/types/api'

export type AgroUnit = components['schemas']['AgroUnit']

export function agroUnitsQueryOptions() {
  return queryOptions({
    queryKey: ['agro-units', 'Productor'] as const,
    queryFn: async (): Promise<AgroUnit[]> => {
      const { data, error } = await apiClient.GET('/api/v1/organizations/', {
        params: { query: { unit_type: 'Productor' } },
      })
      if (error) throw new Error('No se pudo cargar la lista de productores')
      return data?.results ?? []
    },
    staleTime: 60_000,
  })
}

export function useAgroUnits() {
  return useQuery(agroUnitsQueryOptions())
}
