import type { components } from '@/types/api'

/**
 * Tipos del Reporteador de Sesiones.
 *
 * Los modelos `SessionReport` / `SessionIssue` y sus enums vienen del schema OpenAPI
 * (regenerado con `npm run types:gen`). Los snapshots se serializan como JSON libre
 * (`unknown` en el schema), así que aquí los tipamos explícitamente según el contrato
 * del adapter de aspersión (Fase AC). Ver `.context/usecases/use-case-report-session.md`.
 */

export type SessionReport = components['schemas']['SessionReport']
export type SessionIssue = components['schemas']['SessionIssue']

export type SessionReportStatus = components['schemas']['SessionReportStatusEnum']
export type SessionType = components['schemas']['SessionTypeEnum']
export type IssueType = components['schemas']['IssueTypeEnum']
export type Relevancia = components['schemas']['RelevanciaEnum']
export type AttentionStatus = components['schemas']['AttentionStatusEnum']

/** Llaves de los 5 buckets del semáforo, en orden de mejor → peor cobertura. */
export type SemaforoBucketKey =
  | 'sobredosis'
  | 'excelente'
  | 'esperada'
  | 'baja'
  | 'deficiente'

export interface SemaforoBucket {
  /** Color provisto por el backend (fuente de verdad, GAP-AC-004). */
  color: string
  area_ha: number | string | null
  pct_area_total: number | string | null
}

export interface StatsVariable {
  avg: number | string | null
  min: number | string | null
  max: number | string | null
  unit: string
}

/** `general_snapshot` denormalizado (serializado como JSON por el backend). */
export interface GeneralSnapshot {
  actividad?: string | null
  organizacion?: string | null
  ciagro?: string | null
  catalogo_evaluacion?: string | null
  catalogo_evaluacion_id?: string | null
  catalogo_estado?: 'PROVISIONAL' | 'APROBADO' | null
  catalogo_alcance_valido?: boolean
  catalogo_procedencia?: string | null
  catalogo_periodo_fuente?: string | null
  catalogo_muestra_sesiones?: number | null
  catalogo_fuera_periodo?: boolean
  productor?: string | null
  rancho?: string | null
  parcela?: string | null
  superficie_parcela_ha?: number | string | null
  ubicacion?: string | null
  cultivo?: string | null
  fecha_aplicacion?: string | null
  producto?: string | null
}

