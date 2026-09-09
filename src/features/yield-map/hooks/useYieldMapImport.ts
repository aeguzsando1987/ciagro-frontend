import { useMutation, useQueryClient } from '@tanstack/react-query'
import { yieldApiFetch } from '../api'

export interface YieldMapPreviewResult {
  valid_yield: true
  matched: string[]
  unmatched: string[]
  col_map: Record<string, string>
  quick_views: string[]
}

interface YieldMapFileRequest {
  headerId: string
  file: File
}

function formData(file: File) {
  const body = new FormData()
  body.append('csv_file', file)
  return body
}

export async function previewYieldMapColumns({ headerId, file }: YieldMapFileRequest) {
  return yieldApiFetch<YieldMapPreviewResult>(
    `/monitoring/yield-map/headers/${headerId}/preview-columns/`,
    { method: 'POST', body: formData(file) }
  )
}

export async function importYieldMapCsv({ headerId, file }: YieldMapFileRequest) {
  return yieldApiFetch<{ header_id: string; celery_task_id: string; detail: string }>(
    `/monitoring/yield-map/headers/${headerId}/import/`,
    { method: 'POST', body: formData(file) }
  )
}

export function usePreviewYieldMapColumns() {
  return useMutation({ mutationFn: previewYieldMapColumns })
}

export function useImportYieldMapData() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: importYieldMapCsv,
    onSuccess: (_data, { headerId }) => {
      client.setQueryData(['yield-map-detail', headerId], (previous: unknown) =>
        previous && typeof previous === 'object'
          ? { ...(previous as Record<string, unknown>), import_status: 'processing' }
          : previous
      )
      void client.invalidateQueries({ queryKey: ['yield-map-detail', headerId] })
      void client.invalidateQueries({ queryKey: ['yield-map-stats', headerId] })
    },
  })
}
