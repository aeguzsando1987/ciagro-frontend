import { queryOptions, useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api/client'
import type { AgroSector } from '../types'

export const AGRO_SECTORS_QUERY_KEY = ['admin', 'agro-sectors'] as const

export function agroSectorsQueryOptions() {
  return queryOptions({
    queryKey: AGRO_SECTORS_QUERY_KEY,
    queryFn: async (): Promise<AgroSector[]> => {
      const { data, error } = await apiClient.GET('/api/v1/organizations/agro_sectors/')
      if (error) throw new Error('No se pudo cargar los sectores agrícolas')
      return data?.results ?? []
    },
    staleTime: 60_000,
  })
}

export function useAgroSectors() {
  return useQuery(agroSectorsQueryOptions())
}

export function useCreateAgroSector() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { sector_name: string; scian_code?: string; activity_name: string; description?: string }) => {
      const { data, error } = await apiClient.POST('/api/v1/organizations/agro_sectors/create/', {
        body: payload as never,
      })
      if (error) throw error
      return data!
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: AGRO_SECTORS_QUERY_KEY })
    },
  })
}
