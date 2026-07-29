import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api/client'

export interface SoilMapPreviewResult {
  matched: string[]
  unmatched: string[]
  col_map: Record<string, string>
}

interface SoilMapFileRequest {
  headerId: string
  file: File
}

function toFormData(file: File) {
  const formData = new FormData()
  formData.append('csv_file', file)
  return formData
}

export async function previewSoilMapColumns({
  headerId,
  file,
}: SoilMapFileRequest): Promise<SoilMapPreviewResult> {
  const formData = toFormData(file)
  const { data, error } = await apiClient.POST(
    '/api/v1/monitoring/soil-map/headers/{id}/preview-columns/',
    {
      params: { path: { id: headerId } },
      body: formData as never,
      bodySerializer: (body: unknown) => body as FormData,
    }
  )
  if (error || !data) throw error ?? new Error('No se pudieron analizar las columnas')
  return data as unknown as SoilMapPreviewResult
}

export async function importSoilMapCsv({ headerId, file }: SoilMapFileRequest) {
  const formData = toFormData(file)
  const { data, error } = await apiClient.POST('/api/v1/monitoring/soil-map/headers/{id}/import/', {
    params: { path: { id: headerId } },
    body: formData as never,
    bodySerializer: (body: unknown) => body as FormData,
  })
  if (error || !data) throw error ?? new Error('No se pudo iniciar la importación')
  return data
}

export function usePreviewSoilMapColumns() {
  return useMutation({ mutationFn: previewSoilMapColumns })
}

export function useImportSoilMapData() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: importSoilMapCsv,
    onSuccess: (_data, { headerId }) => {
      queryClient.setQueryData(['soil-map-detail', headerId], (previous: unknown) =>
        previous && typeof previous === 'object'
          ? { ...(previous as Record<string, unknown>), import_status: 'processing' }
          : previous
      )
      queryClient.invalidateQueries({ queryKey: ['soil-map-detail', headerId] })
      queryClient.invalidateQueries({ queryKey: ['soil-map-session-stats', headerId] })
    },
  })
}
