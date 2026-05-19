import { queryOptions, useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api/client'
import type { UserRole, WorkRole } from '../types'

/**
 * GET /api/v1/users/roles/ — catálogo de roles de acceso (Guest..SuperAdmin, niveles 1–5).
 * Es un catálogo fijo: staleTime alto para no refetchear de más.
 */
export function useUserRoles() {
  return useQuery(
    queryOptions({
      queryKey: ['admin', 'user-roles'] as const,
      queryFn: async (): Promise<UserRole[]> => {
        const { data, error } = await apiClient.GET('/api/v1/users/roles/')
        if (error) throw new Error('No se pudieron cargar los roles de acceso')
        return data?.results ?? []
      },
      staleTime: 5 * 60_000,
    })
  )
}

/** queryKey de roles laborales — se invalida al crear uno nuevo desde el diálogo de usuario. */
export const WORK_ROLES_QUERY_KEY = ['admin', 'work-roles'] as const

/** GET /api/v1/users/work-roles/ — catálogo de roles laborales (WorkRole). */
export function useWorkRoles() {
  return useQuery(
    queryOptions({
      queryKey: WORK_ROLES_QUERY_KEY,
      queryFn: async (): Promise<WorkRole[]> => {
        const { data, error } = await apiClient.GET('/api/v1/users/work-roles/')
        if (error) throw new Error('No se pudieron cargar los roles laborales')
        return data?.results ?? []
      },
      staleTime: 5 * 60_000,
    })
  )
}
