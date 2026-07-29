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
  /** Colores por clase en modo quartile (uno por cuantil, de menor a mayor). */
  colors?: string[]
  bands?: Band[]
}

/**
 * Paleta secuencial por defecto para el modo quartile: rojo (bajo) -> azul (alto).
 * Es RdYlBu de ColorBrewer, la misma referencia que usa el backend (contours.py).
 */
export const QUARTILE_DEFAULT_PALETTE = [
  '#d73027', '#fc8d59', '#fee090', '#e0f3f8', '#91bfdb', '#4575b4',
] as const

/** N colores por defecto para `n` cuantiles, muestreados de la paleta secuencial. */
export function defaultQuartileColors(n: number): string[] {
  const count = Math.max(2, n)
  const last = QUARTILE_DEFAULT_PALETTE.length - 1
  return Array.from({ length: count }, (_, i) =>
    count <= 1
      ? QUARTILE_DEFAULT_PALETTE[0]
      : QUARTILE_DEFAULT_PALETTE[Math.round((i * last) / (count - 1))]!,
  )
}

/**
 * Colores de los `n` cuantiles de una config: usa los definidos por el usuario
 * (rellenando/recortando a `n`) o los de la paleta por defecto.
 */
export function resolveQuartileColors(cfg: VariableBandConfig, n: number): string[] {
  const defaults = defaultQuartileColors(n)
  const chosen = cfg.colors
  if (!chosen || chosen.length === 0) return defaults
  return defaults.map((d, i) => chosen[i] ?? d)
}

export interface NdviVariable {
  key: string
  label: string
}

export const NDVI_VAR_CONFIG_KEY = ['ndvi-variable-config'] as const

/**
 * @param tenant UUID del DataCentralMain a configurar. Requerido para SuperAdmin o para
 *   un Gerente dueño de más de una organización (el backend no puede resolverlo solo).
 *   Si se omite, el backend intenta resolverlo por el owner del usuario logueado.
 */
export function useNdviVariableConfig(tenant?: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: tenant ? [...NDVI_VAR_CONFIG_KEY, tenant] : NDVI_VAR_CONFIG_KEY,
    queryFn: async (): Promise<Record<string, unknown>> => {
      const { data, error } = await apiClient.GET('/api/v1/analytics-config/ndvi/', {
        params: { query: (tenant ? { tenant } : {}) as never },
      })
      if (error) throw error
      return (data ?? {}) as Record<string, unknown>
    },
    enabled: options?.enabled ?? true,
    // 403 (no es gerente dueño) no se reintenta: el visor usa el fallback.
    retry: false,
    staleTime: 60_000,
  })
}

/**
 * Config de variables NDVI resuelta por el TENANT DUEÑO de la parcela de la sesión
 * (no por el usuario logueado). La puede leer cualquier usuario con alcance sobre la
 * sesión, así el visor aplica los umbrales/colores del especialista sin importar quién
 * consulta. Usar esta en el visor; `useNdviVariableConfig` (owner-only) es para el panel
 * de administración donde el gerente edita SU config.
 */
export function useNdviSessionVariableConfig(sessionId: string | undefined) {
  return useQuery({
    queryKey: ['ndvi-session-variable-config', sessionId] as const,
    enabled: !!sessionId,
    queryFn: async (): Promise<Record<string, unknown>> => {
      const { data, error } = await apiClient.GET(
        '/api/v1/monitoring/ndvi/headers/{id}/variable-config/',
        { params: { path: { id: sessionId! } } },
      )
      if (error) throw error
      return (data ?? {}) as Record<string, unknown>
    },
    // Sin permiso/alcance -> el visor cae al gradiente; no reintentar.
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

export function useUpdateNdviVariableConfig(tenant?: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (patch: Record<string, VariableBandConfig>) => {
      const { data, error } = await apiClient.PATCH('/api/v1/analytics-config/ndvi/', {
        params: { query: (tenant ? { tenant } : {}) as never },
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
