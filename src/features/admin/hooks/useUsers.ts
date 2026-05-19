import { queryOptions, useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api/client'
import type { UserDetail } from '../types'

/** queryKey raíz de la lista de usuarios del panel admin. */
export const USERS_QUERY_KEY = ['admin', 'users'] as const

/**
 * QueryOptions de la lista de usuarios.
 * GET /api/v1/users/ — respuesta paginada DRF; se consume solo `results`.
 */
export function usersQueryOptions() {
  return queryOptions({
    queryKey: USERS_QUERY_KEY,
    queryFn: async (): Promise<UserDetail[]> => {
      const { data, error } = await apiClient.GET('/api/v1/users/')
      if (error) throw new Error('No se pudo cargar la lista de usuarios')
      // El schema tipa `datacentrals` como string (SerializerMethodField); el
      // tipo local UserDetail lo corrige. Cast necesario por esa discrepancia.
      return (data?.results ?? []) as unknown as UserDetail[]
    },
    staleTime: 30_000,
  })
}

/** Hook de lectura: lista de usuarios (solo SuperAdmin la verá; el backend gatea). */
export function useUsers() {
  return useQuery(usersQueryOptions())
}

/**
 * DELETE /api/v1/users/{id}/ — soft delete.
 * Sin formulario asociado, así que se expone como hook (no inline en un diálogo).
 */
export function useDeleteUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await apiClient.DELETE('/api/v1/users/{id}/', {
        params: { path: { id: userId } },
      })
      if (error) throw new Error('No se pudo eliminar el usuario')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY })
    },
  })
}
