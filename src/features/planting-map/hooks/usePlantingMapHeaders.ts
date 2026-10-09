import { queryOptions, useQuery } from '@tanstack/react-query'
import { conTotal, fetchAllPagesWithTotal, type ListadoCompleto } from '@/lib/api/paginated'
import { plantingApiFetch } from '../api'
import type { PlantingMapHeader } from '../types'

interface PaginatedHeaders {
  count: number
  next: string | null
  previous: string | null
  results: PlantingMapHeader[]
}

export function plantingMapHeadersQueryOptions(
  plotId: string | null,
  programId: string | null = null,
  enabled = true,
) {
  return queryOptions({
    queryKey: ['planting-map', 'headers', plotId, programId] as const,
    enabled: enabled && Boolean(plotId || programId),
    // FASE PAG: todas las paginas y el `count` del backend (antes `page_size=2000`,
    // que el backend ignoraba y dejaba en 25).
    queryFn: (): Promise<ListadoCompleto<PlantingMapHeader>> =>
      fetchAllPagesWithTotal(async ({ page, page_size }) => {
        const q = new URLSearchParams()
        if (plotId) q.set('plot', plotId)
        if (programId) q.set('program', programId)
        q.set('page', String(page))
        q.set('page_size', String(page_size))
        const data = await plantingApiFetch<PaginatedHeaders | PlantingMapHeader[]>(
          `/monitoring/planting-map/headers/?${q.toString()}`,
        )
        return Array.isArray(data) ? { count: data.length, results: data } : data
      }),
    staleTime: 30_000,
  })
}

export function usePlantingMapHeaders(
  plotId: string | null,
  programId: string | null = null,
  enabled = true,
) {
  return conTotal(useQuery(plantingMapHeadersQueryOptions(plotId, programId, enabled)))
}
