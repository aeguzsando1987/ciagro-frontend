import { queryOptions, useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api/client'
import { fetchAllPages } from '@/lib/api/paginated'
import type { components } from '@/types/api'
import type { PlotFlat } from '../types'

export const PLOTS_KEY = ['admin', 'plots'] as const

function flattenPlot(f: components['schemas']['Plot']): PlotFlat {
  return { ...(f.properties ?? {}), id: f.id!, geom: f.geometry ?? null }
}

type PlotsFilter = {
  ranchId?: string | null
  producerId?: string | null
  /**
   * Varios productores a la vez (`?producer_in`). Lo necesita el selector del modal
   * de alcance: las parcelas de una CIAgro cuelgan de varios productores, y pedirlas
   * de una en una sería una petición por productor más un recorte en el cliente.
   */
  producerIds?: string[] | null
  /**
   * Varios ranchos a la vez (`?ranch_in`). El explorador lo usa para saber, de una
   * sola peticion, que ranchos no tienen ninguna parcela visible y no pintarlos.
   */
  ranchIds?: string[] | null
}

export function plotsQueryOptions({ ranchId, producerId, producerIds, ranchIds }: PlotsFilter = {}) {
  // Se normaliza para la clave de caché: dos arrays con el mismo contenido en distinto
  // orden son la misma consulta, y sin normalizar generarían dos entradas distintas.
  const productores = producerIds?.length ? [...producerIds].sort() : null
  const ranchos = ranchIds?.length ? [...ranchIds].sort() : null
  return queryOptions({
    queryKey: [
      ...PLOTS_KEY,
      {
        ranchId: ranchId ?? null,
        producerId: producerId ?? null,
        producerIds: productores,
        ranchIds: ranchos,
      },
    ] as const,
    // Sin al menos un filtro pediría TODAS las parcelas visibles del sistema. El
    // selector siempre acota por CIAgro, así que un array vacío significa "todavía no
    // sé de qué productores", no "de todos".
    enabled:
      (producerIds === undefined || producerIds === null || producerIds.length > 0) &&
      (ranchIds === undefined || ranchIds === null || ranchIds.length > 0),
    queryFn: async (): Promise<PlotFlat[]> => {
      const query: Record<string, string> = {}
      if (ranchId) query['ranch'] = ranchId
      if (producerId) query['producer'] = producerId
      if (productores) query['producer_in'] = productores.join(',')
      if (ranchos) query['ranch_in'] = ranchos.join(',')
      const features = await fetchAllPages<components['schemas']['Plot']>(
        async ({ page, page_size }) => {
          const { data, error } = await apiClient.GET('/api/v1/geo_assets/plots/', {
            params: {
              query: { ...query, page, page_size } as never,
            },
          })
          if (error) throw new Error('No se pudieron cargar las parcelas')
          return data ?? null
        }
      )
      return features.map(flattenPlot)
    },
    staleTime: 30_000,
  })
}

export function usePlots(filter: PlotsFilter = {}) {
  return useQuery(plotsQueryOptions(filter))
}

export function plotDetailQueryOptions(id: string | null) {
  return queryOptions({
    queryKey: [...PLOTS_KEY, id] as const,
    enabled: !!id,
    refetchOnMount: 'always' as const,
    queryFn: async (): Promise<PlotFlat> => {
      const { data, error } = await apiClient.GET('/api/v1/geo_assets/plots/{id}/', {
        params: { path: { id: id! } },
      })
      if (error) throw new Error('No se pudo cargar la parcela')
      return flattenPlot(data!)
    },
  })
}

export function usePlotDetail(id: string | null) {
  return useQuery(plotDetailQueryOptions(id))
}

type PlotPayload = NonNullable<components['schemas']['Plot']['properties']> & {
  geometry?: components['schemas']['Plot']['geometry']
}

function toPlotFeature(payload: PlotPayload): components['schemas']['Plot'] {
  const { geometry, ...props } = payload
  return { type: 'Feature', geometry: geometry ?? undefined, properties: props }
}

export function useCreatePlot() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: PlotPayload): Promise<PlotFlat> => {
      const { data, error } = await apiClient.POST('/api/v1/geo_assets/plots/create/', {
        body: toPlotFeature(payload),
      })
      if (error) throw error
      return flattenPlot(data!)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PLOTS_KEY })
    },
  })
}

export function useUpdatePlot() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: PlotPayload }): Promise<PlotFlat> => {
      const { data, error } = await apiClient.PATCH('/api/v1/geo_assets/plots/{id}/update/', {
        params: { path: { id } },
        body: toPlotFeature(payload),
      })
      if (error) throw error
      return flattenPlot(data!)
    },
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: PLOTS_KEY })
      queryClient.invalidateQueries({ queryKey: [...PLOTS_KEY, id] })
    },
  })
}

export function useDeletePlot() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await apiClient.DELETE('/api/v1/geo_assets/plots/{id}/delete/', {
        params: { path: { id } },
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PLOTS_KEY })
    },
  })
}

export function useImportPlotVertices() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      plotId,
      vertices,
    }: {
      plotId: string
      vertices: components['schemas']['PlotVertexInput'][]
    }): Promise<PlotFlat> => {
      const { data, error } = await apiClient.POST(
        '/api/v1/geo_assets/plots/{id}/import-vertices/',
        {
          params: { path: { id: plotId } },
          body: { vertices },
        }
      )
      if (error) throw error
      return flattenPlot(data!)
    },
    onSuccess: (_data, { plotId }) => {
      queryClient.invalidateQueries({ queryKey: PLOTS_KEY })
      queryClient.invalidateQueries({ queryKey: [...PLOTS_KEY, plotId] })
      // PlotMiniMap usa usePlotGeometry con clave propia — invalidar para que el mapa refresque
      queryClient.invalidateQueries({ queryKey: ['plot-geometry', plotId] })
    },
  })
}
