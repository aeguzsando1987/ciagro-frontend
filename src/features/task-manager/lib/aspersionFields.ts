/**
 * Campos del modelo AspersionSessionPoints que se pueden mapear desde un CSV.
 *
 * IMPORTANTE: refleja las claves de DEFAULT_COLUMN_MAPPING en el backend
 * (apps/datalayers/aspersion_mapping.py). Si allí se agregan/renombran campos,
 * sincronizar esta lista. Usado para poblar el desplegable de remapeo manual
 * de columnas no reconocidas en AspersionImportDialog.
 */
export interface AspersionField {
  field: string
  label: string
}

export const ASPERSION_FIELDS: AspersionField[] = [
  // Geolocalización
  { field: 'lon', label: 'Longitud' },
  { field: 'lat', label: 'Latitud' },
  // Identificación
  { field: 'timestamp', label: 'Tiempo / fecha-hora' },
  { field: 'pass_number', label: 'Número de paso' },
  // Geolocalización complementaria
  { field: 'elevation_m', label: 'Elevación (m)' },
  { field: 'course_deg', label: 'Curso (deg)' },
  { field: 'vehicle_heading', label: 'Orientación vehículo (deg)' },
  { field: 'distance_m', label: 'Distancia (m)' },
  { field: 'duration_s', label: 'Duración (s)' },
  { field: 'speed_kmh', label: 'Velocidad (km/h)' },
  // Calidad GNSS
  { field: 'satellites', label: 'Satélites' },
  { field: 'gnss_hdop', label: 'HDOP' },
  { field: 'gnss_vdop', label: 'VDOP' },
  { field: 'gnss_pdop', label: 'PDOP' },
  { field: 'is_diff_active', label: 'Diferencial activo' },
  { field: 'diff_mode', label: 'Modo diferencial' },
  // Guiado
  { field: 'xte_implement', label: 'XTE implemento (m)' },
  { field: 'xte_vehicle', label: 'XTE vehículo (m)' },
  { field: 'is_steering_active', label: 'Dirección activada' },
  // Aplicación
  { field: 'is_area_counting', label: 'Cuenta de área' },
  { field: 'active_rows', label: 'Filas activas' },
  { field: 'app_status', label: 'Estado de aplicación' },
  { field: 'boom_width_m', label: 'Ancho de faja (m)' },
  { field: 'liquid_flow_ls', label: 'Flujo líquido (L/s)' },
  { field: 'boom_pressure_bar', label: 'Presión brazo (bar)' },
  { field: 'press_ag_kpa', label: 'Presión Ag (kPa)' },
  { field: 'press_aux_kpa', label: 'Presión Aux (kPa)' },
  { field: 'production_hah', label: 'Producción (ha/h)' },
  // Boquillas
  { field: 'droplet_size', label: 'Tamaño de gota' },
  { field: 'nozzle_color', label: 'Color de boquilla' },
  { field: 'nozzle_capacity', label: 'Capacidad boquilla (L/min)' },
  { field: 'nozzle_ref_pressure', label: 'Presión ref. boquilla (bar)' },
  // Tasa y evaluación
  { field: 'target_rate_l', label: 'Tasa meta (L/ha)' },
  { field: 'applied_rate_l', label: 'Tasa aplicada (L/ha)' },
  { field: 'product_quantity', label: 'Cantidad de producto' },
  { field: 'area_ha', label: 'Área (ha)' },
  { field: 'rate_quality', label: 'Calidad de tasa' },
  { field: 'evaluation', label: 'Evaluación aplicación' },
]
