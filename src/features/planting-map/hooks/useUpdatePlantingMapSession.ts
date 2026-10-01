import { useMutation, useQueryClient } from '@tanstack/react-query'
import { plantingApiFetch } from '../api'
import type { PlantingMapHeader } from '../types'

export function useUpdatePlantingMapSession(id: string, masterId?: string) {
  const client = useQueryClient()

  return useMutation({
    mutationFn: (patch: Record<string, unknown>) =>
      plantingApiFetch<PlantingMapHeader>(
        `/monitoring/planting-map/headers/${id}/update/`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch),
        },
      ),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['planting-map-detail', id] })
      void client.invalidateQueries({ queryKey: ['planting-map', 'headers'] })
      if (masterId) void client.invalidateQueries({ queryKey: ['master-tree', masterId] })
    },
  })
}
