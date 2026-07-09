/**
 * Hook de estadísticas agregadas de una sesión fitosanitaria (checkpoints).
 * Análogo categórico a useAspersionSessionStats.
 *
 * GET /api/v1/monitoring/phyto/headers/<id>/stats/
 */
import { useQuery } from '@tanstack/react-query'
import { tokens } from '@/lib/auth/tokens'

export interface PhytoIssueStat {
  id: number
  name: string
  type: string
  count: number
  qty_total: number
  critical: number
}

export interface PhytoSessionStats {
  checkpoints_count: number
  targets_count: number
  targets_visited: number
  presence: { low: number; warning: number; critical: number }
  captured_first: string | null
  captured_last: string | null
  by_issue: PhytoIssueStat[]
}

export function usePhytoSessionStats(headerId: string | null, enabled = true) {
  return useQuery({
    queryKey: ['phyto-session-stats', headerId] as const,
    enabled: !!headerId && enabled,
    queryFn: async (): Promise<PhytoSessionStats> => {
      const baseUrl = import.meta.env.VITE_API_BASE_URL as string
      const res = await fetch(
        `${baseUrl}/monitoring/phyto/headers/${headerId}/stats/`,
        { headers: { Authorization: `Bearer ${tokens.getAccess() ?? ''}` } },
      )
      if (!res.ok) throw new Error('stats no disponibles')
      return (await res.json()) as PhytoSessionStats
    },
    staleTime: 60_000,
  })
}
