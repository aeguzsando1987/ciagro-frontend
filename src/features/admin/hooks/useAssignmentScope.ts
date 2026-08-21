import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api/client'
import type { components } from '@/types/api'
import { UA_QUERY_KEY } from './useUserAssignments'

export type ScopedPlot = components['schemas']['ScopedPlot']
export type AssignmentScope = components['schemas']['UserAssignmentScopeRead']
export type AccessMode = 'full' | 'restricted'

export const SCOPE_KEY = ['admin', 'assignment-scope'] as const

export function assignmentScopeQueryOptions(assignmentId: number | null) {
  return queryOptions({
    queryKey: [...SCOPE_KEY, assignmentId] as const,
    enabled: assignmentId != null,
    // El modal puede abrirse justo después de guardar desde otra pantalla; sin esto
    // mostraría el alcance viejo de la caché y el gerente creería que no se guardó.
    refetchOnMount: 'always',
    queryFn: async (): Promise<AssignmentScope> => {
      const { data, error } = await apiClient.GET('/api/v1/users/assignments/{id}/scope/', {
        params: { path: { id: assignmentId! } },
      })
      if (error) throw new Error('No se pudo cargar el alcance de la asignación')
      return data!
    },
  })
}

export function useAssignmentScope(assignmentId: number | null) {
  return useQuery(assignmentScopeQueryOptions(assignmentId))
}

/**
 * Reemplaza el alcance completo de una asignación.
 *
 * El modo y las parcelas se envían JUNTOS porque el backend expone una sola operación:
 * separarlos permitiría dejar la asignación en `restricted` con cero parcelas —un
 * usuario que no ve nada— si la segunda llamada fallara.
 */
export function useUpdateAssignmentScope() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      assignmentId,
      accessMode,
      plotIds,
    }: {
      assignmentId: number
      accessMode: AccessMode
      plotIds: string[]
    }): Promise<AssignmentScope> => {
      const { data, error } = await apiClient.PUT('/api/v1/users/assignments/{id}/scope/', {
        params: { path: { id: assignmentId } },
        body: { access_mode: accessMode, plot_ids: plotIds } as never,
      })
      if (error) throw error
      return data!
    },
    onSuccess: async (_data, { assignmentId }) => {
      await queryClient.invalidateQueries({ queryKey: [...SCOPE_KEY, assignmentId] })
      // El listado de usuarios muestra el modo de cada asignación: si no se invalida,
      // el badge seguiría diciendo lo contrario de lo que se acaba de guardar.
      await queryClient.invalidateQueries({ queryKey: UA_QUERY_KEY })
    },
  })
}
