/**
 * Búsqueda avanzada de sesiones (fase AS).
 *
 * GET /api/v1/monitoring/sessions/advanced-search/
 *
 * Una sola llamada devuelve la jerarquía completa productor → rancho → parcela →
 * sesiones de los cuatro tipos. El scope multi-tenant lo resuelve el backend (regla
 * crítica: no se reimplementa en cliente).
 *
 * A diferencia de los demás hooks del visor, aquí los query params SÍ están tipados
 * por el schema (se declararon con `OpenApiParameter`), así que no hace falta el
 * `as never`. Lo que no se puede tipar es la respuesta: el endpoint la documenta como
 * objeto genérico, de ahí el cast contra `AdvancedSearchResult`, que es el contrato
 * real y vive en `types.ts`.
 */
import { queryOptions, useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api/client'
import type { AdvancedSearchResult } from '../types'
import { criteriaToQuery, isSearchActive, type AdvancedSearchCriteria } from '../lib/advancedSearch'

export const ADVANCED_SEARCH_KEY = ['visor', 'advanced-search'] as const

export function advancedSessionSearchQueryOptions(criteria: AdvancedSearchCriteria) {
  const query = criteriaToQuery(criteria)
  return queryOptions({
    // La query normalizada es la clave: dos criterios que producen la misma petición
    // comparten caché (p. ej. elegir los cuatro tipos o ninguno).
    queryKey: [...ADVANCED_SEARCH_KEY, query] as const,
    // Sin criterios no se pide nada: el explorador sigue en su modo perezoso.
    enabled: isSearchActive(criteria),
    queryFn: async (): Promise<AdvancedSearchResult> => {
      const { data, error } = await apiClient.GET('/api/v1/monitoring/sessions/advanced-search/', {
        params: { query },
      })
      if (error) throw new Error('No se pudo ejecutar la búsqueda avanzada')
      return data as unknown as AdvancedSearchResult
    },
    staleTime: 30_000,
  })
}

export function useAdvancedSessionSearch(criteria: AdvancedSearchCriteria) {
  return useQuery(advancedSessionSearchQueryOptions(criteria))
}
