import { queryOptions, useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api/client'
import type { DataCentralMainDetail, DataCentralDetail } from '../types'
import type { components } from '@/types/api'

// ── Query keys ────────────────────────────────────────────────────────────────

export const DCM_QUERY_KEY = ['admin', 'datacentralmains'] as const
export const DC_QUERY_KEY  = ['admin', 'datacentrals'] as const

// ── DataCentralMain ───────────────────────────────────────────────────────────

/**
 * @param includeInactive si true, incluye organizaciones con status inactivo
 *   (solo para el panel de Administración, que debe poder reactivarlas). Por defecto
 *   el backend ya excluye las inactivas del selector/visor.
 */
export function useDataCentralMains(includeInactive = false) {
  return useQuery(queryOptions({
    queryKey: includeInactive ? [...DCM_QUERY_KEY, 'all'] as const : DCM_QUERY_KEY,
    queryFn: async (): Promise<DataCentralMainDetail[]> => {
      const { data, error } = await apiClient.GET('/api/v1/organizations/data-centrals-main/', {
        params: { query: (includeInactive ? { include_inactive: 'true' } : {}) as never },
      })
      if (error) throw new Error('No se pudo cargar las organizaciones')
      return data?.results ?? []
    },
    staleTime: 30_000,
  }))
}

export function useDataCentralMainDetail(id: string | null) {
  return useQuery(queryOptions({
    queryKey: [...DCM_QUERY_KEY, id] as const,
    enabled: !!id,
    queryFn: async (): Promise<DataCentralMainDetail> => {
      const { data, error } = await apiClient.GET('/api/v1/organizations/data-centrals-main/{id}/', {
        params: { path: { id: id! } },
      })
      if (error) throw new Error('No se pudo cargar la organización')
      return data!
    },
    staleTime: 30_000,
  }))
}

type DCMWritePayload = components['schemas']['DataCentralMainWrite']

export function useCreateDataCentralMain() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: DCMWritePayload) => {
      const { data, error } = await apiClient.POST('/api/v1/organizations/data-centrals-main/create/', {
        body: payload,
      })
      if (error) throw error
      return data!
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: DCM_QUERY_KEY })
    },
  })
}

export function useUpdateDataCentralMain() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: DCMWritePayload }) => {
      const { data, error } = await apiClient.PATCH('/api/v1/organizations/data-centrals-main/{id}/update/', {
        params: { path: { id } },
        body: payload,
      })
      if (error) throw error
      return data!
    },
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: DCM_QUERY_KEY })
      queryClient.invalidateQueries({ queryKey: [...DCM_QUERY_KEY, id] })
    },
  })
}

// ── DataCentral ───────────────────────────────────────────────────────────────

/**
 * @param includeInactive si true, incluye CIAs de organizaciones inactivas (panel admin).
 *   Por defecto el backend ya las excluye del selector/visor.
 */
export function useDataCentrals(dcmId?: string, includeInactive = false) {
  return useQuery(queryOptions({
    queryKey: [
      ...(dcmId ? [...DC_QUERY_KEY, dcmId] : DC_QUERY_KEY),
      ...(includeInactive ? ['all'] : []),
    ] as const,
    queryFn: async (): Promise<DataCentralDetail[]> => {
      const query: Record<string, string> = {}
      if (dcmId) query['data_central_main'] = dcmId
      if (includeInactive) query['include_inactive'] = 'true'
      const { data, error } = await apiClient.GET('/api/v1/organizations/datacentrals/', {
        params: { query: query as never },
      })
      if (error) throw new Error('No se pudo cargar las CIAs')
      return data?.results ?? []
    },
    staleTime: 30_000,
  }))
}

type DCWritePayload = components['schemas']['DataCentralWrite']

export function useCreateDataCentral() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: DCWritePayload) => {
      const { data, error } = await apiClient.POST('/api/v1/organizations/datacentrals/create/', {
        body: payload,
      })
      if (error) throw error
      return data!
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: DC_QUERY_KEY })
      // Actualiza el conteo de CIAs en la lista de organizaciones y en user.datacentrals
      queryClient.invalidateQueries({ queryKey: DCM_QUERY_KEY })
      queryClient.invalidateQueries({ queryKey: ['me'] })
    },
  })
}

export function useUpdateDataCentral() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Partial<DCWritePayload> }) => {
      const { data, error } = await apiClient.PATCH('/api/v1/organizations/datacentrals/{id}/update/', {
        params: { path: { id } },
        body: payload as DCWritePayload,
      })
      if (error) throw error
      return data!
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: DC_QUERY_KEY })
    },
  })
}
