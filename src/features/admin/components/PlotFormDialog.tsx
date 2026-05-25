import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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

const KNOWN_FIELDS = ['code', 'ranch', 'description', 'tech_spraying', 'comments', 'status'] as const

interface Props {
  open: boolean
  onClose: () => void
  /** Rancho padre fijado (cuando se crea desde el panel de un rancho). */
  fixedRanchId?: string
  initialData?: PlotFlat
}

export function PlotFormDialog({ open, onClose, fixedRanchId, initialData }: Props) {
  const isEdit = !!initialData
  const { data: ranches = [] } = useRanches()
  const createMutation = useCreatePlot()
  const updateMutation = useUpdatePlot()

  const {
    register,
    handleSubmit,
    control,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: isEdit
      ? {
          code: initialData.code ?? '',
          ranch: initialData.ranch ?? fixedRanchId ?? '',
          description: initialData.description ?? '',
          tech_spraying: initialData.tech_spraying ?? false,
          comments: initialData.comments ?? '',
          status: initialData.status ?? 'active',
        }
      : {
          ranch: fixedRanchId ?? '',
          tech_spraying: false,
          status: 'active',
        },
  })

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
        await createMutation.mutateAsync(payload)
        toast.success('Parcela creada correctamente.')
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

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar parcela' : 'Nueva parcela'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Código" error={errors.code?.message}>
              <Input {...register('code')} disabled={isEdit} />
            </Field>

            <Field label="Estatus" error={errors.status?.message}>
              <Controller
                name="status"
                control={control}
                render={({ field }) => (
                  <Select value={field.value ?? 'active'} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
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

          <Field label="Rancho" error={errors.ranch?.message}>
            <Controller
              name="ranch"
              control={control}
              render={({ field }) => (
                <AssignCombobox
                  items={ranchItems}
                  placeholder="Seleccionar rancho…"
                  value={field.value ?? ''}
                  onChange={field.onChange}
                  disabled={!!fixedRanchId}
                />
              )}
            />
          </Field>

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
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yes">Sí</SelectItem>
                    <SelectItem value="no">No</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </Field>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Guardando…' : isEdit ? 'Actualizar' : 'Crear'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
