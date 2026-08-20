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
import { CloudSun } from 'lucide-react'
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
  normalizeDecimal,
  toWholeDegrees,
  STATUS_OPTIONS,
  SESSION_REPORT_FORM_FIELDS,
  type SessionReportFormValues,
} from '../schemas/sessionReport'
import {
  useCreateSessionReport,
  useUpdateSessionReport,
} from '../hooks/useSessionReport'
import { useReportWeather } from '../hooks/useReportWeather'
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
    // Las temperaturas se manejan en grados enteros. El backend las guarda como
    // decimal(5,2), así que un reporte viejo puede traer "28.50": se redondea al
    // cargarlo para que el usuario vea lo mismo que se va a guardar.
    day_temperature: toWholeDegrees(report.day_temperature),
    day_temperature_min: toWholeDegrees(report.day_temperature_min),
    day_temperature_max: toWholeDegrees(report.day_temperature_max),
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

  const weatherMut = useReportWeather(report?.id ?? '')

  const {
    register,
    handleSubmit,
    control,
    setError,
    setValue,
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

  function fetchWeather() {
    weatherMut.mutate(undefined, {
      onSuccess: (data) => {
        if (!data.available) {
          // No es un error del sistema: NASA POWER publica con 4-5 días de
          // retraso. Se avisa como información, no como falla.
          toast.info(data.detail ?? 'Todavía no hay clima para esa fecha.')
          return
        }
        // POWER devuelve 2 decimales (21.0 / 12.04 / 30.84); el campo es en
        // grados enteros, así que se redondea antes de pintarlo.
        const set = (field: 'day_temperature' | 'day_temperature_min' | 'day_temperature_max',
                     value: number | null) => {
          if (value !== null) setValue(field, toWholeDegrees(value), { shouldDirty: true })
        }
        set('day_temperature', data.mean)
        set('day_temperature_min', data.min)
        set('day_temperature_max', data.max)
        toast.success(`Clima del ${data.date} (${data.source}). Guarda para conservarlo.`)
      },
      onError: (e) =>
        toast.error(e instanceof Error ? e.message : 'No se pudo consultar el clima.'),
    })
  }

  function onSubmit(values: SessionReportFormValues) {
    // Vacío se manda como null, no como "": el backend espera decimal o null.
    // La coma se normaliza a punto porque el input la muestra (y a veces la
    // acepta) según el locale, pero DRF solo entiende el punto.
    const num = (v?: string) => {
      const t = v?.trim()
      return t ? normalizeDecimal(t) : null
    }
    const common = {
      resume_text: values.resume_text.trim(),
      report_date: values.report_date,
      day_temperature: num(values.day_temperature),
      day_temperature_min: num(values.day_temperature_min),
      day_temperature_max: num(values.day_temperature_max),
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
          <Label htmlFor="rf-temp">Temperatura media (°C)</Label>
          <Input id="rf-temp" type="number" step="any" placeholder="—" {...register('day_temperature')} />
          {errors.day_temperature && (
            <p className="text-xs text-destructive">{errors.day_temperature.message}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="rf-temp-min">Temperatura mínima (°C)</Label>
          <Input
            id="rf-temp-min"
            type="number"
            step="any"
            placeholder="—"
            {...register('day_temperature_min')}
          />
          {errors.day_temperature_min && (
            <p className="text-xs text-destructive">{errors.day_temperature_min.message}</p>
          )}
        </div>
        <div className="space-y-1">
          <Label htmlFor="rf-temp-max">Temperatura máxima (°C)</Label>
          <Input
            id="rf-temp-max"
            type="number"
            step="any"
            placeholder="—"
            {...register('day_temperature_max')}
          />
          {errors.day_temperature_max && (
            <p className="text-xs text-destructive">{errors.day_temperature_max.message}</p>
          )}
        </div>
      </div>

      {/* Traer el clima RELLENA el formulario, no guarda: el analista revisa el
          valor y lo persiste con el submit normal, o lo corrige antes. */}
      {mode === 'edit' && report && (
        <div className="space-y-1">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={fetchWeather}
            disabled={!canWrite || weatherMut.isPending}
            // Cielo y sol: degradado del token `info` (azul) al `warning` (ámbar)
            // para que el botón se lea como "clima" de un vistazo. Se usan los
            // tokens del sistema y no colores crudos de Tailwind: así el botón
            // sigue la paleta si alguien la cambia, y el tema oscuro sale solo
            // sin escribir variantes `dark:` a mano.
            className="border-2 border-info bg-gradient-to-r from-info-soft to-warning-soft text-info-foreground hover:opacity-90"
          >
            <CloudSun className="text-warning" />
            {weatherMut.isPending ? 'Consultando clima…' : 'Traer clima del día de aplicación'}
          </Button>
          <p className="text-xs text-muted-foreground">
            Llena automáticamente las temperaturas del día en que se aplicó, según la
            ubicación de la parcela. Revisa los valores y guarda el reporte para conservarlos.
          </p>
        </div>
      )}

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
