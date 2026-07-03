/**
 * Formulario de un tema de atención / observación (`SessionIssue`), create y edit.
 * Responsable: usuario interno (Select por datacentral, si se provee `datacentralId`) o texto
 * externo libre (`outer_assigned_user`). El enganche de "actividad relacionada" (related_*)
 * queda diferido (F4).
 */
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { applyDrfErrors } from '@/features/task-manager/hooks/useDrfErrorMap'
import { useDatacentralUsers } from '@/features/task-manager/hooks/useDatacentralUsers'
import {
  sessionIssueSchema,
  emptyIssueForm,
  ISSUE_TYPE_OPTIONS,
  RELEVANCIA_OPTIONS,
  ATTENTION_STATUS_OPTIONS,
  SESSION_ISSUE_FORM_FIELDS,
  type SessionIssueFormValues,
} from '../schemas/sessionIssue'
import {
  useCreateSessionIssue,
  useUpdateSessionIssue,
  type IssuePayload,
} from '../hooks/useSessionIssues'
import type { SessionIssue } from '../types'

const NONE = '__none__'

interface IssueFormProps {
  reportId: string
  issue?: SessionIssue
  datacentralId?: string | null
  onDone: () => void
  onCancel: () => void
}

function defaultsFrom(issue: SessionIssue): SessionIssueFormValues {
  return {
    issue_type: issue.issue_type ?? 'tema de atencion',
    title: issue.title ?? '',
    detail: issue.detail ?? '',
    relevancia: issue.relevancia ?? 'media',
    attention_status: issue.attention_status ?? 'sin atender',
    registered_at: issue.registered_at ?? emptyIssueForm().registered_at,
    followed_up_at: issue.followed_up_at ?? null,
    suggestion: issue.suggestion ?? '',
    action_taken: issue.action_taken ?? '',
    assigned_user: issue.assigned_user ?? null,
    outer_assigned_user: issue.outer_assigned_user ?? '',
  }
}

export function IssueForm({ reportId, issue, datacentralId, onDone, onCancel }: IssueFormProps) {
  const isEdit = !!issue
  const createMut = useCreateSessionIssue(reportId)
  const updateMut = useUpdateSessionIssue(reportId)
  const { data: users = [] } = useDatacentralUsers(datacentralId ?? null)

  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors },
  } = useForm<SessionIssueFormValues>({
    resolver: zodResolver(sessionIssueSchema),
    defaultValues: issue ? defaultsFrom(issue) : emptyIssueForm(),
  })

  function handleDrf(e: unknown) {
    if (typeof e === 'object' && e !== null) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      applyDrfErrors(e as any, setError, SESSION_ISSUE_FORM_FIELDS)
    }
  }

  function onSubmit(values: SessionIssueFormValues) {
    const payload: IssuePayload = {
      report: reportId,
      issue_type: values.issue_type,
      title: values.title.trim(),
      detail: values.detail?.trim() ?? '',
      relevancia: values.relevancia,
      attention_status: values.attention_status,
      registered_at: values.registered_at,
      followed_up_at: values.followed_up_at || null,
      suggestion: values.suggestion?.trim() ?? '',
      action_taken: values.action_taken?.trim() ?? '',
      assigned_user: values.assigned_user || null,
      outer_assigned_user: values.outer_assigned_user?.trim() ?? '',
    }

    if (isEdit) {
      updateMut.mutate(
        { id: issue!.id, patch: payload },
        { onSuccess: onDone, onError: handleDrf }
      )
    } else {
      createMut.mutate(payload, { onSuccess: onDone, onError: handleDrf })
    }
  }

  const pending = createMut.isPending || updateMut.isPending

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3 rounded border bg-muted/30 p-3">
      {errors.root && (
        <p className="rounded bg-destructive/10 p-2 text-xs text-destructive">{errors.root.message}</p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>Tipo</Label>
          <Controller
            name="issue_type"
            control={control}
            render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ISSUE_TYPE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="if-reg">Fecha de registro *</Label>
          <Input id="if-reg" type="date" {...register('registered_at')} />
          {errors.registered_at && (
            <p className="text-xs text-destructive">{errors.registered_at.message}</p>
          )}
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="if-title">Título *</Label>
        <Input id="if-title" {...register('title')} />
        {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>Relevancia</Label>
          <Controller
            name="relevancia"
            control={control}
            render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {RELEVANCIA_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
        <div className="space-y-1">
          <Label>Estatus de atención</Label>
          <Controller
            name="attention_status"
            control={control}
            render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ATTENTION_STATUS_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="if-detail">Detalle</Label>
        <textarea
          id="if-detail"
          rows={2}
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          {...register('detail')}
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="if-action">Acción implementada</Label>
        <textarea
          id="if-action"
          rows={2}
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          {...register('action_taken')}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>Responsable interno</Label>
          {datacentralId ? (
            <Controller
              name="assigned_user"
              control={control}
              render={({ field }) => (
                <Select
                  onValueChange={(v) => field.onChange(v === NONE ? null : v)}
                  value={field.value || NONE}
                >
                  <SelectTrigger><SelectValue placeholder="Sin asignar" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Sin asignar</SelectItem>
                    {users.map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.full_name || u.username}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          ) : (
            <p className="text-xs text-muted-foreground">
              {issue?.assigned_user_name || '—'}
            </p>
          )}
        </div>
        <div className="space-y-1">
          <Label htmlFor="if-outer">Responsable externo</Label>
          <Input id="if-outer" placeholder="Nombre (externo)" {...register('outer_assigned_user')} />
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="if-follow">Fecha de seguimiento</Label>
        <Input id="if-follow" type="date" {...register('followed_up_at')} />
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={pending}>
          Cancelar
        </Button>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? 'Guardando…' : isEdit ? 'Guardar' : 'Agregar'}
        </Button>
      </div>
    </form>
  )
}
