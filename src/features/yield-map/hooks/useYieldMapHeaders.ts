import { queryOptions, useQuery } from '@tanstack/react-query'
import { yieldApiFetch } from '../api'
import type { YieldMapHeader } from '../types'

interface PaginatedHeaders {
  count: number
  next: string | null
  previous: string | null
  results: YieldMapHeader[]
}

export function yieldMapHeadersQueryOptions(plotId: string | null, enabled = true) {
  return queryOptions({
    queryKey: ['yield-map', 'headers', plotId] as const,
    enabled: !!plotId && enabled,
    queryFn: async () => {
      const q = new URLSearchParams({ plot: plotId!, page_size: '2000' })
      const data = await yieldApiFetch<PaginatedHeaders | YieldMapHeader[]>(`/monitoring/yield-map/headers/?${q}`)
      return Array.isArray(data) ? data : data.results
    },
    staleTime: 30_000,
  })
}

export function useYieldMapHeaders(plotId: string | null, enabled = true) {
  return useQuery(yieldMapHeadersQueryOptions(plotId, enabled))
}
