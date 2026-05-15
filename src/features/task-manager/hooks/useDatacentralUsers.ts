import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api/client'

export interface UserMinimal {
  id: string
  username: string
  full_name: string
}

export function useDatacentralUsers(datacentralId: string | null | undefined) {
  return useQuery({
    queryKey: ['dc-users', datacentralId] as const,
    queryFn: async () => {
      const { data, error } = await apiClient.GET(
        '/api/v1/users/by-datacentral/{dc_id}/' as never,
        { params: { path: { dc_id: datacentralId! } } } as never,
      )
      if (error) throw new Error('No se pudieron cargar los usuarios')
      return ((data as { results?: UserMinimal[] }).results ?? []) as UserMinimal[]
    },
    enabled: !!datacentralId,
    staleTime: 60_000,
  })
}
