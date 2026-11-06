import { useQuery, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { apiClient } from '@/lib/api/client'

const stateSchema = z.object({
  prepared: z.boolean(), stale: z.boolean(), frozen: z.boolean(), download_available: z.boolean(),
  version: z.string().nullable(), prepared_at: z.string().nullable(), current_source_version: z.string().nullable(),
  message: z.string(), history: z.array(z.object({ version: z.string(), prepared_at: z.string() })),
})

export async function fetchReportPdfState(reportId: string) {
  const { data, response } = await apiClient.GET('/api/v1/field_ops/session-reports/{id}/pdf-state/' as never,
    { params: { path: { id: reportId } } } as never)
  if (!response.ok) throw new Error(`No se pudo verificar la vigencia del PDF (HTTP ${response.status}).`)
  const result = stateSchema.safeParse(data)
  if (!result.success) throw new Error('Respuesta de vigencia inválida. Reintenta la consulta.')
  return result.data
}

export function useReportPdfState(reportId: string, revision: string, enabled: boolean) {
  const qc = useQueryClient()
  const query = useQuery({ queryKey: ['report-pdf-state', reportId, revision], queryFn: () => fetchReportPdfState(reportId),
    enabled, retry: false, staleTime: 10_000, refetchOnWindowFocus: 'always' })
  return { ...query, refreshPoints: (objectId: string) => qc.invalidateQueries({ queryKey: ['aspersion-points', objectId] }) }
}
