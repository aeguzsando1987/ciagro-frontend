export type PlantingImportStatus = 'pending' | 'processing' | 'done' | 'error'
export type PlantingSessionStatus =
  | 'pending'
  | 'in_progress'
  | 'loaded'
  | 'completed'
  | 'cancelled'

export type PlantingLayerKey =
  | 'applied_rate'
  | 'target_rate'
  | 'mass_flow'
  | 'applied_rate_mass'
  | 'target_rate_mass'
  | 'density'
  | 'singulation'
  | 'seed_spacing'
  | 'skips'
  | 'doubles'
  | 'rate_quality'
  | 'speed'
  | 'productivity'

export interface PlantingMapHeader {
  id: string
  program: string
  plot: string
  planting_date: string
  est_init_date: string | null
  est_finish_date: string | null
  real_init_date: string | null
  real_finish_date: string | null
  status: PlantingSessionStatus
  assigned_to: { id: string; username: string } | null
  import_status: PlantingImportStatus
  import_errors: unknown
  imported_at: string | null
  source_filename: string | null
  source_encoding: string | null
  source_lot: string | null
  source_product: string | null
  source_dataset: string | null
  source_start_date: string | null
  source_finish_date: string | null
  source_row_count: number
  source_area_ha: number | null
  source_distance_m: number | null
  source_schema: Record<string, unknown>
  available_layers: PlantingLayerKey[]
  points_count: number
  created_at: string
  updated_at: string
}

export interface PlantingNumericStats {
  label: string
  unit: string
  minimum: number | null
  maximum: number | null
  average: number | null
  count: number
}

export interface PlantingCategoryStat {
  value: string
  count: number
  percentage: number
}

export interface PlantingMapStats {
  session_id: string
  planting_date: string
  source_lot: string | null
  source_product: string | null
  source_dataset: string | null
  source_start_date: string | null
  source_finish_date: string | null
  available_layers: PlantingLayerKey[]
  source_schema: Record<string, unknown>
  totals: {
    point_count: number
    area_ha: number | null
    distance_m: number | null
  }
  numeric: Partial<Record<PlantingLayerKey, PlantingNumericStats>>
  rate_quality: PlantingCategoryStat[]
}

export type PlantingLayerSample = [
  longitude: number,
  latitude: number,
  value: number | string,
  courseDeg: number | null,
  swathWidthM: number | null,
  distanceM: number | null,
  sourceObjectId: number | null,
]

export interface PlantingLayerValues {
  layer: PlantingLayerKey
  label: string
  unit: string
  kind: 'numeric' | 'category'
  count: number
  points: Array<[number, number, number | string]>
  samples?: PlantingLayerSample[]
}

export interface PlantingPreviewResult {
  valid: boolean
  profile: string
  planting_mode: 'count' | 'mass' | 'telemetry' | null
  row_count: number
  raw_columns: string[]
  unique_columns: string[]
  duplicate_columns: Array<{ name: string; count: number }>
  recognized_columns: string[]
  mapped_fields: string[]
  unknown_columns: string[]
  planting_signals: string[]
  available_layers: PlantingLayerKey[]
  detail: string
}
