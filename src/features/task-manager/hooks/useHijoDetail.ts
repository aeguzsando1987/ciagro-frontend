import { queryOptions, useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api/client'
import type { components } from '@/types/api'

/** Detalle completo de un Subprograma (ProgramaSerializer del backend). */
export type Programa = components['schemas']['Programa']

/**
 * QueryOptions del detalle de un Subprograma.
 *
 * GET /api/v1/field_ops/tasks/{id}/
 *
 * El árbol del Maestro (ProgramaTree) solo trae campos básicos + sesiones; el
 * detalle agrega lo que el formulario de edición necesita: las fechas reales
 * (actual_start_date / actual_finish_date) y el cultivo (crop).
 */
export function hijoDetailQueryOptions(hijoId: string) {
  return queryOptions({
    queryKey: ['hijo-detail', hijoId] as const,
    queryFn: async (): Promise<Programa> => {
      const { data, error } = await apiClient.GET('/api/v1/field_ops/tasks/{id}/', {
        params: { path: { id: hijoId } },
      })
      if (error || !data) throw new Error('No se pudo cargar el detalle del Subprograma')
      return data
    },
    staleTime: 15_000,
  })
}

/** Hook que carga el detalle completo de un Subprograma. */
export function useHijoDetail(hijoId: string) {
  return useQuery(hijoDetailQueryOptions(hijoId))
}
