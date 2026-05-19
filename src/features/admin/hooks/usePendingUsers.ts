import { queryOptions, useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api/client'
import { USERS_QUERY_KEY } from './useUsers'
import type { UserDetail } from '../types'

/** queryKey de los usuarios pendientes de activación. */
export const PENDING_USERS_QUERY_KEY = ['admin', 'pending-users'] as const

/**
 * GET /api/v1/users/pending/ — usuarios auto-registrados (app móvil) que aún no
 * tienen rol y están en status=pending_activation, a la espera de activación.
 */
export function usePendingUsers() {
  return useQuery(
    queryOptions({
      queryKey: PENDING_USERS_QUERY_KEY,
      queryFn: async (): Promise<UserDetail[]> => {
        const { data, error } = await apiClient.GET('/api/v1/users/pending/')
        if (error) throw new Error('No se pudieron cargar los usuarios pendientes')
        // datacentrals viene mistipado como string en el schema; ver useUsers.
        return (data?.results ?? []) as unknown as UserDetail[]
      },
      staleTime: 30_000,
    })
  )
}

/**
 * PATCH /api/v1/users/{id}/activate/ — asigna un rol de acceso al usuario pendiente
 * y lo pasa a status=active. Sin formulario complejo → hook directo.
 * Invalida tanto la lista de pendientes como la de usuarios (el activado pasa a ella).
 */
export function useActivateUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ userId, userRoleId }: { userId: string; userRoleId: number }) => {
      const { data, error } = await apiClient.PATCH('/api/v1/users/{id}/activate/', {
        params: { path: { id: userId } },
        body: { user_role_id: userRoleId } as never,
      })
      if (error) throw new Error('No se pudo activar el usuario')
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PENDING_USERS_QUERY_KEY })
      queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY })
    },
  })
}
