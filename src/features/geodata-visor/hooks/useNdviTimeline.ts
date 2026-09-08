

import {
  useQuery,
} from '@tanstack/react-query'

import {
  apiClient,
} from '@/lib/api/client'

/* =========================================================
   ITEM DE TIMELINE
   ========================================================= */

export interface NdviReferenceStage {
  start_week: number
  end_week: number
  label: string
  description: string
}

export interface NdviReferenceConfig {
  basis: 'weeks_from_crop_start' | string
  values: number[]
  good_max_deficit: number
  regular_max_deficit: number
  stages: NdviReferenceStage[]
  source: string
  version: string
}



export interface NdviAgronomicCycle {
  id: string
  name: string
  start_date: string | null
  end_date: string | null
  crop_id: number | null
  crop_name: string | null
  crop_code: string | null
  crop_variety_id: number | null
  crop_variety_name: string | null
  ndvi_reference: NdviReferenceConfig | null
}

export interface NdviTimelineItem {
  id: string

  session_date:
    string |
    null

  status:
    string

  import_status:
    string

  points_count:
    number

  /**
   * false significa que la sesión
   * no contiene valores NDVI.
   *
   * NDVI = 0 sigue siendo válido.
   */
  has_ndvi:
    boolean

  mean:
    number |
    null

  min:
    number |
    null

  max:
    number |
    null

  stddev:
    number |
    null

  /* =====================================================
     SUBCICLO PRODUCTIVO

     Aunque conservamos los nombres program/cycle
     para no romper otros componentes, estos campos
     representan el Programa HIJO.
     ===================================================== */

  program_id:
    string

  program_name:
    string

  /** Programa Maestro: solo contenedor; NO define la curva esperada. */
  master_program_id:
    string |
    null

  master_program_name:
    string |
    null

  /** El Programa hijo es el ciclo productivo real. */
  productive_cycle_id:
    string

  productive_cycle_name:
    string

  productive_cycle_start:
    string |
    null

  productive_cycle_end:
    string |
    null

  cycle_start:
    string |
    null

  cycle_end:
    string |
    null

  /* =====================================================
     CULTIVO / REFERENCIA AGRONÓMICA
     ===================================================== */

  crop_id:
    number |
    null

  crop_name:
    string |
    null

  crop_code:
    string |
    null

  crop_variety_id:
    number |
    null

  crop_variety_name:
    string |
    null

  reference_start:
    string |
    null

  reference_end:
    string |
    null

  ndvi_reference:
    NdviReferenceConfig |
    null

  agronomic_cycle_id:
    string |
    null

  agronomic_cycle_name:
    string |
    null

  agronomic_cycles:
    NdviAgronomicCycle[]
}

/* =========================================================
   HOOK
   ========================================================= */

export function useNdviTimeline(
  plotId:
    string |
    undefined
) {
  return useQuery({
    queryKey: [
      'ndvi-timeline',
      plotId,
    ],

    enabled:
      !!plotId,

    queryFn:
      async (): Promise<
        NdviTimelineItem[]
      > => {

        const {
          data,
          error,
        } =
          await apiClient.GET(
            '/api/v1/monitoring/ndvi/timeline/' as never,
            {
              params: {
                query: {
                  plot:
                    plotId!,
                } as never,
              },
            } as never
          )

        if (error) {
          throw error
        }

        return (
          data ??
          []
        ) as NdviTimelineItem[]
      },

    staleTime:
      30_000,
  })
}