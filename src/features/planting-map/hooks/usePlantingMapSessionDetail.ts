import { useEffect } from 'react'
import { queryOptions, useQuery, useQueryClient } from '@tanstack/react-query'
import { plantingApiFetch } from '../api'
import type { PlantingMapHeader } from '../types'

export function plantingMapSessionDetailQueryOptions(id: string | null) {
  return queryOptions({
    queryKey: ['planting-map-detail', id] as const,
    enabled: !!id,
    queryFn: () => plantingApiFetch<PlantingMapHeader>(`/monitoring/planting-map/headers/${id}/`),
    staleTime: 30_000,
    refetchInterval: (query) => query.state.data?.import_status === 'processing' ? 2500 : false,
  })
}

export function usePlantingMapSessionDetail(id: string | null) {
  const client = useQueryClient()
  const query = useQuery(plantingMapSessionDetailQueryOptions(id))
  const importedAt = query.data?.imported_at

  useEffect(() => {
    if (!id || !importedAt) return
    void client.invalidateQueries({ queryKey: ['planting-map-stats', id] })
    void client.invalidateQueries({ queryKey: ['planting-map-layer-values', id] })
    void client.invalidateQueries({ queryKey: ['planting-map', 'headers'] })
  }, [client, id, importedAt])

  return query
}
