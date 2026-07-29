import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api/client'
import type { components } from '@/types/api'

type Patch = components['schemas']['PatchedSoilMapHeader']

export function useUpdateSoilMapSession(sesionId: string, masterId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (patch: Patch) => {
      const { data, error } = await apiClient.PATCH(
        '/api/v1/monitoring/soil-map/headers/{id}/update/',
        { params: { path: { id: sesionId } }, body: patch }
      )
      if (error || !data) throw error ?? new Error('No se pudo actualizar el mapeo de suelo')
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['soil-map-detail', sesionId] })
      queryClient.invalidateQueries({ queryKey: ['soil-map-session-stats', sesionId] })
      queryClient.invalidateQueries({ queryKey: ['master-tree', masterId] })
    },
  })
}
