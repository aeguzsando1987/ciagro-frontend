import { queryOptions, useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api/client'
import type { components } from '@/types/api'

export interface SoilMapSessionStats {
  header_id: string
  points_count: number
  mapping_date: string
  status: components['schemas']['Status5a4Enum']
  import_status: components['schemas']['ImportStatusEnum']
  imported_at: string | null
}

export function soilMapSessionStatsQueryOptions(headerId: string | null, enabled = true) {
  return queryOptions({
    queryKey: ['soil-map-session-stats', headerId] as const,
    enabled: !!headerId && enabled,
    queryFn: async (): Promise<SoilMapSessionStats> => {
      const { data, error } = await apiClient.GET(
        '/api/v1/monitoring/soil-map/headers/{id}/stats/',
        { params: { path: { id: headerId! } } }
      )
      if (error || !data) throw new Error('No se pudo cargar el resumen del mapeo de suelo')
      return data as unknown as SoilMapSessionStats
    },
    staleTime: 60_000,
  })
}

export function useSoilMapSessionStats(headerId: string | null, enabled = true) {
  return useQuery(soilMapSessionStatsQueryOptions(headerId, enabled))
}
