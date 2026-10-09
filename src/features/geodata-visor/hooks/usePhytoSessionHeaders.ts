/**
 * Lista de sesiones de monitoreo fitosanitario de una parcela, ordenadas por fecha desc.
 *
 * GET /api/v1/monitoring/phyto/headers/?plot=<uuid>
 *
 * El backend (PhytoHeaderListView.get_queryset) filtra por `plot` y aplica el scope por
 * rol vía PhytoScopeFilterMixin (regla crítica #7: no se reimplementa en cliente). El
 * schema OpenAPI tipa la query como `never` (drf-spectacular no documenta estos
 * query_params manuales), por eso el cast `as never` — igual que useAspersionSessionHeaders.
 */
import { queryOptions, useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api/client'
import { conTotal, fetchAllPagesWithTotal, type ListadoCompleto } from '@/lib/api/paginated'
import type { components } from '@/types/api'

export type PhytoSessionHeader = components['schemas']['PhytoMonitoringHeader']

export const PHYTO_HEADERS_KEY = ['phyto', 'headers'] as const

export function phytoSessionHeadersQueryOptions(plotId: string | null) {
  return queryOptions({
    queryKey: [...PHYTO_HEADERS_KEY, { plot: plotId ?? null }] as const,
    enabled: !!plotId,
    // FASE PAG: el Visor muestra el historial completo de la parcela. Se piden
    // todas las paginas (en la practica una, de hasta 1000) y se guarda el
    // `count` del backend para avisar si algo quedara fuera.
    queryFn: (): Promise<ListadoCompleto<PhytoSessionHeader>> =>
      fetchAllPagesWithTotal(async ({ page, page_size }) => {
        const { data, error } = await apiClient.GET('/api/v1/monitoring/phyto/headers/', {
          params: { query: { plot: plotId, page, page_size } as never },
        })
        if (error) throw new Error('No se pudieron cargar las sesiones fitosanitarias')
        return data ?? null
      }),
    staleTime: 30_000,
  })
}

export function usePhytoSessionHeaders(plotId: string | null) {
  return conTotal(useQuery(phytoSessionHeadersQueryOptions(plotId)))
}
