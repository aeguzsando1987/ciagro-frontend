import { queryOptions, useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api/client'
import type { PhytosanitaryCatalog, PhytosanitaryPhotoCreate, PhytosanitaryStage } from '../types'

export const PHYTO_KEY = ['admin', 'phytosanitary'] as const

export function phytosanitaryQueryOptions(filters?: { default_crop?: number; type?: string }) {
  return queryOptions({
    queryKey: [...PHYTO_KEY, filters] as const,
    queryFn: async (): Promise<PhytosanitaryCatalog[]> => {
      const { data, error } = await apiClient.GET('/api/v1/agro-catalogs/phytosanitary/', {
        params: {
          query: {
            ...(filters?.default_crop ? { default_crop: filters.default_crop } : {}),
            ...(filters?.type ? { type: filters.type } : {}),
          },
        },
      })
      if (error) throw new Error('No se pudo cargar el catálogo fitosanitario')
      return data?.results ?? []
    },
    staleTime: 30_000,
  })
}

export function usePhytosanitaryCatalogs(filters?: { default_crop?: number; type?: string }) {
  return useQuery(phytosanitaryQueryOptions(filters))
}

export function phytosanitaryDetailQueryOptions(id: number | null) {
  return queryOptions({
    queryKey: [...PHYTO_KEY, id] as const,
    enabled: !!id,
    // Fuerza refetch al remontar el panel para que stage_photos esté fresco
    refetchOnMount: 'always' as const,
    queryFn: async (): Promise<PhytosanitaryCatalog> => {
      const { data, error } = await apiClient.GET('/api/v1/agro-catalogs/phytosanitary/{id}/', {
        params: { path: { id: id! } },
      })
      if (error) throw new Error('No se pudo cargar el fitosanitario')
      return data!
    },
  })
}

export function usePhytosanitaryDetail(id: number | null) {
  return useQuery(phytosanitaryDetailQueryOptions(id))
}

type PhytoPayload = {
  name: string
  type?: 'Plaga' | 'Enfermedad'
  default_crop_id?: number | null
  description?: string | null
  min_ref_value?: number | null
  max_ref_value?: number | null
}

export function useCreatePhytosanitary() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: PhytoPayload): Promise<PhytosanitaryCatalog> => {
      const { data, error } = await apiClient.POST('/api/v1/agro-catalogs/phytosanitary/create/', {
        body: payload as never,
      })
      if (error) throw error
      return data!
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PHYTO_KEY })
    },
  })
}

export function useUpdatePhytosanitary() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      payload,
    }: {
      id: number
      payload: Partial<PhytoPayload>
    }): Promise<PhytosanitaryCatalog> => {
      const { data, error } = await apiClient.PATCH(
        '/api/v1/agro-catalogs/phytosanitary/{id}/update/',
        {
          params: { path: { id } },
          body: payload as never,
        },
      )
      if (error) throw error
      return data!
    },
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: PHYTO_KEY })
      queryClient.invalidateQueries({ queryKey: [...PHYTO_KEY, id] })
    },
  })
}

type CreatePhotoPayload = {
  phytosanitary_id: number
  stage: PhytosanitaryStage
  photo: File
  caption?: string
}

export function useCreatePhytoPhoto() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreatePhotoPayload): Promise<PhytosanitaryPhotoCreate> => {
      const fd = new FormData()
      fd.append('phytosanitary_id', String(payload.phytosanitary_id))
      fd.append('stage', payload.stage)
      fd.append('photo', payload.photo)
      if (payload.caption) fd.append('caption', payload.caption)

      const { data, error } = await apiClient.POST(
        '/api/v1/agro-catalogs/phytosanitary/photos/create/',
        {
          body: fd as never,
          bodySerializer: (b: unknown) => b as FormData,
        },
      )
      if (error) throw error
      return data!
    },
    onSuccess: (_data, { phytosanitary_id }) => {
      // Invalida detail para que stage_photos se refresque
      queryClient.invalidateQueries({ queryKey: [...PHYTO_KEY, phytosanitary_id] })
      queryClient.invalidateQueries({ queryKey: PHYTO_KEY })
    },
  })
}

export function useDeletePhytoPhoto() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      photoId,
    }: {
      photoId: number
      phytosanitaryId: number
    }): Promise<void> => {
      const { error } = await apiClient.DELETE(
        '/api/v1/agro-catalogs/phytosanitary/photos/{id}/delete/',
        { params: { path: { id: photoId } } },
      )
      if (error) throw error
    },
    onSuccess: (_data, { phytosanitaryId }) => {
      queryClient.invalidateQueries({ queryKey: [...PHYTO_KEY, phytosanitaryId] })
      queryClient.invalidateQueries({ queryKey: PHYTO_KEY })
    },
  })
}
