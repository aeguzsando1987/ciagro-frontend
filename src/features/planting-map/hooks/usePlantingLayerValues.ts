import { queryOptions, useQuery } from '@tanstack/react-query'
import { plantingApiFetch } from '../api'
import type { PlantingLayerKey, PlantingLayerValues } from '../types'

export function usePlantingLayerValues(
  id: string | null,
  layer: PlantingLayerKey | null,
  enabled = true,
) {
  return useQuery(queryOptions({
    queryKey: ['planting-map-layer-values', id, layer] as const,
    enabled: !!id && !!layer && enabled,
    queryFn: () => plantingApiFetch<PlantingLayerValues>(
      `/monitoring/planting-map/headers/${id}/layer-values/?layer=${encodeURIComponent(layer!)}`,
    ),
    staleTime: 5 * 60_000,
  }))
}
