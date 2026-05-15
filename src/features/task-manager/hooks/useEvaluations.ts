import { queryOptions, useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api/client'
import type { components } from '@/types/api'

export type EvaluationCatalog = components['schemas']['EvaluationCatalog']

export function evaluationsQueryOptions(activityType: 'ASPERSION' | 'PHYTOSANITARY') {
  return queryOptions({
    queryKey: ['evaluations', activityType] as const,
    queryFn: async (): Promise<EvaluationCatalog[]> => {
      const { data, error } = await apiClient.GET('/api/v1/agro-catalogs/evaluations/', {
        params: { query: { activity_type: activityType, is_active: true } },
      })
      if (error) throw new Error('No se pudo cargar el catálogo de evaluaciones')
      return data?.results ?? []
    },
    staleTime: 300_000,
  })
}

export function useEvaluations(activityType: 'ASPERSION' | 'PHYTOSANITARY') {
  return useQuery(evaluationsQueryOptions(activityType))
}
