/**
 * Lista de sesiones de mapeo de suelo de una parcela.
 *
 * GET /api/v1/monitoring/soil-map/headers/?plot=<uuid>
 *
 * El backend filtra por `plot` y aplica los permisos mediante ScopeFilterMixin.
 * El schema OpenAPI no documenta este query-param manual, por eso el cast
 * localizado a `never`, igual que en los hooks de aspersión y fitosanitario.
 */
import { queryOptions, useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api/client'
import { conTotal, fetchAllPagesWithTotal, type ListadoCompleto } from '@/lib/api/paginated'
import type { components } from '@/types/api'

export type SoilMapSessionHeader = components['schemas']['SoilMapHeader']

export const SOIL_MAP_HEADERS_KEY = ['soil-map', 'headers'] as const

export function soilMapSessionHeadersQueryOptions(plotId: string | null) {
  return queryOptions({
    queryKey: [...SOIL_MAP_HEADERS_KEY, { plot: plotId ?? null }] as const,
    enabled: !!plotId,
    // FASE PAG: el Visor muestra el historial completo de la parcela. Se piden
    // todas las paginas (en la practica una, de hasta 1000) y se guarda el
    // `count` del backend para avisar si algo quedara fuera.
    queryFn: (): Promise<ListadoCompleto<SoilMapSessionHeader>> =>
      fetchAllPagesWithTotal(async ({ page, page_size }) => {
        const { data, error } = await apiClient.GET('/api/v1/monitoring/soil-map/headers/', {
          params: { query: { plot: plotId, page, page_size } as never },
        })
        if (error) throw new Error('No se pudieron cargar las sesiones de mapeo de suelo')
        return data ?? null
      }),
    staleTime: 30_000,
  })
}

export function useSoilMapSessionHeaders(plotId: string | null) {
  return conTotal(useQuery(soilMapSessionHeadersQueryOptions(plotId)))
}
