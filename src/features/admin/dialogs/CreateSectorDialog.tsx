import { useForm } from 'react-hook-form'
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
import { applyDrfErrors } from '@/features/task-manager/hooks/useDrfErrorMap'
import { Field } from '../components/Field'
import { useCreateAgroSector } from '../hooks/useAgroSectors'

const schema = z.object({
  sector_name: z.string().min(1, 'Requerido'),
  scian_code: z.string().optional(),
  activity_name: z.string().min(1, 'Requerido'),
  description: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

const KNOWN_FIELDS = ['sector_name', 'scian_code', 'activity_name', 'description'] as const

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CreateSectorDialog({ open, onOpenChange }: Props) {
  const mutation = useCreateAgroSector()

  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { sector_name: '', scian_code: '', activity_name: '', description: '' },
  })

  function handleClose() {
    reset()
    onOpenChange(false)
  }

  async function onSubmit(values: FormValues) {
    try {
      await mutation.mutateAsync({
        sector_name: values.sector_name,
        activity_name: values.activity_name,
        ...(values.scian_code ? { scian_code: values.scian_code } : {}),
        ...(values.description ? { description: values.description } : {}),
      })
      toast.success('Sector agrícola creado correctamente.')
      handleClose()
    } catch (err) {
      applyDrfErrors(err as never, setError, [...KNOWN_FIELDS])
      if (!(err as Record<string, unknown>)?.sector_name) {
        toast.error('No se pudo crear el sector. Intenta de nuevo.')
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nuevo sector agrícola</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Field label="Nombre del sector *" error={errors.sector_name?.message}>
            <Input {...register('sector_name')} placeholder="Ej: Granos básicos" />
          </Field>
          <Field label="Código SCIAN" error={errors.scian_code?.message}>
            <Input {...register('scian_code')} placeholder="Ej: 111140 (opcional)" />
          </Field>
          <Field label="Actividad principal *" error={errors.activity_name?.message}>
            <Input {...register('activity_name')} placeholder="Ej: Cultivo de maíz" />
          </Field>
          <Field label="Descripción" error={errors.description?.message}>
            <textarea
              {...register('description')}
              placeholder="Opcional"
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting || mutation.isPending}>
              {isSubmitting || mutation.isPending ? 'Guardando…' : 'Crear sector'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
