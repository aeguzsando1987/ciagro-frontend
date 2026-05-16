import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api/client'
import type { components } from '@/types/api'

// Augment with fields omitted from the generated schema (schema generation gap)
type Patch = components['schemas']['PatchedAspersionSessionHeader'] & {
  status?: string
  assigned_to_id?: string | null
}

export function useUpdateAspersionSession(sesionId: string, masterId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (patch: Patch) => {
      const { data, error } = await apiClient.PATCH(
        '/api/v1/monitoring/aspersion/headers/{id}/update/',
        { params: { path: { id: sesionId } }, body: patch as never }
      )
      if (error) throw error
      return data!
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aspersion-detail', sesionId] })
      queryClient.invalidateQueries({ queryKey: ['master-tree', masterId] })
    },
  })
}
