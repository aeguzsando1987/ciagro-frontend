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
import { useCreateContact, useCreateContactAssignment } from '../hooks/useContacts'

const schema = z.object({
  name: z.string().min(1, 'Requerido'),
  address_line_1: z.string().optional(),
  address_line_2: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email('Correo inválido').optional().or(z.literal('')),
})

type FormValues = z.infer<typeof schema>

const KNOWN_FIELDS = ['name', 'address_line_1', 'address_line_2', 'phone', 'email'] as const

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Si se pasa, el contacto se asigna automáticamente a esta agrounidad tras crearse. */
  agroUnitId?: string
}

export function CreateContactDialog({ open, onOpenChange, agroUnitId }: Props) {
  const createContact = useCreateContact()
  const createAssignment = useCreateContactAssignment()

  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', address_line_1: '', address_line_2: '', phone: '', email: '' },
  })

  function handleClose() {
    reset()
    onOpenChange(false)
  }

  async function onSubmit(values: FormValues) {
    try {
      const contact = await createContact.mutateAsync({
        name: values.name,
        ...(values.address_line_1 ? { address_line_1: values.address_line_1 } : {}),
        ...(values.address_line_2 ? { address_line_2: values.address_line_2 } : {}),
        ...(values.phone ? { phone: values.phone } : {}),
        ...(values.email ? { email: values.email } : {}),
      })
      if (agroUnitId && contact?.id) {
        await createAssignment.mutateAsync({
          contact_id: String(contact.id),
          agro_unit_id: agroUnitId,
        })
      }
      toast.success('Contacto creado correctamente.')
      handleClose()
    } catch (err) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      applyDrfErrors(err as any, setError, [...KNOWN_FIELDS])
      toast.error('No se pudo crear el contacto. Intenta de nuevo.')
    }
  }

  const isPending = isSubmitting || createContact.isPending || createAssignment.isPending

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nuevo contacto</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Field label="Nombre *" error={errors.name?.message}>
            <Input {...register('name')} placeholder="Nombre completo o empresa" />
          </Field>
          <Field label="Teléfono" error={errors.phone?.message}>
            <Input {...register('phone')} placeholder="Ej: +52 3312345678 (opcional)" />
          </Field>
          <Field label="Correo electrónico" error={errors.email?.message}>
            <Input {...register('email')} type="email" placeholder="contacto@empresa.com (opcional)" />
          </Field>
          <Field label="Dirección línea 1" error={errors.address_line_1?.message}>
            <Input {...register('address_line_1')} placeholder="Calle y número (opcional)" />
          </Field>
          <Field label="Dirección línea 2" error={errors.address_line_2?.message}>
            <Input {...register('address_line_2')} placeholder="Colonia, municipio (opcional)" />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Guardando…' : 'Crear contacto'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
