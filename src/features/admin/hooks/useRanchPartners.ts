import { queryOptions, useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api/client'
import type { RanchPartner } from '../types'

export const RANCH_PARTNERS_KEY = ['admin', 'ranch-partners'] as const

export function ranchPartnersQueryOptions(ranchId: string | null) {
  return queryOptions({
    queryKey: [...RANCH_PARTNERS_KEY, ranchId] as const,
    enabled: !!ranchId,
    queryFn: async (): Promise<RanchPartner[]> => {
      const { data, error } = await apiClient.GET('/api/v1/geo_assets/ranch-partners/', {
        params: { query: { ranch: ranchId! } },
      })
      if (error) throw new Error('No se pudieron cargar los socios del rancho')
      return data?.results ?? []
    },
    staleTime: 30_000,
  })
}

export function useRanchPartners(ranchId: string | null) {
  return useQuery(ranchPartnersQueryOptions(ranchId))
}

type RanchPartnerCreate = Omit<RanchPartner, 'id'>

export function useCreateRanchPartner() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: RanchPartnerCreate): Promise<RanchPartner> => {
      const { data, error } = await apiClient.POST('/api/v1/geo_assets/ranch-partners/create/', {
        body: payload as never,
      })
      if (error) throw error
      return data!
    },
    onSuccess: (_data, { ranch }) => {
      queryClient.invalidateQueries({ queryKey: [...RANCH_PARTNERS_KEY, ranch] })
    },
  })
}

export function useDeleteRanchPartner() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id }: { id: number; ranchId: string }): Promise<void> => {
      const { error } = await apiClient.DELETE('/api/v1/geo_assets/ranch-partners/{id}/delete/', {
        params: { path: { id } },
      })
      if (error) throw error
    },
    onSuccess: (_data, { ranchId }) => {
      queryClient.invalidateQueries({ queryKey: [...RANCH_PARTNERS_KEY, ranchId] })
    },
  })
}
