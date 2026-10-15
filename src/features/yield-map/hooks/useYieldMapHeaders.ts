import { queryOptions, useQuery } from '@tanstack/react-query'
import { conTotal, fetchAllPagesWithTotal, type ListadoCompleto } from '@/lib/api/paginated'
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
    // FASE PAG: todas las paginas y el `count` del backend (antes `page_size=2000`,
    // que el backend ignoraba y dejaba en 25).
    queryFn: (): Promise<ListadoCompleto<YieldMapHeader>> =>
      fetchAllPagesWithTotal(async ({ page, page_size }) => {
        const q = new URLSearchParams({
          plot: plotId!,
          page: String(page),
          page_size: String(page_size),
        })
        const data = await yieldApiFetch<PaginatedHeaders | YieldMapHeader[]>(`/monitoring/yield-map/headers/?${q}`)
        return Array.isArray(data) ? { count: data.length, results: data } : data
      }),
    staleTime: 30_000,
  })
}

export function useYieldMapHeaders(plotId: string | null, enabled = true) {
  return conTotal(useQuery(yieldMapHeadersQueryOptions(plotId, enabled)))
}