/** `stats_snapshot` cuantitativo (serializado como JSON por el backend). */
export interface StatsSnapshot {
  points_count?: number | null
  area_cobertura_ha?: number | string | null
  dosis_promedio_l?: number | string | null
  media_meta_l?: number | string | null
  volumen_total_l?: number | string | null
  area_cobertura_metodo?: string | null
  superficie_parcela_ha?: number | string | null
  porcentaje_superficie_reportada?: number | string | null
  fecha_inicio?: string | null
  fecha_fin?: string | null
  historical_reference?: {
    status: 'unavailable' | 'comparable'
    message?: string
    group?: string
    metrics?: Array<{ id: string; name: string; unit: string; value: number | null; p10: number; median: number; p90: number; percentile: number | null }>
    session_count?: number
    points_count?: number
    period?: string
    source_file?: string
    equipment_identity?: string
    verified_at?: string
    generated_at?: string | null
    version?: string
    method?: string
    warning?: string
  }
  radar?: {
    catalog_status?: 'PROVISIONAL' | 'APROBADO' | null
    provisional_note?: string | null
    indicators: Array<{
      id: string
      name: string
      value: number | null
      unit: string
      converted_value?: { value: number; unit: string } | null
      target: { min?: number; max?: number; value?: number } | null
      deviation: number | null
      score: number | null
      status: string
      opinion: string
      available: boolean
      rule: string
      stability?: {
        avg: number | null; min: number | null; max: number | null; unit: string; count: number
        stddev: number | null; within_pct: number | null; below_pct: number | null; above_pct: number | null; method: string
      }
    }>
    score: number | null
    evaluated_count: number
    pending_count: number
    status: string
    weighting: string
  }
  /** Radar descriptivo de valores físicos; nunca contiene calificaciones. */
  measurement_radar?: {
    version: 'measurement-v1'
    state: 'ready' | 'empty'
    method: string
    indicators: Array<{
      id: string; name: string; unit: string; value: number | null
      scale_min: number | null; scale_max: number | null; position: number | null
      scale_source: string; reason: string
    }>
  }
  /** Vista previa no activa del motor por puntos. Nunca sustituye radar (V1). */
  radar_v2?: {
    version: 'v2'
    state: 'ready' | 'empty' | 'multi_configuration'
    profile_status: 'APPROVED' | 'PROVISIONAL' | null
    reason: string
    evaluated_count?: number
    pending_count?: number
    profile_resolution?: { source: string; catalog_id: string | null; name: string | null; reason: string }
    indicators: Array<{
      id: string; name: string; unit: string; valid_count: number; invalid_count: number
      statistics: { avg: number | null; min: number | null; max: number | null; stddev: number | null; p05: number | null; p50: number | null; p95: number | null; count: number }
      strict_compliance_pct: number | null; tolerant_compliance_pct: number | null; stability: number | null
      score: number | null; official_score: number | null; status: string; rule: string
    }>
    global: { weighted_six: number | null; three_pillars: number | null; reason?: string }
    configuration_groups: Array<{ key: string[]; points_count: number }>
  }
  linea_tiempo?: {
    resolution: 'hour' | 'date' | 'unavailable'
    start: string | null
    end: string | null
    duration_seconds: number | null
    duration_days: number | null
    status: string
    series: Array<{
      at: string
      area_ha: number
      area_acumulada_ha: number
      speed_kmh: number | null
      pressure_bar: number | null
      flow_ls: number | null
      points_count: number
    }>
  }
  variables?: Partial<Record<'velocidad' | 'flujo_liquido' | 'presion' | 'productividad', StatsVariable>>
  proporcion_meta?: Array<number | string>
  semaforo?: Partial<Record<SemaforoBucketKey, SemaforoBucket>>

  // ── Mapeo de suelo (FASE RS) ──
  /** Nota de escala relativa (P2): los cortes son cuantiles de ESTA sesión. */
  scale_note?: string | null
  /** Las 49 capas, congeladas al sincronizar. Sin paleta: los colores son del catálogo. */
  layers_summary?: SoilLayerSummary[]
  /** Capas congeladas al publicar, en orden del catálogo. Definen las páginas del PDF. */
  published_layers?: string[]
  /** Cortes, clases e histograma por capa publicada. Los produce el front (P1). */
  layers?: Record<string, SoilFrozenLayer>
}

/** Descriptivos de una capa. Las categóricas no traen media ni desviación. */
export interface SoilLayerSummary {
  key: string
  label: string
  field: string
  group: string
  unit: string
  kind: 'numeric' | 'category'
  class_count: number
  count: number
  mean?: number | null
  min?: number | null
  max?: number | null
  stddev?: number | null
  values?: Array<{ value: string; count: number }>
}

/** Lo que el front congela por capa al publicar. `breaks` tiene `class_count - 1`. */
export interface SoilFrozenLayer {
  /** Captura del mapa de la capa. La sirve el backend desde su Attachment. */
  image_url?: string | null
  breaks?: number[]
  classes?: Array<{
    index: number
    label?: string
    by_points?: { count?: number; pct?: number; area_ha?: number }
    by_area?: { pct?: number; area_ha?: number }
  }>
  histogram?: { bins?: Array<{ lower: number; upper: number; count: number }> }
  computed_at?: string
}

/** Acceso tipado a los snapshots de un reporte (el schema los expone como `unknown`). */
export function generalSnapshotOf(report: SessionReport): GeneralSnapshot {
  return (report.general_snapshot ?? {}) as GeneralSnapshot
}

export function statsSnapshotOf(report: SessionReport): StatsSnapshot {
  return (report.stats_snapshot ?? {}) as StatsSnapshot
}
