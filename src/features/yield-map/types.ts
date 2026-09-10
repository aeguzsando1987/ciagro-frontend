export type YieldImportStatus = 'pending' | 'processing' | 'done' | 'error' | 'pending_mapping'
export type YieldSessionStatus = 'pending' | 'in_progress' | 'loaded' | 'completed' | 'cancelled'

export interface YieldMapHeader {
  id: string
  program: string
  plot: string | null
  harvest_date: string
  status: YieldSessionStatus
  assigned_to: { id: string; username: string } | null
  est_init_date: string | null
  est_finish_date: string | null
  real_init_date: string | null
  real_finish_date: string | null
  import_status: YieldImportStatus
  import_errors: unknown
  imported_at: string | null
  points_count: number
  source_lot: string | null
  source_product: string | null
  source_dataset: string | null
  created_at: string
  updated_at: string
}

export interface YieldMapPoint {
  id: string
  session_header: string
  geom: { type: 'Point'; coordinates: [number, number] } | null
  source_object_id: number | null
  lot_label: string | null
  dataset_label: string | null
  product: string | null
  sample_date: string | null
  course_deg: number | null
  swath_width_m: number | null
  distance_m: number | null
  duration_s: number | null
  elevation_m: number | null
  speed_kmh: number | null
  satellites: number | null
  vehicle_heading: number | null
  active_rows: number | null
  vdop: number | null
  hdop: number | null
  pdop: number | null
  grain_flow_t_h: number | null
  moisture_pct: number | null
  grain_temperature_c: number | null
  elevator_speed_rpm: number | null
  pass_number: number | null
  yield_t_ha: number | null
  dry_yield_t_ha: number | null
  dry_yield_l_ha: number | null
  wet_yield_t_ha: number | null
  wet_yield_l_ha: number | null
  field_capacity_ha_h: number | null
  grain_flow_m3_s: number | null
  area_ha: number | null
  grain_mass_t: number | null
  created_at: string
}

export type YieldLayerKey =
  | 'yield_t_ha'
  | 'moisture_pct'
  | 'speed_kmh'
  | 'grain_flow_t_h'
  | 'elevation_m'

export interface YieldLayerStats {
  label: string
  count: number
  min: number | null
  max: number | null
  mean: number | null
}

export interface YieldMapStats {
  header_id: string
  harvest_date: string
  status: YieldSessionStatus
  import_status: YieldImportStatus
  imported_at: string | null
  points_count: number
  yield_avg: number | null
  yield_min: number | null
  yield_max: number | null
  moisture_avg: number | null
  speed_avg: number | null
  elevation_avg: number | null
  grain_flow_avg: number | null
  production_total_t: number | null
  surface_total_ha: number | null
  layers: Record<YieldLayerKey, YieldLayerStats>
}

export interface PaginatedYieldPoints {
  count: number
  next: string | null
  previous: string | null
  results: YieldMapPoint[]
}
