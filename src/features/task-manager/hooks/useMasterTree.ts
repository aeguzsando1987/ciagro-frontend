import { queryOptions, useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api/client'
import type { MasterProgramTree } from '@/features/task-manager/types'

/**
 * QueryOptions del arbol completo (Maestro + Hijos + Sesiones).
 * Misma estrategia que useMasterPrograms: la queryKey se comparte por si en el
 * futuro queremos invalidar a nivel de arbol (ej. al crear un Hijo).
 */
// GET /api/v1/field_ops/master-programs/<uuid>/tree/
export function masterTreeQueryOptions(masterId: string, enabled: boolean) {
  return queryOptions({
    queryKey: ['master-tree', masterId] as const,
    queryFn: async (): Promise<MasterProgramTree> => {
      const { data, error } = await apiClient.GET(
        '/api/v1/field_ops/master-programs/{id}/tree/',
        { params: { path: { id: masterId } } }
      )
      if (error || !data) throw new Error('No se pudo cargar el arbol del Programa Maestro')
      return data
    },
    enabled,
    staleTime: 30_000,
  })
}

/**
 * Hook lazy: solo fetcha si `enabled === true`.
 * Patron canonico de Sprint 2.A: GanttHierarchy llama useMasterTree(id, isExpanded)
 * por cada Maestro; al expandir se dispara la query, al colapsar se detiene.
 */
export function useMasterTree(masterId: string, enabled: boolean) {
  return useQuery(masterTreeQueryOptions(masterId, enabled))
}
