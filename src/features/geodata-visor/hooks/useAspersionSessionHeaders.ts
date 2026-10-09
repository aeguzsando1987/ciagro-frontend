/**
 * Lista de sesiones de aspersión de una parcela, ordenadas por fecha desc.
 *
 * GET /api/v1/monitoring/aspersion/headers/?plot=<uuid>
 *
 * El backend (AspersionSessionHeaderListView.get_queryset) filtra por `plot` y aplica
 * el scope por rol vía ScopeFilterMixin (regla crítica #7: no se reimplementa en cliente).
 * El schema OpenAPI tipa la query como `never` (drf-spectacular no documenta estos
 * query_params manuales), por eso el cast `as never` — igual que useDataCentrals/useMasterPrograms.
 */
import { queryOptions, useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api/client'
import { conTotal, fetchAllPagesWithTotal, type ListadoCompleto } from '@/lib/api/paginated'
import type { components } from '@/types/api'

export type AspersionSessionHeader = components['schemas']['AspersionSessionHeader']

export const ASPERSION_HEADERS_KEY = ['aspersion', 'headers'] as const

export function aspersionSessionHeadersQueryOptions(plotId: string | null) {
  return queryOptions({
    queryKey: [...ASPERSION_HEADERS_KEY, { plot: plotId ?? null }] as const,
    enabled: !!plotId,
    // FASE PAG: el Visor muestra el historial completo de la parcela. Se piden
    // todas las paginas (en la practica una, de hasta 1000) y se guarda el
    // `count` del backend para avisar si algo quedara fuera.
    queryFn: (): Promise<ListadoCompleto<AspersionSessionHeader>> =>
      fetchAllPagesWithTotal(async ({ page, page_size }) => {
        const { data, error } = await apiClient.GET('/api/v1/monitoring/aspersion/headers/', {
          params: { query: { plot: plotId, page, page_size } as never },
        })
        if (error) throw new Error('No se pudieron cargar las sesiones de aspersión')
        return data ?? null
      }),
    staleTime: 30_000,
  })
}

export function useAspersionSessionHeaders(plotId: string | null) {
  return conTotal(useQuery(aspersionSessionHeadersQueryOptions(plotId)))
}
