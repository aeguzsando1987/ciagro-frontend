import { queryOptions, useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api/client'
import type { components } from '@/types/api'

export type CropCatalog = components['schemas']['CropCatalog']

/**
 * Etiqueta de cultivo para los dropdowns: concatena `name` + `variety`.
 * Caso de uso §3.5.6: el cultivo se trata como una sola entidad — no se
 * expone `crop_variety` como campo aparte, se muestra concatenado.
 */
export function cropLabel(crop: CropCatalog): string {
  return crop.variety ? `${crop.name} — ${crop.variety}` : crop.name
}

export function cropsQueryOptions() {
  return queryOptions({
    queryKey: ['crops'] as const,
    queryFn: async (): Promise<CropCatalog[]> => {
      const { data, error } = await apiClient.GET('/api/v1/agro-catalogs/crops/')
      if (error) throw new Error('No se pudo cargar el catálogo de cultivos')
      return data?.results ?? []
    },
    staleTime: 300_000,
  })
}

export function useCrops() {
  return useQuery(cropsQueryOptions())
}
