/**
 * Hook de estadísticas agregadas de una sesión de aspersión (MV mv_aspersion_session_stats).
 * Extraído de AspersionMapModal para poder reutilizarlo desde el Visor de Datos Agrícolas.
 *
 * GET /api/v1/monitoring/aspersion/headers/<id>/stats/
 */
import { useQuery } from '@tanstack/react-query'
import { tokens } from '@/lib/auth/tokens'

export interface AspersionSessionStats {
  points_count: number
  area_total_ha: string
  mean_target_l: string | null
  mean_applied_l: string | null
  ratio_applied: string | null
  pct_below: string | null
  pct_in_range: string | null
  pct_above: string | null
}

export function useAspersionSessionStats(headerId: string | null, enabled = true) {
  return useQuery({
    queryKey: ['aspersion-session-stats', headerId] as const,
    enabled: !!headerId && enabled,
    queryFn: async (): Promise<AspersionSessionStats> => {
      const baseUrl = import.meta.env.VITE_API_BASE_URL as string
      const res = await fetch(
        `${baseUrl}/monitoring/aspersion/headers/${headerId}/stats/`,
        { headers: { Authorization: `Bearer ${tokens.getAccess() ?? ''}` } },
      )
      if (!res.ok) throw new Error('stats no disponibles')
      return (await res.json()) as AspersionSessionStats
    },
    staleTime: 60_000,
  })
}
