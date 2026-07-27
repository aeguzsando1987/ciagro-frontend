import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api/client'

/** Respuesta de preview-columns (OpenApiTypes.OBJECT en el backend). */
export interface NdviPreviewResult {
  matched: string[]
  unmatched: string[]
  col_map: Record<string, string>
}

/**
 * NDVI no usa plantillas de columnas: el mapeo es automatico en el backend (incluye
 * nombres acentuados). El preview solo confirma que columnas se reconocieron.
 */
export function usePreviewNdviColumns() {
  return useMutation({
    mutationFn: async ({ headerId, file }: { headerId: string; file: File }): Promise<NdviPreviewResult> => {
      const fd = new FormData()
      fd.append('csv_file', file)
      const { data, error } = await apiClient.POST(
        '/api/v1/monitoring/ndvi/headers/{id}/preview-columns/',
        {
          params: { path: { id: headerId } },
          body: fd as never,
          bodySerializer: (b: unknown) => b as FormData,
        },
      )
      if (error) throw error
      return data as unknown as NdviPreviewResult
    },
  })
}

export function useImportNdviData() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ headerId, file }: { headerId: string; file: File }) => {
      const fd = new FormData()
      fd.append('csv_file', file)
      const { data, error } = await apiClient.POST(
        '/api/v1/monitoring/ndvi/headers/{id}/import/',
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
      // Optimista: marcar 'processing' para arrancar el polling del detalle de inmediato.
      queryClient.setQueryData(['ndvi-detail', headerId], (prev: unknown) =>
        prev && typeof prev === 'object'
          ? { ...(prev as Record<string, unknown>), import_status: 'processing' }
          : prev,
      )
      queryClient.invalidateQueries({ queryKey: ['ndvi-detail', headerId] })
    },
  })
}
