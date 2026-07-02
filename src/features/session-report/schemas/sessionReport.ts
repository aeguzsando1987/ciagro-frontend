import { z } from 'zod'
import { isFutureDate, todayIso } from '../lib/dates'

/**
 * Validación del formulario de reporte (regla de negocio en UI; el backend revalida).
 * - `resume_text` obligatorio.
 * - `report_date` obligatoria, no futura (default hoy).
 * - `day_temperature` opcional, numérico si se provee.
 */
export const STATUS_OPTIONS = [
  { value: 'en_proceso', label: 'En proceso' },
  { value: 'finalizado', label: 'Finalizado' },
  { value: 'cancelado', label: 'Cancelado' },
  { value: 'publicado', label: 'Publicado' },
] as const

export const sessionReportSchema = z.object({
  resume_text: z.string().trim().min(1, 'El resumen es obligatorio'),
  report_date: z
    .string()
    .min(1, 'La fecha es obligatoria')
    .refine((v) => !isFutureDate(v), 'La fecha no puede ser futura'),
  day_temperature: z
    .string()
    .trim()
    .refine((v) => v === '' || !Number.isNaN(Number(v)), 'Temperatura inválida')
    .optional(),
  lead: z.string().trim().optional(),
  ranch_manager: z.string().trim().optional(),
  status: z.enum(['en_proceso', 'finalizado', 'cancelado', 'publicado']),
})

export type SessionReportFormValues = z.infer<typeof sessionReportSchema>

export const SESSION_REPORT_FORM_FIELDS = [
  'resume_text',
  'report_date',
  'day_temperature',
  'lead',
  'ranch_manager',
  'status',
] as const

export function emptyReportForm(): SessionReportFormValues {
  return {
    resume_text: '',
    report_date: todayIso(),
    day_temperature: '',
    lead: '',
    ranch_manager: '',
    status: 'en_proceso',
  }
}
