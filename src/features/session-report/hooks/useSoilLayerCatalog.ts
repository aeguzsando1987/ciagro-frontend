/**
 * Catalogo de las 49 capas de mapeo de suelo, agrupado (FASE RS).
 *
 * GET /monitoring/soil-map/layers/
 *
 * Lo sirve el BACKEND, no `soilMapLayers.ts`: la agrupacion del reporte sigue el
 * orden de D5 y diverge a proposito de la del visor. Es constante del sistema —sin
 * consulta a BD ni scope de tenant—, de ahi el `staleTime` de sesion.
 */
import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api/client'

/** `numeric` lleva histograma y percentiles; `category`, reparto por clase. */
export type SoilLayerKind = 'numeric' | 'category'

export interface SoilLayerMeta {
  key: string
  label: string
  /** Campo del modelo. Es la llave contra `buildLayerCountMap`, no `key`. */
  field: string
  group: string
  unit: string
  kind: SoilLayerKind
  /** Clases de la paleta. NO siempre 7: hay capas de 1 y de 8 (H8). */
  class_count: number
  /** Cortes que espera el freeze: `class_count - 1`. */
  break_count: number
  palette: string[]
}

export interface SoilLayerGroup {
  group: string
  layers: SoilLayerMeta[]
}

export interface SoilLayerCatalog {
  count: number
  groups: SoilLayerGroup[]
}

export const SOIL_LAYER_CATALOG_KEY = 'soil-layer-catalog'

export function useSoilLayerCatalog(enabled = true) {
  return useQuery({
    queryKey: [SOIL_LAYER_CATALOG_KEY] as const,
    enabled,
    queryFn: async (): Promise<SoilLayerCatalog> => {
      const { data, error } = await apiClient.GET('/api/v1/monitoring/soil-map/layers/')
      if (error || !data) throw new Error('No se pudo cargar el catalogo de capas de suelo')
      // El schema tipa la respuesta como objeto libre (OpenApiTypes.OBJECT), asi que
      // la forma se declara aqui. Lo que si valida el compilador es la ruta.
      return data as unknown as SoilLayerCatalog
    },
    staleTime: Infinity,
  })
}

/** Aplana los grupos conservando su orden, para buscar una capa por `key`. */
export function flattenLayers(catalog: SoilLayerCatalog | undefined): SoilLayerMeta[] {
  return catalog?.groups.flatMap((g) => g.layers) ?? []
}
