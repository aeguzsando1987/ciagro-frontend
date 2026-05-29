import { queryOptions, useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api/client'
import type { AgroUnit } from '../types'

export const PRODUCERS_KEY = ['admin', 'producers'] as const

/**
 * @param datacentral UUID de la CIAgro hija para acotar los productores a esa DC
 *   (el backend verifica el scope). Sin él, lista todos los productores visibles.
 */
export function producersQueryOptions(datacentral?: string | null) {
  return queryOptions({
    queryKey: datacentral ? [...PRODUCERS_KEY, { datacentral }] : PRODUCERS_KEY,
    queryFn: async (): Promise<AgroUnit[]> => {
      // ?unit_type=Productor[&datacentral=<uuid>] — `datacentral` no está tipado en el
      // schema (filtro manual del view), de ahí el cast `as never`.
      const query: Record<string, string> = { unit_type: 'Productor' }
      if (datacentral) query['datacentral'] = datacentral
      const { data, error } = await apiClient.GET('/api/v1/organizations/', {
        params: { query: query as never },
      })
      if (error) throw new Error('No se pudieron cargar los productores')
      return data?.results ?? []
    },
    staleTime: 60_000,
  })
}

export function useProducers(datacentral?: string | null) {
  return useQuery(producersQueryOptions(datacentral))
}
