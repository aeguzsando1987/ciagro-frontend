import { queryOptions, useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api/client'
import type { UserAssignment } from '../types'

export const UA_QUERY_KEY = ['admin', 'user-assignments'] as const

export function useUserAssignments(datacentralId: string) {
  return useQuery(queryOptions({
    queryKey: [...UA_QUERY_KEY, datacentralId] as const,
    enabled: !!datacentralId,
    queryFn: async (): Promise<UserAssignment[]> => {
      const { data, error } = await apiClient.GET('/api/v1/users/assignments/', {
        params: { query: { datacentral: datacentralId } as never },
      })
      if (error) throw new Error('No se pudo cargar las asignaciones de usuarios')
      return data?.results ?? []
    },
    // staleTime: 0 (default) + refetchOnMount: 'always' fuerzan un refetch cada vez
    // que el panel reabre, garantizando que las asignaciones recién creadas aparezcan
    // como ya asignadas (y por tanto excluidas del selector de "asignar nuevo").
    refetchOnMount: 'always',
  }))
}

export function useCreateUserAssignment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { user_id: string; datacentral_id: string }) => {
      const { data, error } = await apiClient.POST('/api/v1/users/assignments/create/', {
        body: payload as never,
      })
      if (error) throw error
      return data!
    },
    // await garantiza que el refetch termina antes de que mutateAsync resuelva en el
    // componente — evita que el selector muestre el item recién asignado como opción.
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: UA_QUERY_KEY })
    },
  })
}

export function useDeleteUserAssignment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      const { error } = await apiClient.DELETE('/api/v1/users/assignments/{id}/delete/', {
        params: { path: { id } },
      })
      if (error) throw error
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: UA_QUERY_KEY })
    },
  })
}
