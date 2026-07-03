import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { apiClient } from '@/lib/api/client'
import type { SessionIssue } from '../types'

/**
 * CRUD de temas de atención / observaciones (`SessionIssue`) de un reporte.
 * Filtra por `?report=<uuid>`. Escritura: `IsTechnician` (el backend valida).
 */

export const SESSION_ISSUES_KEY = ['session-issues'] as const

export function sessionIssuesKey(reportId: string) {
  return [...SESSION_ISSUES_KEY, reportId] as const
}

export function sessionIssuesQueryOptions(reportId: string | null) {
  return queryOptions({
    queryKey: [...SESSION_ISSUES_KEY, reportId] as const,
    queryFn: async (): Promise<SessionIssue[]> => {
      const { data, error } = await apiClient.GET('/api/v1/field_ops/session-issues/', {
        params: { query: { report: reportId! } },
      })
      if (error) throw new Error('No se pudieron cargar los temas de atención')
      return data?.results ?? []
    },
    enabled: !!reportId,
    staleTime: 30_000,
  })
}

export function useSessionIssues(reportId: string | null) {
  return useQuery(sessionIssuesQueryOptions(reportId))
}

export type IssuePayload = Partial<Omit<SessionIssue, 'id' | 'issue_type_display' | 'relevancia_display' | 'attention_status_display' | 'assigned_user_name'>> & {
  report: string
}

export function useCreateSessionIssue(reportId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: IssuePayload): Promise<SessionIssue> => {
      const { data, error } = await apiClient.POST('/api/v1/field_ops/session-issues/', {
        body: payload as never,
      })
      if (error) throw error
      return data!
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...SESSION_ISSUES_KEY, reportId] })
    },
  })
}

export function useUpdateSessionIssue(reportId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (vars: { id: string; patch: Partial<IssuePayload> }): Promise<SessionIssue> => {
      const { data, error } = await apiClient.PATCH(
        '/api/v1/field_ops/session-issues/{id}/update/',
        { params: { path: { id: vars.id } }, body: vars.patch as never }
      )
      if (error) throw error
      return data!
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...SESSION_ISSUES_KEY, reportId] })
    },
  })
}

export function useDeleteSessionIssue(reportId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await apiClient.DELETE(
        '/api/v1/field_ops/session-issues/{id}/delete/',
        { params: { path: { id } } }
      )
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...SESSION_ISSUES_KEY, reportId] })
    },
  })
}
