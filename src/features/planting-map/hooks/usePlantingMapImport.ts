import { useMutation, useQueryClient } from '@tanstack/react-query'
import { plantingApiFetch } from '../api'
import type { PlantingPreviewResult } from '../types'

interface PlantingFileRequest {
  headerId: string
  file: File
}

interface PlantingImportRequest extends PlantingFileRequest {
  replace?: boolean
}

function formData(file: File, replace = false) {
  const body = new FormData()
  body.append('file', file)
  if (replace) body.append('replace', 'true')
  return body
}

export function usePreviewPlantingColumns() {
  return useMutation({
    mutationFn: ({ headerId, file }: PlantingFileRequest) =>
      plantingApiFetch<PlantingPreviewResult>(
        `/monitoring/planting-map/headers/${headerId}/preview-columns/`,
        { method: 'POST', body: formData(file) },
      ),
  })
}

export function useImportPlantingData() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ headerId, file, replace = false }: PlantingImportRequest) =>
      plantingApiFetch<{
        imported_rows: number
        skipped_rows: number
        available_layers: string[]
        source_product: string | null
        source_lot: string | null
        warnings: unknown[]
      }>(
        `/monitoring/planting-map/headers/${headerId}/import/`,
        { method: 'POST', body: formData(file, replace) },
      ),
    onSuccess: (_data, { headerId }) => {
      void client.invalidateQueries({ queryKey: ['planting-map-detail', headerId] })
      void client.invalidateQueries({ queryKey: ['planting-map-stats', headerId] })
      void client.invalidateQueries({ queryKey: ['planting-map-layer-values', headerId] })
      void client.invalidateQueries({ queryKey: ['planting-map', 'headers'] })
    },
  })
}
