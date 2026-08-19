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
import { FormSection } from '@/components/ui/form-section'
import { applyDrfErrors } from '@/features/task-manager/hooks/useDrfErrorMap'
import { Field } from '../components/Field'
import { useCreateCrop } from '../hooks/useCrops'

const schema = z.object({
  name: z.string().min(1, 'Requerido'),
  code: z.string().optional(),
  variety: z.string().optional(),
  description: z.string().optional(),
  photo: z.instanceof(FileList).optional().nullable(),
})

type FormValues = z.infer<typeof schema>

const KNOWN_FIELDS = ['name', 'code', 'variety', 'description', 'photo'] as const

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CreateCropDialog({ open, onOpenChange }: Props) {
  const mutation = useCreateCrop()

  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', code: '', variety: '', description: '' },
  })

  function handleClose() {
    reset()
    onOpenChange(false)
  }

  async function onSubmit(values: FormValues) {
    try {
      const photo = values.photo?.[0] ?? null
      await mutation.mutateAsync({
        name: values.name,
        code: values.code || null,
        variety: values.variety || null,
        description: values.description || null,
        photo,
      })
      toast.success('El registro del cultivo se almacenó correctamente.')
      handleClose()
    } catch (err) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      applyDrfErrors(err as any, setError, [...KNOWN_FIELDS])
      toast.error('No se pudo crear el cultivo. Revisa los campos e intenta de nuevo.')
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nuevo cultivo</DialogTitle>
          <DialogDescription>
            Registra la identificación del cultivo y una fotografía de referencia opcional.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <FormSection title="Información general">
            <Field label="Nombre *" error={errors.name?.message}>
              <Input {...register('name')} placeholder="Ej: Mango Manila" />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Código" error={errors.code?.message}>
                <Input {...register('code')} placeholder="Ej: MNG-MNL" />
              </Field>
              <Field label="Variedad" error={errors.variety?.message}>
                <Input {...register('variety')} placeholder="Ej: Ataulfo" />
              </Field>
            </div>
          </FormSection>
          <FormSection title="Descripción y fotografía">
            <Field label="Descripción" error={errors.description?.message}>
              <Textarea {...register('description')} rows={3} placeholder="Descripción corta..." />
            </Field>
            <Field label="Imagen (opcional)" error={errors.photo?.message as string | undefined}>
              <Input type="file" accept="image/*" {...register('photo')} />
            </Field>
          </FormSection>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Guardando...' : 'Guardar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
