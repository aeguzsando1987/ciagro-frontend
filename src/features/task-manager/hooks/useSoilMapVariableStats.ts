/**
 * Resumen estadistico por variable de una sesion de mapeo de suelo.
 *
 * GET /api/v1/monitoring/soil-map/headers/<id>/variable-stats/
 *
 * Espejo de useNdviVariableStats y useAspersionVariableStats. Se calcula al vuelo
 * en el servidor sobre los puntos importados (sin vista materializada), asi que
 * refleja el estado actual: tras reimportar o vaciar la sesion basta invalidar la
 * query.
 *
 * En el Visor cumple una funcion que va mas alla del reporte: sus ~5 KB dicen QUE
 * CAPAS TIENEN DATOS sin descargar un solo punto. Antes eso se sabia recorriendo
 * las 49 capas sobre los 16,944 puntos ya descargados; con la precarga por campos
 * esos valores ya no estan en memoria, y sin este endpoint el combobox de
 * variables se quedaria vacio.
 */
import { useQuery } from '@tanstack/react-query'
import { tokens } from '@/lib/auth/tokens'

export interface SoilMapVariableStat {
  key: string
  label: string
  count: number
  mean: number | null
  min: number | null
  max: number | null
  stddev: number | null
}

/** Reparto de una variable categorica, de la categoria mas frecuente a la menos. */
export interface SoilMapCategoryCount {
  value: string
  count: number
}

/**
 * Las categoricas no llevan metricas numericas: una media de "clase textural" no
 * existe. Lo informativo es el reparto, asi que en su lugar viene `values`.
 */
export interface SoilMapTextVariableStat {
  key: string
  label: string
  /** Puntos con valor, excluyendo nulos y cadenas vacias. */
  count: number
  values: SoilMapCategoryCount[]
}

export interface SoilMapVariableStatsResponse {
  header_id: string
  points_count: number
  variables: SoilMapVariableStat[]
  text_variables: SoilMapTextVariableStat[]
}

export const SOIL_MAP_VARIABLE_STATS_KEY = 'soil-map-variable-stats'

export function useSoilMapVariableStats(
  headerId: string | null | undefined,
  enabled = true
) {
  return useQuery({
    queryKey: [SOIL_MAP_VARIABLE_STATS_KEY, headerId] as const,
    enabled: !!headerId && enabled,
    queryFn: async (): Promise<SoilMapVariableStatsResponse> => {
      const baseUrl = import.meta.env.VITE_API_BASE_URL
      const res = await fetch(
        `${baseUrl}/monitoring/soil-map/headers/${headerId}/variable-stats/`,
        { headers: { Authorization: `Bearer ${tokens.getAccess() ?? ''}` } },
      )
      if (!res.ok) throw new Error('No se pudo cargar el resumen de la sesion de suelo')
      return (await res.json()) as SoilMapVariableStatsResponse
    },
    staleTime: 60_000,
  })
}

/**
 * Conteo de valores por NOMBRE DE CAMPO del modelo, uniendo numericas y
 * categoricas. Es la forma en que el Visor consulta "esta capa tiene datos": las
 * capas de `soilMapLayers.ts` se identifican por su `field`, no por la clave del
 * endpoint (que resulta ser la misma, pero depender de esa coincidencia seria
 * fragil).
 */
export function buildLayerCountMap(
  stats: SoilMapVariableStatsResponse | undefined
): Map<string, number> {
  const counts = new Map<string, number>()
  if (!stats) return counts
  for (const variable of stats.variables) counts.set(variable.key, variable.count)
  for (const variable of stats.text_variables) counts.set(variable.key, variable.count)
  return counts
}
