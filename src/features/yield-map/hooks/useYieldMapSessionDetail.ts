import { useEffect } from 'react'
import { queryOptions, useQuery, useQueryClient } from '@tanstack/react-query'
import { yieldApiFetch } from '../api'
import type { YieldMapHeader } from '../types'

export function yieldMapSessionDetailQueryOptions(id: string | null) {
  return queryOptions({
    queryKey: ['yield-map-detail', id] as const,
    enabled: !!id,
    queryFn: () => yieldApiFetch<YieldMapHeader>(`/monitoring/yield-map/headers/${id}/`),
    staleTime: 30_000,
    refetchInterval: (query) => (query.state.data?.import_status === 'processing' ? 2500 : false),
  })
}

export function useYieldMapSessionDetail(id: string | null) {
  const client = useQueryClient()
  const query = useQuery(yieldMapSessionDetailQueryOptions(id))
  const importedAt = query.data?.imported_at
  useEffect(() => {
    if (!id || !importedAt) return
    void client.invalidateQueries({ queryKey: ['yield-map-points', id] })
    void client.invalidateQueries({ queryKey: ['yield-map-stats', id] })
    void client.invalidateQueries({ queryKey: ['yield-map', 'headers'] })
  }, [client, id, importedAt])
  return query
}
