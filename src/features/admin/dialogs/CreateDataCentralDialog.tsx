import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
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
import { Textarea } from '@/components/ui/textarea'
import { applyDrfErrors } from '@/features/task-manager/hooks/useDrfErrorMap'
import { Field } from '../components/Field'
import { useCreateDataCentral } from '../hooks/useDataCentrals'

const schema = z.object({
  name: z.string().min(1, 'Requerido'),
  description: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

const KNOWN_FIELDS = ['name', 'description'] as const

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  dataCentralMainId: string
}

export function CreateDataCentralDialog({ open, onOpenChange, dataCentralMainId }: Props) {
  const mutation = useCreateDataCentral()

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', description: '' },
  })

  useEffect(() => {
    if (!open) reset()
  }, [open, reset])

  async function onSubmit(values: FormValues) {
    try {
      // GAP-FR-RS-001: `id` es readonly en el schema pero drf-spectacular lo marca
      // requerido en el body (COMPONENT_SPLIT_REQUEST=False, decisión backend deliberada
      // por incompatibilidad con GeoFeatureModelSerializer). El backend lo ignora si se envía.
      await mutation.mutateAsync({
        name: values.name,
        description: values.description ?? '',
        data_central_main_id: dataCentralMainId,
      } as never)
      toast.success('CIA creada correctamente.')
      onOpenChange(false)
    } catch (err) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      applyDrfErrors(err as any, setError, [...KNOWN_FIELDS])
      toast.error('No se pudo crear la CIA. Intenta de nuevo.')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nueva CIA Hija</DialogTitle>
          <DialogDescription>
            Registra una CIAgro dentro de la organización seleccionada.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Field label="Código o nombre *" error={errors.name?.message}>
            <Input {...register('name')} placeholder="Código o nombre de la CIAgro" />
          </Field>
          <Field label="Descripción" error={errors.description?.message}>
            <Textarea {...register('description')} rows={3} placeholder="Descripción breve" />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting || mutation.isPending}>
              {isSubmitting || mutation.isPending ? 'Guardando…' : 'Crear CIA'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
