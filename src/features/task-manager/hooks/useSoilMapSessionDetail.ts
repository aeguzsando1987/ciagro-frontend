import { useEffect } from 'react'
import { queryOptions, useQuery, useQueryClient } from '@tanstack/react-query'
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
  const client = useQueryClient()
  const query = useQuery(soilMapSessionDetailQueryOptions(id))
  const importedAt = query.data?.imported_at
  useEffect(() => {
    if (!id || !importedAt) return
    // El import es asíncrono: invalidar al encolarlo no alcanza. Refresca cuando
    // el polling confirma una nueva importación terminada.
    for (const key of [
      'soil-map-points',
      'soil-map-layer-values',
      'soil-map-variable-stats',
      'soil-map-session-stats',
      'soil-map-elevation',
    ]) {
      void client.invalidateQueries({ queryKey: [key, id] })
    }
    void client.invalidateQueries({ queryKey: ['soil-map', 'headers'] })
  }, [client, id, importedAt])
  return query
}
