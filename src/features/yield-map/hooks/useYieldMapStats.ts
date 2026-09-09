import { queryOptions, useQuery } from '@tanstack/react-query'
import { yieldApiFetch } from '../api'
import type { YieldMapStats } from '../types'

export function yieldMapStatsQueryOptions(id: string | null, enabled = true) {
  return queryOptions({
    queryKey: ['yield-map-stats', id] as const,
    enabled: !!id && enabled,
    queryFn: () => yieldApiFetch<YieldMapStats>(`/monitoring/yield-map/headers/${id}/stats/`),
    staleTime: 30_000,
  })
}

export function useYieldMapStats(id: string | null, enabled = true) {
  return useQuery(yieldMapStatsQueryOptions(id, enabled))
}
