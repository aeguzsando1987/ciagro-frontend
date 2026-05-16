import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api/client'
import type { components } from '@/types/api'

type Patch = components['schemas']['PatchedPhytoMonitoringHeader']

export function useUpdatePhytoSession(sesionId: string, masterId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (patch: Patch) => {
      const { data, error } = await apiClient.PATCH(
        '/api/v1/monitoring/phyto/headers/{id}/update/',
        { params: { path: { id: sesionId } }, body: patch as never }
      )
      if (error) throw error
      return data!
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['phyto-detail', sesionId] })
      queryClient.invalidateQueries({ queryKey: ['master-tree', masterId] })
    },
  })
}
