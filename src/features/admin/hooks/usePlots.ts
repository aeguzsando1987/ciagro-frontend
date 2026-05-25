import { queryOptions, useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api/client'
import type { components } from '@/types/api'
import type { PlotFlat } from '../types'

export const PLOTS_KEY = ['admin', 'plots'] as const

function flattenPlot(f: components['schemas']['Plot']): PlotFlat {
  return { ...(f.properties ?? {}), id: f.id!, geom: f.geometry ?? null }
}

type PlotsFilter = { ranchId?: string | null; producerId?: string | null }

export function plotsQueryOptions({ ranchId, producerId }: PlotsFilter = {}) {
  return queryOptions({
    queryKey: [...PLOTS_KEY, { ranchId: ranchId ?? null, producerId: producerId ?? null }] as const,
    queryFn: async (): Promise<PlotFlat[]> => {
      const query: Record<string, string> = {}
      if (ranchId) query['ranch'] = ranchId
      if (producerId) query['producer'] = producerId
      const { data, error } = await apiClient.GET('/api/v1/geo_assets/plots/', {
        params: { query: Object.keys(query).length ? query : undefined },
      })
      if (error) throw new Error('No se pudieron cargar las parcelas')
      return (data?.results?.features ?? []).map(flattenPlot)
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
