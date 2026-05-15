import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api/client'
import type { components } from '@/types/api'

type PatchedPrograma = components['schemas']['PatchedPrograma']

interface UseUpdateHijoOptions {
  hijoId: string
  masterId: string
}

export function useUpdateHijo({ hijoId, masterId }: UseUpdateHijoOptions) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (patch: PatchedPrograma) => {
      const { data, error } = await apiClient.PATCH(
        '/api/v1/field_ops/tasks/{id}/update/',
        { params: { path: { id: hijoId } }, body: patch as never }
      )
      if (error) throw new Error('No se pudo actualizar el Programa Hijo')
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['master-tree', masterId] })
    },
  })
}
