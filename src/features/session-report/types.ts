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
  productor?: string | null
  rancho?: string | null
  parcela?: string | null
  superficie_parcela_ha?: number | string | null
  ubicacion?: string | null
  cultivo?: string | null
  fecha_aplicacion?: string | null
}

/** `stats_snapshot` cuantitativo (serializado como JSON por el backend). */
export interface StatsSnapshot {
  points_count?: number | null
  area_cobertura_ha?: number | string | null
  dosis_promedio_l?: number | string | null
  media_meta_l?: number | string | null
  volumen_total_l?: number | string | null
  fecha_inicio?: string | null
  fecha_fin?: string | null
  variables?: Partial<Record<'velocidad' | 'flujo_liquido' | 'presion', StatsVariable>>
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
