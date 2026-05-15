import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api/client'
import type { components } from '@/types/api'

type PatchedMasterProgram = components['schemas']['PatchedMasterProgram']

interface UseUpdateMaestroOptions {
  masterId: string
  datacentral: string
}

export function useUpdateMaestro({ masterId, datacentral }: UseUpdateMaestroOptions) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (patch: PatchedMasterProgram) => {
      const { data, error } = await apiClient.PATCH(
        '/api/v1/field_ops/master-programs/{id}/update/',
        { params: { path: { id: masterId } }, body: patch as never }
      )
      if (error) throw new Error('No se pudo actualizar el Programa Maestro')
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['master-programs', datacentral] })
      queryClient.invalidateQueries({ queryKey: ['master-tree', masterId] })
    },
  })
}
