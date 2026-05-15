import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api/client'
import type { components } from '@/types/api'

export type PlotGeometry = components['schemas']['Plot']

export function usePlotGeometry(plotId: string | null | undefined) {
  return useQuery({
    queryKey: ['plot-geometry', plotId] as const,
    queryFn: async () => {
      const { data, error } = await apiClient.GET('/api/v1/geo_assets/plots/{id}/', {
        params: { path: { id: plotId! } },
      })
      if (error) throw new Error('No se pudo cargar la geometría de la parcela')
      return data as PlotGeometry
    },
    enabled: !!plotId,
    staleTime: 300_000,
  })
}
