/**
 * Resumen estadistico de los 15 indices de una sesion NDVI.
 *
 * GET /api/v1/monitoring/ndvi/headers/<id>/variable-stats/
 *
 * Espejo de useAspersionVariableStats. Se calcula al vuelo en el servidor sobre los
 * puntos importados (sin vista materializada), asi que refleja el estado actual: tras
 * reimportar o vaciar la sesion basta invalidar la query.
 */
import { useQuery } from '@tanstack/react-query'
import { tokens } from '@/lib/auth/tokens'

export interface NdviVariableStat {
  key: string
  label: string
  count: number
  mean: number | null
  min: number | null
  max: number | null
  stddev: number | null
}

export interface NdviVariableStatsResponse {
  header_id: string
  points_count: number
  variables: NdviVariableStat[]
}

export const NDVI_VARIABLE_STATS_KEY = 'ndvi-variable-stats'

// Endpoint nuevo (aun no en api.d.ts) -> fetch directo con el token, como el de aspersion.
export function useNdviVariableStats(headerId: string | null | undefined, enabled = true) {
  return useQuery({
    queryKey: [NDVI_VARIABLE_STATS_KEY, headerId] as const,
    enabled: !!headerId && enabled,
    queryFn: async (): Promise<NdviVariableStatsResponse> => {
      const baseUrl = import.meta.env.VITE_API_BASE_URL
      const res = await fetch(
        `${baseUrl}/monitoring/ndvi/headers/${headerId}/variable-stats/`,
        { headers: { Authorization: `Bearer ${tokens.getAccess() ?? ''}` } },
      )
      if (!res.ok) throw new Error('No se pudo cargar el resumen de la sesion NDVI')
      return (await res.json()) as NdviVariableStatsResponse
    },
    staleTime: 60_000,
  })
}
