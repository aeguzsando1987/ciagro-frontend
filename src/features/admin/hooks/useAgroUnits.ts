import { queryOptions, useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api/client'
import type { AgroUnit } from '../types'
import type { components } from '@/types/api'

export const AGRO_UNITS_QUERY_KEY = ['admin', 'agro-units'] as const

export function agroUnitsQueryOptions(unitType?: string) {
  return queryOptions({
    queryKey: unitType ? [...AGRO_UNITS_QUERY_KEY, { unitType }] : AGRO_UNITS_QUERY_KEY,
    queryFn: async (): Promise<AgroUnit[]> => {
      const { data, error } = await apiClient.GET('/api/v1/organizations/', {
        params: unitType ? { query: { unit_type: unitType } as never } : undefined,
      })
      if (error) throw new Error('No se pudo cargar las agrounidades')
      return data?.results ?? []
    },
    staleTime: 30_000,
  })
}

export function useAgroUnits(unitType?: string) {
  return useQuery(agroUnitsQueryOptions(unitType))
}

export function agroUnitDetailQueryOptions(id: string | null) {
  return queryOptions({
    queryKey: [...AGRO_UNITS_QUERY_KEY, id] as const,
    enabled: !!id,
    queryFn: async (): Promise<AgroUnit> => {
      const { data, error } = await apiClient.GET('/api/v1/organizations/{id}/', {
        params: { path: { id: id! } },
      })
      if (error) throw new Error('No se pudo cargar la agrounidad')
      return data!
    },
    staleTime: 30_000,
  })
}

export function useAgroUnitDetail(id: string | null) {
  return useQuery(agroUnitDetailQueryOptions(id))
}

type AgroUnitPayload = components['schemas']['PatchedAgroUnit']

export function useCreateAgroUnit() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: AgroUnitPayload) => {
      const { data, error } = await apiClient.POST('/api/v1/organizations/create/', {
        body: payload as components['schemas']['AgroUnit'],
      })
      if (error) throw error
      return data!
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: AGRO_UNITS_QUERY_KEY })
    },
  })
}

export function useUpdateAgroUnit() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: AgroUnitPayload }) => {
      const { data, error } = await apiClient.PATCH('/api/v1/organizations/{id}/update/', {
        params: { path: { id } },
        body: payload,
      })
      if (error) throw error
      return data!
    },
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: AGRO_UNITS_QUERY_KEY })
      queryClient.invalidateQueries({ queryKey: [...AGRO_UNITS_QUERY_KEY, id] })
    },
  })
}
