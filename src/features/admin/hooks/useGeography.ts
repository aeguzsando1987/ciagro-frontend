import { queryOptions, useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api/client'
import type { Country, StateDetail } from '../types'

/** GET /api/v1/geography/countries/?page_size=300 — todos los países en una petición.
 *  StandardPagination en el backend permite sobrescribir page_size (max 1000). */
export function useCountries() {
  return useQuery(
    queryOptions({
      queryKey: ['geography', 'countries'] as const,
      queryFn: async (): Promise<Country[]> => {
        const { data, error } = await apiClient.GET('/api/v1/geography/countries/', {
          params: { query: { page_size: 300 } as never },
        })
        if (error) throw new Error('No se pudieron cargar los países')
        return data?.results ?? []
      },
      staleTime: 60 * 60_000,
    })
  )
}

/**
 * GET /api/v1/geography/states/?country=<iso_2> — estados del país seleccionado.
 * `enabled` evita el fetch hasta que haya un país elegido (cascada país→estado).
 * El backend filtra por el ISO-2 del país; el param no figura en el schema OpenAPI
 * (lo lee de query_params), de ahí el cast localizado — mismo patrón que useMasterPrograms.
 */
export function useStates(countryIso2: string | null) {
  return useQuery(
    queryOptions({
      queryKey: ['geography', 'states', countryIso2] as const,
      enabled: !!countryIso2,
      queryFn: async (): Promise<StateDetail[]> => {
        const { data, error } = await apiClient.GET('/api/v1/geography/states/', {
          params: { query: { country: countryIso2 } as never },
        })
        if (error) throw new Error('No se pudieron cargar los estados')
        return data?.results ?? []
      },
      staleTime: 60 * 60_000,
    })
  )
}
