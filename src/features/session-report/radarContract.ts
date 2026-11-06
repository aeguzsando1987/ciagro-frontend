import { z } from 'zod'

const numeric = z.number().finite().nullable()
const indicator = z.object({
  id: z.string(), name: z.string(), value: numeric, unit: z.string(),
  converted_value: z.object({ value: z.number().finite(), unit: z.string() }).nullable().optional(),
  target: z.object({ min: z.number().finite().optional(), max: z.number().finite().optional(), value: z.number().finite().optional() }).nullable(),
  deviation: numeric, score: z.number().min(0).max(100).nullable(),
  status: z.string(), opinion: z.string(), available: z.boolean(), rule: z.string(),
  stability: z.object({
    avg: numeric, min: numeric, max: numeric, unit: z.string(), count: z.number().int().nonnegative(),
    stddev: numeric, within_pct: numeric, below_pct: numeric, above_pct: numeric, method: z.string(),
  }).optional(),
})
const ids = ['volume_ratio', 'speed_kmh', 'pressure_bar', 'flow_ls', 'productivity_hah', 'target_compliance_pct']
export const radarSchema = z.object({
  catalog_status: z.enum(['PROVISIONAL', 'APROBADO']).nullable().optional(),
  provisional_note: z.string().nullable().optional(),
  indicators: z.array(indicator).length(6).refine(items => items.every((item, i) => item.id === ids[i])),
  score: z.number().min(0).max(100).nullable(), evaluated_count: z.number().int().min(0).max(6),
  pending_count: z.number().int().min(0).max(6), status: z.string(), weighting: z.string(),
})
export const radarV2Schema = z.object({
  version: z.literal('v2'), state: z.enum(['ready', 'empty', 'multi_configuration']),
  profile_status: z.enum(['APPROVED', 'PROVISIONAL']).nullable(), reason: z.string(),
  indicators: z.array(z.object({
    id: z.string(), name: z.string(), unit: z.string(), valid_count: z.number().int(), invalid_count: z.number().int(),
    statistics: z.object({ avg: numeric, min: numeric, max: numeric, stddev: numeric, p05: numeric, p50: numeric, p95: numeric, count: z.number().int() }),
    strict_compliance_pct: numeric, tolerant_compliance_pct: numeric, stability: numeric,
    score: numeric, official_score: numeric, status: z.string(), rule: z.string(),
  })),
  global: z.object({ weighted_six: numeric, three_pillars: numeric }).passthrough(),
  configuration_groups: z.array(z.object({ key: z.array(z.string()), points_count: z.number().int() }).passthrough()),
}).passthrough()
export const measurementRadarSchema = z.object({
  version: z.literal('measurement-v1'), state: z.enum(['ready', 'empty']), method: z.string(),
  indicators: z.array(z.object({
    id: z.string(), name: z.string(), unit: z.string(), value: numeric,
    scale_min: numeric, scale_max: numeric, position: numeric,
    scale_source: z.string(), reason: z.string(),
  })).length(6),
})
export const timelineSchema = z.object({
  resolution: z.enum(['hour', 'date', 'unavailable']), start: z.string().nullable(), end: z.string().nullable(),
  duration_seconds: numeric, duration_days: numeric, status: z.string(),
  series: z.array(z.object({
    at: z.string().refine(value => Number.isFinite(Date.parse(value))), area_ha: z.number().finite(),
    area_acumulada_ha: z.number().finite(), speed_kmh: numeric, pressure_bar: numeric,
    flow_ls: numeric, points_count: z.number().int().nonnegative(),
  })),
})
export const historicalReferenceSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('unavailable'), message: z.string() }),
  z.object({ status: z.literal('comparable'), group: z.string(),
    metrics: z.array(z.object({ id: z.string(), name: z.string(), unit: z.string(),
      value: numeric, p10: z.number().finite(), median: z.number().finite(),
      p90: z.number().finite(), percentile: numeric })).length(4),
    session_count: z.number().int().positive(), points_count: z.number().int().positive(),
    period: z.string(), source_file: z.string(), equipment_identity: z.string(),
    verified_at: z.string(), generated_at: z.string().nullable().optional(),
    version: z.string(), method: z.string(), warning: z.string() }),
])
export const radarPreviewSchema = z.object({
  object_id: z.string(), state: z.enum(['ready', 'empty', 'not_ready']),
  general_snapshot: z.object({
    organizacion: z.string().nullable().optional(), ciagro: z.string().nullable().optional(),
    productor: z.string().nullable().optional(), rancho: z.string().nullable().optional(),
    parcela: z.string().nullable().optional(), fecha_aplicacion: z.string().nullable().optional(),
    producto: z.string().nullable().optional(),
    catalogo_evaluacion: z.string().nullable().optional(), catalogo_evaluacion_id: z.string().nullable().optional(),
    catalogo_estado: z.enum(['PROVISIONAL', 'APROBADO']).nullable().optional(),
    catalogo_alcance_valido: z.boolean().optional(), catalogo_procedencia: z.string().nullable().optional(),
    catalogo_periodo_fuente: z.string().nullable().optional(), catalogo_muestra_sesiones: z.number().nullable().optional(),
    catalogo_fuera_periodo: z.boolean().optional(),
  }).passthrough(),
  stats_snapshot: z.object({
    points_count: z.number().int().nonnegative(), radar: radarSchema, linea_tiempo: timelineSchema,
    radar_v2: radarV2Schema.optional(),
    measurement_radar: measurementRadarSchema.optional(),
    historical_reference: historicalReferenceSchema.optional(),
  }).passthrough().nullable(),
}).refine(data => data.state === 'not_ready' || data.stats_snapshot !== null)

export type RadarPreview = z.infer<typeof radarPreviewSchema>
