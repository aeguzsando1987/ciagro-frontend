import { queryOptions, useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api/client'
import type { CropCatalog } from '../types'

export const CROPS_KEY = ['admin', 'crops'] as const

export function cropsQueryOptions() {
  return queryOptions({
    queryKey: CROPS_KEY,
    queryFn: async (): Promise<CropCatalog[]> => {
      const { data, error } = await apiClient.GET('/api/v1/agro-catalogs/crops/')
      if (error) throw new Error('No se pudo cargar el catálogo de cultivos')
      return data?.results ?? []
    },
    staleTime: 30_000,
  })
}

export function useCrops() {
  return useQuery(cropsQueryOptions())
}

export function cropDetailQueryOptions(id: number | null) {
  return queryOptions({
    queryKey: [...CROPS_KEY, id] as const,
    enabled: !!id,
    refetchOnMount: 'always' as const,
    queryFn: async (): Promise<CropCatalog> => {
      const { data, error } = await apiClient.GET('/api/v1/agro-catalogs/crops/{id}/', {
        params: { path: { id: id! } },
      })
      if (error) throw new Error('No se pudo cargar el cultivo')
      return data!
    },
  })
}

export function useCropDetail(id: number | null) {
  return useQuery(cropDetailQueryOptions(id))
}

type CropPayload = {
  name: string
  code?: string | null
  variety?: string | null
  description?: string | null
  photo?: File | null
}

function buildCropFormData(payload: CropPayload): FormData | Omit<CropPayload, 'photo'> {
  if (!payload.photo) {
    const { photo: _photo, ...rest } = payload
    return rest
  }
  const fd = new FormData()
  fd.append('name', payload.name)
  if (payload.code) fd.append('code', payload.code)
  if (payload.variety) fd.append('variety', payload.variety)
  if (payload.description) fd.append('description', payload.description)
  fd.append('photo', payload.photo)
  return fd
}

export function useCreateCrop() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CropPayload): Promise<CropCatalog> => {
      const body = buildCropFormData(payload)
      const isFormData = body instanceof FormData
      const { data, error } = await apiClient.POST('/api/v1/agro-catalogs/crops/create/', {
        body: body as never,
        ...(isFormData ? { bodySerializer: (b: unknown) => b as FormData } : {}),
      })
      if (error) throw error
      return data!
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CROPS_KEY })
    },
  })
}

export function useUpdateCrop() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, payload }: { id: number; payload: CropPayload }): Promise<CropCatalog> => {
      const body = buildCropFormData(payload)
      const isFormData = body instanceof FormData
      const { data, error } = await apiClient.PATCH('/api/v1/agro-catalogs/crops/{id}/update/', {
        params: { path: { id } },
        body: body as never,
        ...(isFormData ? { bodySerializer: (b: unknown) => b as FormData } : {}),
      })
      if (error) throw error
      return data!
    },
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: CROPS_KEY })
      queryClient.invalidateQueries({ queryKey: [...CROPS_KEY, id] })
    },
  })
}
