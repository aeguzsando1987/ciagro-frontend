import { useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FormSection } from '@/components/ui/form-section'
import { AlertCircle, CheckCircle2 } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { applyDrfErrors } from '@/features/task-manager/hooks/useDrfErrorMap'
import { Field } from './Field'
import { AssignCombobox } from './AssignCombobox'
import { useRanches } from '../hooks/useRanches'
import { useCreatePlot, useUpdatePlot } from '../hooks/usePlots'
import type { PlotFlat } from '../types'

const schema = z.object({
  code: z.string().min(1, 'Requerido'),
  ranch: z.string().min(1, 'Requerido'),
  description: z.string().optional(),
  tech_spraying: z.boolean().optional(),
  comments: z.string().optional(),
  status: z.enum(['active', 'inactive', 'deprecated']).optional(),
})

type FormValues = z.infer<typeof schema>

const KNOWN_FIELDS = [
  'code',
  'ranch',
  'description',
  'tech_spraying',
  'comments',
  'status',
] as const

interface Props {
  open: boolean
  onClose: () => void
  /** Rancho padre fijado (cuando se crea desde el panel de un rancho). */
  fixedRanchId?: string
  /** Limita las opciones a los ranchos de este productor/agrounidad. */
  producerId?: string
  /** Sugiere un rancho al abrir, pero permite cambiarlo. */
  suggestedRanchId?: string
  initialData?: PlotFlat
  /** Se invoca con la parcela recién creada (permite abrir su detalle enseguida). */
  onCreated?: (plot: PlotFlat) => void
  /** Lleva al alta de rancho cuando el productor todavía no tiene ninguno. */
  onCreateRanch?: () => void
}

export function PlotFormDialog({
  open,
  onClose,
  fixedRanchId,
  producerId,
  suggestedRanchId,
  initialData,
  onCreated,
  onCreateRanch,
}: Props) {
  const isEdit = !!initialData
  const {
    data: ranches = [],
    isLoading: isLoadingRanches,
    isError: isRanchesError,
  } = useRanches(producerId)
  const createMutation = useCreatePlot()
  const updateMutation = useUpdatePlot()

  const {
    register,
    handleSubmit,
    control,
    setError,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      code: '',
      ranch: '',
      description: '',
      tech_spraying: false,
      comments: '',
      status: 'active',
    },
  })

  const selectedRanchId = watch('ranch')

  // El diálogo puede permanecer montado y abrirse después con otro contexto.
  // Resincronizar al abrir evita conservar un rancho vacío o anterior.
  useEffect(() => {
    if (!open) return
    reset({
      code: initialData?.code ?? '',
      ranch: initialData?.ranch ?? fixedRanchId ?? suggestedRanchId ?? '',
      description: initialData?.description ?? '',
      tech_spraying: initialData?.tech_spraying ?? false,
      comments: initialData?.comments ?? '',
      status: initialData?.status ?? 'active',
    })
  }, [fixedRanchId, initialData, open, reset, suggestedRanchId])

  // Un único rancho no requiere una decisión adicional del usuario.
  useEffect(() => {
    const onlyRanch = ranches[0]
    if (open && !isEdit && !selectedRanchId && ranches.length === 1 && onlyRanch) {
      setValue('ranch', onlyRanch.id, { shouldValidate: true })
    }
  }, [isEdit, open, ranches, selectedRanchId, setValue])

  function handleClose() {
    reset()
    onClose()
  }

  async function onSubmit(values: FormValues) {
    try {
      const payload = {
        code: values.code,
        ranch: values.ranch,
        description: values.description || undefined,
        tech_spraying: values.tech_spraying ?? false,
        comments: values.comments || undefined,
        status: values.status ?? 'active',
      }

      if (isEdit) {
        await updateMutation.mutateAsync({ id: initialData.id, payload })
        toast.success('Parcela actualizada correctamente.')
      } else {
        const created = await createMutation.mutateAsync(payload)
        toast.success('Parcela creada correctamente.')
        onCreated?.(created)
      }
      handleClose()
    } catch (err) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      applyDrfErrors(err as any, setError, [...KNOWN_FIELDS])
      toast.error('No se pudo guardar la parcela.')
    }
  }

  const ranchItems = ranches.map((r) => ({
    id: r.id,
    label: r.name ?? r.code ?? r.id,
    sublabel: r.code,
  }))
  const hasRanches = ranches.length > 0
  const selectedRanch = ranches.find((r) => r.id === selectedRanchId)

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) handleClose()
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar parcela' : 'Nueva parcela'}</DialogTitle>
          <DialogDescription>
            La parcela quedará vinculada al rancho que selecciones.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <FormSection
            title="Información general"
            description="Identificación, estado y rancho al que pertenecerá la parcela."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Código" error={errors.code?.message}>
                <Input {...register('code')} disabled={isEdit} />
              </Field>

              <Field label="Estatus" error={errors.status?.message}>
                <Controller
                  name="status"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value ?? 'active'} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Activo</SelectItem>
                        <SelectItem value="inactive">Inactivo</SelectItem>
                        <SelectItem value="deprecated">Depreciado</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
            </div>

            <div className="space-y-2">
              <Field label="Rancho" error={errors.ranch?.message}>
                <Controller
                  name="ranch"
                  control={control}
                  render={({ field }) => (
                    <AssignCombobox
                      items={ranchItems}
                      placeholder={
                        isLoadingRanches
                          ? 'Cargando ranchos…'
                          : hasRanches
                            ? 'Seleccionar rancho…'
                            : 'No hay ranchos disponibles'
                      }
                      value={field.value ?? ''}
                      onChange={field.onChange}
                      disabled={isLoadingRanches || !hasRanches || !!fixedRanchId}
                    />
                  )}
                />
              </Field>

              {isRanchesError ? (
                <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  No se pudieron cargar los ranchos de este productor.
                </div>
              ) : !isLoadingRanches && !hasRanches ? (
                <div className="flex items-start justify-between gap-3 rounded-lg border border-warning/25 bg-warning-soft p-3 text-sm text-warning-foreground">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                    <div>
                      <p className="font-medium">Primero crea un rancho</p>
                      <p className="text-xs text-muted-foreground">
                        Toda parcela debe pertenecer a un rancho del productor.
                      </p>
                    </div>
                  </div>
                  {onCreateRanch && (
                    <Button type="button" size="sm" variant="outline" onClick={onCreateRanch}>
                      Crear rancho
                    </Button>
                  )}
                </div>
              ) : ranches.length === 1 && selectedRanch ? (
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                  {selectedRanch.name ?? selectedRanch.code} se seleccionó automáticamente.
                </p>
              ) : producerId ? (
                <p className="text-xs text-muted-foreground">
                  Solo se muestran ranchos pertenecientes a este productor.
                </p>
              ) : null}
            </div>
          </FormSection>

          <FormSection
            title="Configuración agrícola"
            description="Notas operativas y uso previsto de la parcela."
          >
            <Field label="Descripción" error={errors.description?.message}>
              <Input {...register('description')} />
            </Field>

            <Field label="Comentarios" error={errors.comments?.message}>
              <Input {...register('comments')} />
            </Field>

            <Field label="Aspersión técnica" error={errors.tech_spraying?.message}>
              <Controller
                name="tech_spraying"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value ? 'yes' : 'no'}
                    onValueChange={(v) => field.onChange(v === 'yes')}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="yes">Sí</SelectItem>
                      <SelectItem value="no">No</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
          </FormSection>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || isLoadingRanches || !hasRanches || isRanchesError}
            >
              {isSubmitting ? 'Guardando…' : isEdit ? 'Actualizar' : 'Crear'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
