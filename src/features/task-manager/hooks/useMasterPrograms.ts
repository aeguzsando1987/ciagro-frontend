import { infiniteQueryOptions, useInfiniteQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api/client'
import type { MasterProgram, ProgramaStatus } from '@/features/task-manager/types'

/** Filtros aplicables a GET /field_ops/master-programs/. */
export interface MasterProgramsFilters {
  datacentral: string
  status?: ProgramaStatus
  agro_unit?: string
}

export interface MasterProgramsPage {
  count: number
  next: string | null
  results: MasterProgram[]
}

/** Lee exclusivamente el número de página del enlace DRF; nunca navega a ese URL. */
export function getNextMasterProgramsPage(next: string | null | undefined, currentPage: number) {
  if (!next) return undefined
  try {
    const page = Number(new URL(next, window.location.origin).searchParams.get('page'))
    return Number.isInteger(page) && page > currentPage ? page : undefined
  } catch {
    return undefined
  }
}

/** Query infinita: conserva las páginas previas si falla una página posterior. */
export function masterProgramsQueryOptions(filters: MasterProgramsFilters) {
  return infiniteQueryOptions({
    queryKey: ['master-programs', filters.datacentral, filters.status, filters.agro_unit] as const,
    initialPageParam: 1,
    queryFn: async ({ pageParam }): Promise<MasterProgramsPage> => {
      const query: Record<string, string> = { datacentral: filters.datacentral, page: String(pageParam) }
      if (filters.status) query.status = filters.status
      if (filters.agro_unit) query.agro_unit = filters.agro_unit

      const { data, error } = await apiClient.GET('/api/v1/field_ops/master-programs/', {
        params: { query: query as never },
      })
      if (error || !data) throw new Error('No se pudo cargar la lista de Programas Maestros')

      return {
        count: data.count,
        next: data.next ?? null,
        results: data.results ?? [],
      }
    },
    getNextPageParam: (lastPage, _allPages, lastPageParam) =>
      getNextMasterProgramsPage(lastPage.next, lastPageParam),
    staleTime: 30_000,
  })
}

/**
 * Carga progresiva de programas. Deduplica por UUID como defensa ante cambios
 * concurrentes entre páginas, sin ocultar el conteo reportado por el servidor.
 */
export function useMasterPrograms(filters: MasterProgramsFilters) {
  const query = useInfiniteQuery(masterProgramsQueryOptions(filters))
  const pages = query.data?.pages ?? []
  const masters = Array.from(new Map(pages.flatMap((page) => page.results).map((master) => [master.id, master])).values())

  return {
    ...query,
    data: masters,
    totalCount: pages[0]?.count ?? 0,
    loadedCount: masters.length,
  }
}
