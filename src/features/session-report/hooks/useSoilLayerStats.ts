/**
 * Estadisticos e histograma de UNA capa de suelo (FASE RS).
 *
 * GET /monitoring/soil-map/headers/<id>/layer-stats/?layer=<key>&bins=<n>
 *
 * Endpoint aparte de `/variable-stats/`, que es la llamada barata con la que el
 * visor decide que capas tienen datos. Medido sobre la sesion de 16,944 puntos:
 * 0.022-0.024 s con histograma de 20 bins, asi que se pide por capa al vuelo.
 *
 * El histograma trae CONTEOS DE PUNTOS, no hectareas: `SoilMapPoints` no tiene
 * area (H9). El eje Y en Ha lo completa el front desde su raster.
 */
import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api/client'
import type { SoilLayerMeta } from './useSoilLayerCatalog'

/** Bin `[lower, upper)`; el ultimo cierra por la derecha para no perder el maximo. */
export interface SoilHistogramBin {
  lower: number
  upper: number
  count: number
}

export interface SoilHistogram {
  bin_count: number
  bins: SoilHistogramBin[]
}

/** Reparto de una capa categorica, de la clase mas frecuente a la menos. */
export interface SoilCategoryCount {
  value: string
  count: number
}

interface SoilLayerStatsBase {
  header_id: string
  layer: SoilLayerMeta
  /** Puntos de la sesion. `count` son los que tienen valor en ESTA capa. */
  points_count: number
  count: number
  nulls: number
}

export interface SoilNumericLayerStats extends SoilLayerStatsBase {
  mean: number | null
  min: number | null
  max: number | null
  stddev: number | null
  /** Resisten los outliers, habituales en suelo (D2). */
  median: number | null
  p10: number | null
  p90: number | null
  /** Coeficiente de variacion: heterogeneidad de la parcela. Null si la media es 0. */
  cv: number | null
  histogram: SoilHistogram
}

export interface SoilCategoryLayerStats extends SoilLayerStatsBase {
  values: SoilCategoryCount[]
}

export type SoilLayerStats = SoilNumericLayerStats | SoilCategoryLayerStats

/** Discrimina la union por el `kind` del catalogo, no por presencia de campos. */
export function isNumericStats(stats: SoilLayerStats): stats is SoilNumericLayerStats {
  return stats.layer.kind === 'numeric'
}

export const SOIL_LAYER_STATS_KEY = 'soil-layer-stats'

/** 20 barras es lo que pide D3; el backend acota el rango a 5-50. */
export const DEFAULT_BINS = 20

export function useSoilLayerStats(
  headerId: string | null | undefined,
  layerKey: string | null | undefined,
  bins: number = DEFAULT_BINS,
) {
  return useQuery({
    // `bins` en la key: cambiar el numero de barras es otra respuesta, no la misma.
    queryKey: [SOIL_LAYER_STATS_KEY, headerId, layerKey, bins] as const,
    enabled: !!headerId && !!layerKey,
    queryFn: async (): Promise<SoilLayerStats> => {
      const { data, error } = await apiClient.GET(
        '/api/v1/monitoring/soil-map/headers/{id}/layer-stats/',
        { params: { path: { id: headerId! }, query: { layer: layerKey!, bins } } },
      )
      if (error || !data) throw new Error('No se pudieron cargar los estadisticos de la capa')
      return data as unknown as SoilLayerStats
    },
    staleTime: 60_000,
  })
}
