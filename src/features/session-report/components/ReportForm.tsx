/**
 * Formulario del reporte (crear y editar). Sigue el idiom de los edit-forms del proyecto:
 * `react-hook-form` (register + Controller) + zod + `applyDrfErrors` para errores DRF por campo.
 *
 * Reglas (validadas también en backend): `resume_text` obligatorio; `report_date` no futura
 * (default hoy). Editar texto **NO** recalcula stats (eso es exclusivo de "Sincronizar").
 */
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
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
import {
  sessionReportSchema,
  emptyReportForm,
  STATUS_OPTIONS,
  SESSION_REPORT_FORM_FIELDS,
  type SessionReportFormValues,
} from '../schemas/sessionReport'
import {
  useCreateSessionReport,
  useUpdateSessionReport,
} from '../hooks/useSessionReport'
import type { SessionReport, SessionType } from '../types'

interface ReportFormProps {
  mode: 'create' | 'edit'
  sessionType: SessionType
  objectId: string
  report?: SessionReport
  canWrite: boolean
  onCancel?: () => void
  onCreated?: (report: SessionReport) => void
}

function defaultsFromReport(report: SessionReport): SessionReportFormValues {
  return {
    resume_text: report.resume_text ?? '',
    report_date: report.report_date ?? emptyReportForm().report_date,
    day_temperature: report.day_temperature ?? '',
    lead: report.lead ?? '',
    ranch_manager: report.ranch_manager ?? '',
    figure_description: report.figure_description ?? '',
    status: report.status ?? 'en_proceso',
  }
}

export function ReportForm({
  mode,
  sessionType,
  objectId,
  report,
  canWrite,
  onCancel,
  onCreated,
}: ReportFormProps) {
  const createMut = useCreateSessionReport(sessionType, objectId)
  const updateMut = useUpdateSessionReport(report?.id ?? '', sessionType, objectId)

  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SessionReportFormValues>({
    resolver: zodResolver(sessionReportSchema),
    defaultValues: report ? defaultsFromReport(report) : emptyReportForm(),
  })

  function handleDrf(e: unknown) {
    if (typeof e === 'object' && e !== null) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      applyDrfErrors(e as any, setError, SESSION_REPORT_FORM_FIELDS)
    }
  }

  function onSubmit(values: SessionReportFormValues) {
    const temp = values.day_temperature?.trim()
    const common = {
      resume_text: values.resume_text.trim(),
      report_date: values.report_date,
      day_temperature: temp ? temp : null,
      lead: values.lead?.trim() ?? '',
      ranch_manager: values.ranch_manager?.trim() ?? '',
      figure_description: values.figure_description?.trim() ?? '',
      status: values.status,
    }

    if (mode === 'create') {
      createMut.mutate(
        { session_type: sessionType, object_id: objectId, ...common },
        {
          onSuccess: (created) => {
            toast.success('Reporte de actividad generado.')
            onCreated?.(created)
          },
          onError: handleDrf,
        }
      )
    } else {
      updateMut.mutate(common, {
        onSuccess: () => toast.success('Reporte de actividad guardado.'),
        onError: handleDrf,
      })
    }
  }

  const pending = isSubmitting || createMut.isPending || updateMut.isPending

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {errors.root && (
        <p className="rounded bg-destructive/10 p-2 text-sm text-destructive">
          {errors.root.message}
        </p>
      )}

      <div className="space-y-1">
        <Label htmlFor="rf-resume">Observaciones *</Label>
        <textarea
          id="rf-resume"
          rows={4}
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          placeholder="Resumen, diagnóstico e interpretación de la actividad…"
          {...register('resume_text')}
        />
        {errors.resume_text && (
          <p className="text-xs text-destructive">{errors.resume_text.message}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="rf-date">Fecha de reporte *</Label>
          <Input id="rf-date" type="date" {...register('report_date')} />
          {errors.report_date && (
            <p className="text-xs text-destructive">{errors.report_date.message}</p>
          )}
        </div>
        <div className="space-y-1">
          <Label htmlFor="rf-temp">Temperatura del día (°C)</Label>
          <Input id="rf-temp" type="number" step="0.1" placeholder="—" {...register('day_temperature')} />
          {errors.day_temperature && (
            <p className="text-xs text-destructive">{errors.day_temperature.message}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="rf-lead">Responsable de aplicaciones</Label>
          <Input id="rf-lead" {...register('lead')} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="rf-manager">Encargado del rancho</Label>
          <Input id="rf-manager" {...register('ranch_manager')} />
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="rf-figure">Descripción de la Figura 1</Label>
        <Input
          id="rf-figure"
          placeholder="Pie del mapa en el reporte impreso"
          {...register('figure_description')}
        />
      </div>

      <div className="space-y-1">
        <Label>Estatus</Label>
        <Controller
          name="status"
          control={control}
          render={({ field }) => (
            <Select onValueChange={field.onChange} value={field.value}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </div>

      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={pending}>
            Cancelar
          </Button>
        )}
        <Button type="submit" size="sm" disabled={pending || !canWrite}>
          {pending
            ? 'Guardando…'
            : mode === 'create'
              ? 'Generar reporte de actividad'
              : 'Guardar reporte de actividad'}
        </Button>
      </div>
    </form>
  )
}
