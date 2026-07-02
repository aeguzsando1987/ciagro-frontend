import { z } from 'zod'
import { todayIso } from '../lib/dates'

/**
 * Opciones de enums de `SessionIssue` (valores exactos del backend, con espacios literales;
 * ver schema OpenAPI). El default de `attention_status` es `sin atender`.
 */
export const ISSUE_TYPE_OPTIONS = [
  { value: 'observacion', label: 'Observación' },
  { value: 'tema de atencion', label: 'Tema de atención' },
] as const

export const RELEVANCIA_OPTIONS = [
  { value: 'alta', label: 'Alta' },
  { value: 'media', label: 'Media' },
  { value: 'baja', label: 'Baja' },
  { value: 'na', label: 'N/A' },
] as const

export const ATTENTION_STATUS_OPTIONS = [
  { value: 'sin atender', label: 'Sin atender' },
  { value: 'en atencion', label: 'En atención' },
  { value: 'solucionado', label: 'Solucionado' },
  { value: 'sin solucion', label: 'Sin solución' },
  { value: 'na', label: 'N/A' },
] as const

export const sessionIssueSchema = z.object({
  issue_type: z.enum(['observacion', 'tema de atencion']),
  title: z.string().trim().min(1, 'El título es obligatorio'),
  detail: z.string().trim().optional(),
  relevancia: z.enum(['alta', 'media', 'baja', 'na']),
  attention_status: z.enum([
    'solucionado',
    'sin atender',
    'en atencion',
    'sin solucion',
    'na',
  ]),
  registered_at: z.string().min(1, 'La fecha de registro es obligatoria'),
  followed_up_at: z.string().optional().nullable(),
  suggestion: z.string().trim().optional(),
  action_taken: z.string().trim().optional(),
  assigned_user: z.string().optional().nullable(),
  outer_assigned_user: z.string().trim().optional(),
})

export type SessionIssueFormValues = z.infer<typeof sessionIssueSchema>

export const SESSION_ISSUE_FORM_FIELDS = [
  'issue_type',
  'title',
  'detail',
  'relevancia',
  'attention_status',
  'registered_at',
  'followed_up_at',
  'suggestion',
  'action_taken',
  'assigned_user',
  'outer_assigned_user',
] as const

export function emptyIssueForm(): SessionIssueFormValues {
  return {
    issue_type: 'tema de atencion',
    title: '',
    detail: '',
    relevancia: 'media',
    attention_status: 'sin atender',
    registered_at: todayIso(),
    followed_up_at: null,
    suggestion: '',
    action_taken: '',
    assigned_user: null,
    outer_assigned_user: '',
  }
}
