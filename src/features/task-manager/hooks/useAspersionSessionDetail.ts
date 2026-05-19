import { queryOptions, useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api/client'
import type { components } from '@/types/api'

// GAP-SCHEMA-001 cerrado: `status` y `assigned_to` ahora están en el schema generado.
// El tipo usa directamente el schema sin augmentaciones manuales.
export type AspersionSessionDetail = components['schemas']['AspersionSessionHeader']

export function aspersionSessionDetailQueryOptions(id: string | null) {
  return queryOptions({
    queryKey: ['aspersion-detail', id] as const,
    enabled: !!id,
    queryFn: async (): Promise<AspersionSessionDetail> => {
      const { data, error } = await apiClient.GET('/api/v1/monitoring/aspersion/headers/{id}/', {
        params: { path: { id: id! } },
      })
      if (error) throw new Error('No se pudo cargar la sesión de aspersión')
      return data!
    },
    staleTime: 30_000,
  })
}

export function useAspersionSessionDetail(id: string | null) {
  return useQuery(aspersionSessionDetailQueryOptions(id))
}
