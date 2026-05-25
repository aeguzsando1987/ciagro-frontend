import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api/client'
import type { components } from '@/types/api'

export type AspersionTemplate = components['schemas']['AspersionImportTemplate']

/** Respuesta de preview-columns. El endpoint devuelve objeto libre (OpenApiTypes.OBJECT). */
export interface PreviewResult {
  matched: string[]
  unmatched: string[]
  col_map: Record<string, string>
}

/** column_mapping de una plantilla: campo_modelo → lista de alias de encabezado. */
export type ColumnMapping = Record<string, string[]>

export function useAspersionTemplates() {
  return useQuery({
    queryKey: ['aspersion-templates'] as const,
    queryFn: async (): Promise<AspersionTemplate[]> => {
      const { data, error } = await apiClient.GET('/api/v1/monitoring/aspersion/templates/')
      if (error) throw new Error('No se pudieron cargar las plantillas')
      return data?.results ?? []
    },
    staleTime: 60_000,
  })
}

export function usePreviewColumns() {
  return useMutation({
    mutationFn: async ({
      headerId,
      file,
      templateId,
    }: {
      headerId: string
      file: File
      templateId?: string
    }): Promise<PreviewResult> => {
      const fd = new FormData()
      fd.append('csv_file', file)
      const { data, error } = await apiClient.POST(
        '/api/v1/monitoring/aspersion/headers/{id}/preview-columns/',
        {
          params: {
            path: { id: headerId },
            // template_id lo lee la vista de query_params; no está tipado en el schema.
            ...(templateId ? { query: { template_id: templateId } } : {}),
          } as never,
          body: fd as never,
          bodySerializer: (b: unknown) => b as FormData,
        },
      )
      if (error) throw error
      return data as unknown as PreviewResult
    },
  })
}

export function useImportAspersionData() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      headerId,
      file,
      templateId,
    }: {
      headerId: string
      file: File
      templateId?: string
    }) => {
      const fd = new FormData()
      fd.append('csv_file', file)
      if (templateId) fd.append('template_id', templateId)
      const { data, error } = await apiClient.POST(
        '/api/v1/monitoring/aspersion/headers/{id}/import/',
        {
          params: { path: { id: headerId } },
          body: fd as never,
          bodySerializer: (b: unknown) => b as FormData,
        },
      )
      if (error) throw error
      return data
    },
    onSuccess: (_data, { headerId }) => {
      // Optimista: marcar 'processing' para arrancar el polling de inmediato.
      // El worker Celery fija PROCESSING como primera acción, así que el sondeo
      // siguiente lo confirma y continúa hasta el estado terminal (done/error).
      queryClient.setQueryData(
        ['aspersion-detail', headerId],
        (prev: unknown) =>
          prev && typeof prev === 'object'
            ? { ...(prev as Record<string, unknown>), import_status: 'processing' }
            : prev,
      )
      queryClient.invalidateQueries({ queryKey: ['aspersion-detail', headerId] })
    },
  })
}

export function useCreateAspersionTemplate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: {
      code: string
      name: string
      column_mapping: ColumnMapping
      decimal_separator?: string
    }): Promise<AspersionTemplate> => {
      const { data, error } = await apiClient.POST(
        '/api/v1/monitoring/aspersion/templates/create/',
        { body: payload as never },
      )
      if (error) throw error
      return data!
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aspersion-templates'] })
    },
  })
}
