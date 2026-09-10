import { queryOptions, useQuery } from '@tanstack/react-query'
import { yieldApiFetch } from '../api'
import type { PaginatedYieldPoints, YieldMapPoint } from '../types'

const PAGE_SIZE = 2000

export async function fetchAllYieldMapPoints(headerId: string): Promise<YieldMapPoint[]> {
  const first = await yieldApiFetch<PaginatedYieldPoints>(
    `/monitoring/yield-map/points/?session_header=${encodeURIComponent(headerId)}&page_size=${PAGE_SIZE}&page=1`
  )
  const totalPages = Math.ceil(first.count / PAGE_SIZE)
  const rows = [...first.results]
  for (let page = 2; page <= totalPages; page += 1) {
    const next = await yieldApiFetch<PaginatedYieldPoints>(
      `/monitoring/yield-map/points/?session_header=${encodeURIComponent(headerId)}&page_size=${PAGE_SIZE}&page=${page}`
    )
    rows.push(...next.results)
  }
  return rows
}

export function yieldMapPointsQueryOptions(headerId: string | null, enabled = true) {
  return queryOptions({
    queryKey: ['yield-map-points', headerId] as const,
    enabled: !!headerId && enabled,
    queryFn: () => fetchAllYieldMapPoints(headerId!),
    staleTime: 5 * 60_000,
  })
}

export function useYieldMapPoints(headerId: string | null, enabled = true) {
  return useQuery(yieldMapPointsQueryOptions(headerId, enabled))
}
