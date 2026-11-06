import { useQuery } from '@tanstack/react-query'
import { tokens } from '@/lib/auth/tokens'
import { z } from 'zod'

export const variableStatsSchema = z.object({
  points_count: z.number().int().nonnegative(),
  variables: z.array(z.object({
    key: z.string(), label: z.string(), count: z.number(),
    mean: z.number().nullable(), min: z.number().nullable(), max: z.number().nullable(), stddev: z.number().nullable(),
  })),
})

export interface VariableStat {
  key: string
  label: string
  count: number
  mean: number | null
  min: number | null
  max: number | null
  stddev: number | null
}

export interface VariableStatsResponse {
  points_count: number
  variables: VariableStat[]
}

// Endpoint nuevo (no en api.d.ts aún) → fetch directo con el token, como useCurrentUser.
export function useAspersionVariableStats(headerId: string | null, enabled = true) {
  return useQuery({
    queryKey: ['aspersion-variable-stats', headerId] as const,
    enabled: !!headerId && enabled,
    queryFn: async (): Promise<VariableStatsResponse> => {
      const baseUrl = import.meta.env.VITE_API_BASE_URL
      const res = await fetch(
        `${baseUrl}/monitoring/aspersion/headers/${headerId}/variable-stats/`,
        { headers: { Authorization: `Bearer ${tokens.getAccess() ?? ''}` } },
      )
      if (!res.ok) throw new Error('No se pudo cargar el resumen de la importación')
      const parsed = variableStatsSchema.safeParse(await res.json())
      if (!parsed.success) throw new Error('El resumen de aspersión tiene un formato incorrecto. Reintenta la consulta.')
      return parsed.data
    },
    staleTime: 60_000,
  })
}
