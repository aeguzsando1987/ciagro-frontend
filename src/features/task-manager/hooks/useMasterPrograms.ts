import { queryOptions, useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api/client'
import type { MasterProgram, ProgramaStatus } from '@/features/task-manager/types'

/** Filtros aplicables a GET /field_ops/master-programs/ (paso 2.1 + 2.5). */
export interface MasterProgramsFilters {
  /** UUID del DataCentral activo. Requerido en Fase 2 (workspace scope). */
  datacentral: string
  /** Filtro opcional por status del Maestro. */
  status?: ProgramaStatus
  /** Filtro opcional por UUID del productor (AgroUnit). */
  agro_unit?: string
}

/**
 * QueryOptions reutilizable para la lista de Programas Maestros.
 * Se exporta para que el loader de la ruta y el componente compartan el mismo
 * queryKey (TanStack Router precarga, TanStack Query lee del cache).
 */
// GET /api/v1/field_ops/master-programs/?datacentral=<uuid>&[status=<enum>]&[agro_unit=<uuid>]
export function masterProgramsQueryOptions(filters: MasterProgramsFilters) {
  return queryOptions({
    queryKey: ['master-programs', filters.datacentral, filters.status, filters.agro_unit] as const,
    queryFn: async (): Promise<MasterProgram[]> => {
      // `datacentral` no figura en el OpenAPI schema pero el backend lo acepta
      // para restringir al workspace activo. Cast localizado hasta que se
      // documente en el schema (gap menor de backend, no bloqueante).
      const query: Record<string, string> = { datacentral: filters.datacentral }
      if (filters.status) query.status = filters.status
      if (filters.agro_unit) query.agro_unit = filters.agro_unit

      const { data, error } = await apiClient.GET('/api/v1/field_ops/master-programs/', {
        params: { query: query as never },
      })
      if (error) throw new Error('No se pudo cargar la lista de Programas Maestros')

      // DRF devuelve paginado: {count, next, previous, results}.
      // En Sprint 2.A consumimos solo la primera pagina (paginacion en 2.E si se requiere).
      return data?.results ?? []
    },
    staleTime: 30_000,
  })
}

/**
 * Hook que carga la lista de Programas Maestros del workspace activo.
 * Reactivo a cambios en `filters`: la queryKey incluye los 3 valores.
 */
export function useMasterPrograms(filters: MasterProgramsFilters) {
  return useQuery(masterProgramsQueryOptions(filters))
}
