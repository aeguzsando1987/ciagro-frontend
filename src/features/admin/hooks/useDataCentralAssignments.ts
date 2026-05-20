import { queryOptions, useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api/client'
import type { DataCentralAssignment } from '../types'

export const DCA_QUERY_KEY = ['admin', 'dc-assignments'] as const

export function useDataCentralAssignments(datacentralId: string) {
  return useQuery(queryOptions({
    queryKey: [...DCA_QUERY_KEY, datacentralId] as const,
    enabled: !!datacentralId,
    queryFn: async (): Promise<DataCentralAssignment[]> => {
      const { data, error } = await apiClient.GET('/api/v1/organizations/datacentrals-assignments/', {
        params: { query: { datacentral: datacentralId } as never },
      })
      if (error) throw new Error('No se pudo cargar las asignaciones de unidades')
      return data?.results ?? []
    },
    // staleTime: 0 (default) + refetchOnMount: 'always' garantizan data fresca cada
    // vez que el panel reabre, incluso si invalidateQueries no alcanzó a disparar
    // refetch antes de que se desmontara el observer.
    refetchOnMount: 'always',
  }))
}

export function useCreateDataCentralAssignment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { agro_unit_id: string; datacentral_id: string }) => {
      const { data, error } = await apiClient.POST('/api/v1/organizations/datacentrals-assignments/create/', {
        body: payload as never,
      })
      if (error) throw error
      return data!
    },
    // await garantiza que el refetch termina antes de que mutateAsync resuelva —
    // evita que la unidad recién asignada siga apareciendo en el selector.
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: DCA_QUERY_KEY })
    },
  })
}

export function useDeleteDataCentralAssignment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      const { error } = await apiClient.DELETE('/api/v1/organizations/datacentrals-assignments/{id}/delete/', {
        params: { path: { id } },
      })
      if (error) throw error
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: DCA_QUERY_KEY })
    },
  })
}
