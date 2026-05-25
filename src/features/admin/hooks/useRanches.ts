import { queryOptions, useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api/client'
import type { components } from '@/types/api'
import type { RanchFlat } from '../types'

export const RANCHES_KEY = ['admin', 'ranches'] as const

function flattenRanch(f: components['schemas']['Ranch']): RanchFlat {
  return { ...(f.properties ?? {}), id: f.id!, geom: f.geometry ?? null }
}

export function ranchesQueryOptions(producerId?: string | null) {
  return queryOptions({
    queryKey: producerId ? [...RANCHES_KEY, { producer: producerId }] : RANCHES_KEY,
    queryFn: async (): Promise<RanchFlat[]> => {
      const { data, error } = await apiClient.GET('/api/v1/geo_assets/ranches/', {
        params: { query: producerId ? { producer: producerId } : undefined },
      })
      if (error) throw new Error('No se pudieron cargar los ranchos')
      return (data?.results?.features ?? []).map(flattenRanch)
    },
    staleTime: 30_000,
  })
}

export function useRanches(producerId?: string | null) {
  return useQuery(ranchesQueryOptions(producerId))
}

export function ranchDetailQueryOptions(id: string | null) {
  return queryOptions({
    queryKey: [...RANCHES_KEY, id] as const,
    enabled: !!id,
    refetchOnMount: 'always' as const,
    queryFn: async (): Promise<RanchFlat> => {
      const { data, error } = await apiClient.GET('/api/v1/geo_assets/ranches/{id}/', {
        params: { path: { id: id! } },
      })
      if (error) throw new Error('No se pudo cargar el rancho')
      return flattenRanch(data!)
    },
  })
}

export function useRanchDetail(id: string | null) {
  return useQuery(ranchDetailQueryOptions(id))
}

type RanchPayload = NonNullable<components['schemas']['Ranch']['properties']> & {
  geometry?: components['schemas']['Ranch']['geometry']
}

function toRanchFeature(payload: RanchPayload): components['schemas']['Ranch'] {
  const { geometry, ...props } = payload
  return { type: 'Feature', geometry: geometry ?? undefined, properties: props }
}

export function useCreateRanch() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: RanchPayload): Promise<RanchFlat> => {
      const { data, error } = await apiClient.POST('/api/v1/geo_assets/ranches/create/', {
        body: toRanchFeature(payload),
      })
      if (error) throw error
      return flattenRanch(data!)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: RANCHES_KEY })
    },
  })
}

export function useUpdateRanch() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: RanchPayload }): Promise<RanchFlat> => {
      const { data, error } = await apiClient.PATCH('/api/v1/geo_assets/ranches/{id}/update/', {
        params: { path: { id } },
        body: toRanchFeature(payload),
      })
      if (error) throw error
      return flattenRanch(data!)
    },
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: RANCHES_KEY })
      queryClient.invalidateQueries({ queryKey: [...RANCHES_KEY, id] })
    },
  })
}

export function useDeleteRanch() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await apiClient.DELETE('/api/v1/geo_assets/ranches/{id}/delete/', {
        params: { path: { id } },
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: RANCHES_KEY })
    },
  })
}
