/**
 * Opciones de los selectores del modal de búsqueda avanzada (fase AS).
 *
 * Viven aquí y no en `features/admin/hooks` porque su forma es propia de la búsqueda:
 * `SelectOption[]` y la cascada productor → rancho → parcela. Los hooks de admin
 * siguen sirviendo al explorador y a los formularios sin tocarse.
 *
 * El filtrado por texto lo hace el backend (`?search=`): los catálogos no caben en una
 * sola página, así que filtrar en cliente mostraría solo coincidencias del primer
 * puñado de registros.
 */
import { queryOptions, useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api/client'
import type { SelectOption } from '../components/MultiSelectSearch'

export const SEARCH_OPTIONS_KEY = ['visor', 'search-options'] as const

/** Se piden hasta 200: suficiente para un catálogo real y lejos del tope de 1000. */
const PAGE_SIZE = '200'

export function producerOptionsQueryOptions(organization: string | null, search: string) {
  return queryOptions({
    queryKey: [...SEARCH_OPTIONS_KEY, 'producers', { organization, search }] as const,
    queryFn: async (): Promise<SelectOption[]> => {
      const query: Record<string, string> = { unit_type: 'Productor', page_size: PAGE_SIZE }
      if (organization) query.organization = organization
      if (search) query.search = search
      const { data, error } = await apiClient.GET('/api/v1/organizations/', {
        params: { query: query as never },
      })
      if (error) throw new Error('No se pudieron cargar los productores')
      return (data?.results ?? []).map((unit) => ({
        id: unit.id!,
        label: unit.commercial_name ?? unit.code ?? unit.id!.slice(0, 8),
      }))
    },
    staleTime: 60_000,
  })
}

export function useProducerOptions(organization: string | null, search: string) {
  return useQuery(producerOptionsQueryOptions(organization, search))
}

export function ranchOptionsQueryOptions(producerIds: string[], search: string) {
  return queryOptions({
    queryKey: [...SEARCH_OPTIONS_KEY, 'ranches', { producerIds, search }] as const,
    queryFn: async (): Promise<SelectOption[]> => {
      const query: Record<string, string> = { page_size: PAGE_SIZE }
      // `producer_in` acepta varios; el `producer` de siempre solo uno.
      if (producerIds.length) query.producer_in = producerIds.join(',')
      if (search) query.search = search
      const { data, error } = await apiClient.GET('/api/v1/geo_assets/ranches/', {
        params: { query: query as never },
      })
      if (error) throw new Error('No se pudieron cargar los ranchos')
      return (data?.results?.features ?? []).map((feature) => ({
        id: feature.id!,
        label: feature.properties?.name ?? feature.properties?.code ?? feature.id!.slice(0, 8),
      }))
    },
    staleTime: 60_000,
  })
}

export function useRanchOptions(producerIds: string[], search: string) {
  return useQuery(ranchOptionsQueryOptions(producerIds, search))
}

export function plotOptionsQueryOptions(ranchIds: string[], search: string) {
  return queryOptions({
    queryKey: [...SEARCH_OPTIONS_KEY, 'plots', { ranchIds, search }] as const,
    // Sin ranchos elegidos no se listan parcelas: el catálogo completo de parcelas es
    // el más grande de los tres y una lista sin acotar no ayuda a elegir.
    enabled: ranchIds.length > 0,
    queryFn: async (): Promise<SelectOption[]> => {
      const query: Record<string, string> = {
        ranch_in: ranchIds.join(','),
        page_size: PAGE_SIZE,
      }
      if (search) query.search = search
      const { data, error } = await apiClient.GET('/api/v1/geo_assets/plots/', {
        params: { query: query as never },
      })
      if (error) throw new Error('No se pudieron cargar las parcelas')
      return (data?.results?.features ?? []).map((feature) => ({
        id: feature.id!,
        label: feature.properties?.code ?? feature.id!.slice(0, 8),
      }))
    },
    staleTime: 60_000,
  })
}

export function usePlotOptions(ranchIds: string[], search: string) {
  return useQuery(plotOptionsQueryOptions(ranchIds, search))
}
