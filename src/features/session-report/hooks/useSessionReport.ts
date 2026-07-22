import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { apiClient } from '@/lib/api/client'
import type { SessionReport, SessionType } from '../types'

/**
 * Hooks del reporte de sesión (uno por sesión).
 *
 * Consume la API de Fase AC (`/field_ops/session-reports/`). El backend valida permisos
 * (`IsTechnician` para escribir) y reglas (datos cargados, resume oblig., fecha no futura);
 * la UI solo hace gate de visibilidad y muestra errores DRF por campo.
 */

export const SESSION_REPORT_KEY = ['session-report'] as const

export function sessionReportKey(sessionType: SessionType, objectId: string) {
  return [...SESSION_REPORT_KEY, sessionType, objectId] as const
}

/** Trae el reporte único de una sesión (o `null` si aún no existe). */
export function sessionReportQueryOptions(
  sessionType: SessionType,
  objectId: string | null
) {
  return queryOptions({
    queryKey: [...SESSION_REPORT_KEY, sessionType, objectId] as const,
    queryFn: async (): Promise<SessionReport | null> => {
      const { data, error } = await apiClient.GET('/api/v1/field_ops/session-reports/', {
        params: { query: { session_type: sessionType, object_id: objectId! } },
      })
      if (error) throw new Error('No se pudo cargar el reporte de la sesión')
      return data?.results?.[0] ?? null
    },
    enabled: !!objectId,
    staleTime: 30_000,
  })
}

export function useSessionReport(sessionType: SessionType, objectId: string | null) {
  return useQuery(sessionReportQueryOptions(sessionType, objectId))
}

export interface CreateReportInput {
  session_type: SessionType
  object_id: string
  resume_text: string
  report_date?: string
  day_temperature?: string | null
  lead?: string
  ranch_manager?: string
  figure_description?: string
  status?: SessionReport['status']
}

export function useCreateSessionReport(sessionType: SessionType, objectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreateReportInput): Promise<SessionReport> => {
      const { data, error } = await apiClient.POST('/api/v1/field_ops/session-reports/', {
        body: input as never,
      })
      if (error) throw error
      return data!
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [...SESSION_REPORT_KEY, sessionType, objectId],
      })
    },
  })
}

export type UpdateReportPatch = Partial<{
  resume_text: string
  report_date: string
  day_temperature: string | null
  figure_description: string
  lead: string
  ranch_manager: string
  status: SessionReport['status']
}>

/** PATCH del reporte. **No** recalcula stats (eso es exclusivo de `sync`). */
export function useUpdateSessionReport(
  reportId: string,
  sessionType: SessionType,
  objectId: string
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (patch: UpdateReportPatch): Promise<SessionReport> => {
      const { data, error } = await apiClient.PATCH(
        '/api/v1/field_ops/session-reports/{id}/update/',
        { params: { path: { id: reportId } }, body: patch as never }
      )
      if (error) throw error
      return data!
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [...SESSION_REPORT_KEY, sessionType, objectId],
      })
    },
  })
}

export class ReportPublishedError extends Error {
  constructor() {
    super('El reporte está publicado y no puede sincronizarse')
    this.name = 'ReportPublishedError'
  }
}

/**
 * "Sincronizar datos de sesión": recalcula snapshots desde la sesión.
 * Devuelve **409** si el reporte está `publicado` → lanzamos `ReportPublishedError`.
 */
export function useSyncSessionReport(
  reportId: string,
  sessionType: SessionType,
  objectId: string
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (): Promise<SessionReport> => {
      const { data, error, response } = await apiClient.POST(
        '/api/v1/field_ops/session-reports/{id}/sync/',
        { params: { path: { id: reportId } } }
      )
      if (response.status === 409) throw new ReportPublishedError()
      if (error) throw error
      return data!
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [...SESSION_REPORT_KEY, sessionType, objectId],
      })
    },
  })
}
