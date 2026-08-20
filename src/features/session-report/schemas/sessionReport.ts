import { z } from 'zod'
import { isFutureDate, todayIso } from '../lib/dates'

/**
 * Validación del formulario de reporte (regla de negocio en UI; el backend revalida).
 * - `resume_text` obligatorio.
 * - `report_date` obligatoria, no futura (default hoy).
 * - Las tres temperaturas del día (media/mín/máx) opcionales, numéricas si se proveen.
 *   Se capturan a mano o se traen de NASA POWER con el botón del formulario.
 */
export const STATUS_OPTIONS = [
  { value: 'en_proceso', label: 'En proceso' },
  { value: 'finalizado', label: 'Finalizado' },
  { value: 'cancelado', label: 'Cancelado' },
  { value: 'publicado', label: 'Publicado' },
] as const

/**
 * Normaliza la coma decimal a punto.
 *
 * Los `input type="number"` se PINTAN con el separador del locale (en es-MX,
 * 19.94 se ve "19,94"), y hay navegadores que además aceptan que se teclee la
 * coma. `Number("19,94")` es NaN, así que sin esto un valor que en pantalla se
 * ve bien se rechazaría como inválido.
 */
export function normalizeDecimal(value: string): string {
  return value.replace(',', '.')
}

/** Temperatura del día a grados enteros, o '' si no hay valor. */
export function toWholeDegrees(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return ''
  const n = Number(typeof value === 'string' ? normalizeDecimal(value.trim()) : value)
  return Number.isFinite(n) ? String(Math.round(n)) : ''
}

/**
 * Temperatura opcional, en grados ENTEROS.
 *
 * La regla vive aquí y NO en el `step` del input a propósito: con `step="1"` el
 * navegador dispara su propia validación ("Introduce un valor válido"), que no
 * dice cuál es el problema y no se puede traducir. Con `step="any"` el input
 * calla y el mensaje lo damos nosotros.
 */
const temperatura = () =>
  z
    .string()
    .trim()
    .refine((v) => v === '' || !Number.isNaN(Number(normalizeDecimal(v))), 'Temperatura inválida')
    .refine(
      (v) => v === '' || Number.isInteger(Number(normalizeDecimal(v))),
      'Usa grados enteros, sin decimales'
    )
    .optional()

export const sessionReportSchema = z.object({
  resume_text: z.string().trim().min(1, 'El resumen es obligatorio'),
  report_date: z
    .string()
    .min(1, 'La fecha es obligatoria')
    .refine((v) => !isFutureDate(v), 'La fecha no puede ser futura'),
  day_temperature: temperatura(),
  day_temperature_min: temperatura(),
  day_temperature_max: temperatura(),
  lead: z.string().trim().optional(),
  ranch_manager: z.string().trim().optional(),
  figure_description: z.string().trim().optional(),
  status: z.enum(['en_proceso', 'finalizado', 'cancelado', 'publicado']),
})

export type SessionReportFormValues = z.infer<typeof sessionReportSchema>

export const SESSION_REPORT_FORM_FIELDS = [
  'resume_text',
  'report_date',
  'day_temperature',
  'day_temperature_min',
  'day_temperature_max',
  'lead',
  'ranch_manager',
  'figure_description',
  'status',
] as const

export function emptyReportForm(): SessionReportFormValues {
  return {
    resume_text: '',
    report_date: todayIso(),
    day_temperature: '',
    day_temperature_min: '',
    day_temperature_max: '',
    lead: '',
    ranch_manager: '',
    figure_description: '',
    status: 'en_proceso',
  }
}
