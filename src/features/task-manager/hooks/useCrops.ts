import { queryOptions, useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api/client'
import type { components } from '@/types/api'

export type CropCatalog = components['schemas']['CropCatalog']

export function cropsQueryOptions() {
  return queryOptions({
    queryKey: ['crops'] as const,
    queryFn: async (): Promise<CropCatalog[]> => {
      const { data, error } = await apiClient.GET('/api/v1/agro-catalogs/crops/')
      if (error) throw new Error('No se pudo cargar el catálogo de cultivos')
      return data?.results ?? []
    },
    staleTime: 300_000,
  })
}

export function useCrops() {
  return useQuery(cropsQueryOptions())
}
