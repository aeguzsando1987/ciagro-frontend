import { queryOptions, useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api/client'
import type { components } from '@/types/api'

export type SoilMapPoint = components['schemas']['SoilMapPoints']

const PAGE_SIZE = 2000

/**
 * Carga todos los puntos del encabezado. El endpoint está paginado, por lo que
 * una respuesta con `next` provoca la consulta de la página siguiente antes de
 * entregar los datos al mapa.
 */
export async function fetchAllSoilMapPoints(headerId: string): Promise<SoilMapPoint[]> {
  const allPoints: SoilMapPoint[] = []
  let page = 1

  while (true) {
    const { data, error } = await apiClient.GET('/api/v1/monitoring/soil-map/points/', {
      params: {
        query: {
          smh_header: headerId,
          page_size: PAGE_SIZE,
          page,
        },
      },
    })

    if (error || !data) {
      throw new Error(`Error al cargar puntos de suelo (página ${page})`)
    }

    allPoints.push(...data.results)
    if (!data.next) break
    page += 1
  }

  return allPoints
}

export function soilMapPointsQueryOptions(headerId: string | null, enabled = true) {
  return queryOptions({
    queryKey: ['soil-map-points', headerId] as const,
    enabled: !!headerId && enabled,
    queryFn: () => fetchAllSoilMapPoints(headerId!),
    staleTime: 5 * 60_000,
  })
}

export function useSoilMapPoints(headerId: string | null, enabled = true) {
  return useQuery(soilMapPointsQueryOptions(headerId, enabled))
}
