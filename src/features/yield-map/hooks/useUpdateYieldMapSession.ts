import { useMutation, useQueryClient } from '@tanstack/react-query'
import { yieldApiFetch } from '../api'
import type { YieldMapHeader } from '../types'

export function useUpdateYieldMapSession(id: string, masterId?: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (patch: Record<string, unknown>) =>
      yieldApiFetch<YieldMapHeader>(`/monitoring/yield-map/headers/${id}/update/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['yield-map-detail', id] })
      void client.invalidateQueries({ queryKey: ['yield-map', 'headers'] })
      if (masterId) void client.invalidateQueries({ queryKey: ['master-tree', masterId] })
    },
  })
}
