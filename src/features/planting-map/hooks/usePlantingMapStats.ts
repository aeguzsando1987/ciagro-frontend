import { queryOptions, useQuery } from '@tanstack/react-query'
import { plantingApiFetch } from '../api'
import type { PlantingMapStats } from '../types'

export function usePlantingMapStats(id: string | null, enabled = true) {
  return useQuery(queryOptions({
    queryKey: ['planting-map-stats', id] as const,
    enabled: !!id && enabled,
    queryFn: () => plantingApiFetch<PlantingMapStats>(`/monitoring/planting-map/headers/${id}/stats/`),
    staleTime: 30_000,
  }))
}
