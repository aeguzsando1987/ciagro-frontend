import { useQuery } from '@tanstack/react-query'
import { tokens } from '@/lib/auth/tokens'

export interface SoilSlopeRange {
  min_pct: number
  max_pct: number | null
  area_ha: number
  plot_percentage: number
  covered_percentage: number
}

export interface SoilElevationAnalysis {
  header_id: string
  plot_id: string | null
  mapping_date: string
  elevation_unit: 'm'
  elevation: {
    unit: 'm'
    count: number
    min_m: number | null
    max_m: number | null
    mean_m: number | null
    range_m: number | null
    flat: boolean
  }
  quality: {
    total_points: number
    missing_elevation: number
    invalid_coordinates: number
    outside_plot: number
    duplicate_points: number
    conflicting_locations: number
    possible_outliers: number
  }
  trend: {
    status: string
    r_squared?: number
    ascent_direction?: string
    descent_direction?: string
  }
  slope: {
    status: string
    min_pct?: number
    max_pct?: number
    mean_pct?: number
    coverage_pct?: number
    covered_area_ha?: number
    uncovered_area_ha?: number
    distribution?: SoilSlopeRange[]
  }
}

export const SOIL_MAP_ELEVATION_KEY = 'soil-map-elevation'

export function useSoilMapElevation(headerId: string | null, enabled = true) {
  return useQuery({
    queryKey: [SOIL_MAP_ELEVATION_KEY, headerId] as const,
    enabled: !!headerId && enabled,
    queryFn: async (): Promise<SoilElevationAnalysis> => {
      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/monitoring/soil-map/headers/${headerId}/elevation/`,
        { headers: { Authorization: `Bearer ${tokens.getAccess() ?? ''}` } }
      )
      if (!response.ok) throw new Error('No se pudo cargar el resumen de elevación')
      const data = (await response.json()) as SoilElevationAnalysis
      if (data.elevation_unit !== 'm') throw new Error('Unidad de elevación no reconocida')
      return data
    },
    staleTime: 60_000,
  })
}
