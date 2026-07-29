import { queryOptions, useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api/client'
import type { components } from '@/types/api'

export type NdviSessionDetail = components['schemas']['NdviSessionHeader']

export function ndviSessionDetailQueryOptions(id: string | null) {
  return queryOptions({
    queryKey: ['ndvi-detail', id] as const,
    enabled: !!id,
    queryFn: async (): Promise<NdviSessionDetail> => {
      const { data, error } = await apiClient.GET('/api/v1/monitoring/ndvi/headers/{id}/', {
        params: { path: { id: id! } },
      })
      if (error) throw new Error('No se pudo cargar la sesión de NDVI')
      return data!
    },
    staleTime: 30_000,
    // Mientras Celery importa o contornea, refrescar para reflejar el avance sin recargar.
    refetchInterval: (query) => {
      const d = query.state.data as NdviSessionDetail | undefined
      const importing = d?.import_status === 'processing'
      // contour_status vive en el detalle; se contornea encadenado tras el import.
      const contouring = (d as unknown as { contour_status?: string })?.contour_status === 'processing'
      return importing || contouring ? 2500 : false
    },
  })
}

export function useNdviSessionDetail(id: string | null) {
  return useQuery(ndviSessionDetailQueryOptions(id))
}
