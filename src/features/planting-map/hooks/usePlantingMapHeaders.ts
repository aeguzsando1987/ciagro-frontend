import { queryOptions, useQuery } from '@tanstack/react-query'
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
    queryFn: async () => {
      const q = new URLSearchParams()
      if (plotId) q.set('plot', plotId)
      if (programId) q.set('program', programId)
      q.set('page_size', '2000')
      const data = await plantingApiFetch<PaginatedHeaders | PlantingMapHeader[]>(
        `/monitoring/planting-map/headers/?${q.toString()}`,
      )
      return Array.isArray(data) ? data : data.results
    },
    staleTime: 30_000,
  })
}

export function usePlantingMapHeaders(
  plotId: string | null,
  programId: string | null = null,
  enabled = true,
) {
  return useQuery(plantingMapHeadersQueryOptions(plotId, programId, enabled))
}
