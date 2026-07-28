/**
 * Catálogo de configuración de variables NDVI del tenant (organización).
 *
 * GET/PATCH /api/v1/analytics-config/ndvi/   (singleton por tenant; nace con defaults quartile)
 * GET       /api/v1/analytics-config/ndvi/variables/  (las 15 variables: key + label)
 *
 * Solo un Gerente dueño de la organización (o SuperAdmin) puede leer/escribir su config; para
 * otros usuarios la lectura devuelve 403 y el visor cae al gradiente por cuartiles.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api/client'

/** Una banda del modo manual: intervalo [min,max) con etiqueta y color. min/max null = ±∞. */
export interface Band {
  order: number
  min: number | null
  max: number | null
  label: string
  color: string
}

export interface VariableBandConfig {
  strategy: 'quartile' | 'manual'
  mode?: 'absolute' | 'normalized'
  n_bands?: number
  palette?: string
  bands?: Band[]
}

export interface NdviVariable {
  key: string
  label: string
}

export const NDVI_VAR_CONFIG_KEY = ['ndvi-variable-config'] as const

export function useNdviVariableConfig() {
  return useQuery({
    queryKey: NDVI_VAR_CONFIG_KEY,
    queryFn: async (): Promise<Record<string, unknown>> => {
      const { data, error } = await apiClient.GET('/api/v1/analytics-config/ndvi/')
      if (error) throw error
      return (data ?? {}) as Record<string, unknown>
    },
    // 403 (no es gerente dueño) no se reintenta: el visor usa el fallback.
    retry: false,
    staleTime: 60_000,
  })
}

export function useNdviVariables() {
  return useQuery({
    queryKey: ['ndvi-variables-meta'] as const,
    queryFn: async (): Promise<NdviVariable[]> => {
      const { data, error } = await apiClient.GET('/api/v1/analytics-config/ndvi/variables/')
      if (error) throw error
      return (data ?? []) as NdviVariable[]
    },
    staleTime: 300_000,
  })
}

export function useUpdateNdviVariableConfig() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (patch: Record<string, VariableBandConfig>) => {
      const { data, error } = await apiClient.PATCH('/api/v1/analytics-config/ndvi/', {
        body: patch as never,
      })
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: NDVI_VAR_CONFIG_KEY })
    },
  })
}

/** Lee el config de una variable del objeto de config, con default quartile. */
export function readVariableConfig(config: Record<string, unknown> | undefined, key: string): VariableBandConfig {
  const raw = config?.[key]
  if (raw && typeof raw === 'object') return raw as VariableBandConfig
  return { strategy: 'quartile', n_bands: 4 }
}
