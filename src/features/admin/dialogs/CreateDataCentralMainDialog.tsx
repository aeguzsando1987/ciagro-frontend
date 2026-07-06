import { useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { applyDrfErrors } from '@/features/task-manager/hooks/useDrfErrorMap'
import { Field } from '../components/Field'
import { CountryCombobox } from '../components/CountryCombobox'
import { useCreateDataCentralMain } from '../hooks/useDataCentrals'
import { useCountries } from '../hooks/useGeography'
import { useUsers } from '../hooks/useUsers'

const schema = z.object({
  name: z.string().min(1, 'Requerido'),
  description: z.string().optional(),
  country: z.string().optional(),
  status: z.enum(['active', 'inactive', 'trial']).default('active'),
  owner_id: z.string().uuid('Selecciona un owner'),
})

type FormValues = z.infer<typeof schema>

const KNOWN_FIELDS = ['name', 'description', 'country', 'status', 'owner_id'] as const

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
}

export function CreateDataCentralMainDialog({ open, onOpenChange }: Props) {
  const mutation = useCreateDataCentralMain()
  const { data: countries = [] } = useCountries()
  const { data: allUsers = [] } = useUsers()

  const owners = allUsers.filter((u) => (u.user_role?.level ?? 0) >= 4)

  const {
    register, handleSubmit, control, reset, setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', description: '', country: '', status: 'active', owner_id: '' },
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
        country: values.country ? Number(values.country) : null,
        status: values.status,
        owner_id: values.owner_id,
      } as never)
      toast.success('Organización creada correctamente.')
      onOpenChange(false)
    } catch (err) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      applyDrfErrors(err as any, setError, [...KNOWN_FIELDS])
      toast.error('No se pudo crear la organización. Intenta de nuevo.')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nueva organización</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Field label="Nombre *" error={errors.name?.message}>
            <Input {...register('name')} placeholder="Nombre de la organización" />
          </Field>
          <Field label="Descripción" error={errors.description?.message}>
            <textarea
              {...register('description')}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              rows={3}
              placeholder="Descripción breve"
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="País" error={errors.country?.message}>
              <Controller name="country" control={control} render={({ field }) => (
                <CountryCombobox countries={countries} value={field.value} onChange={field.onChange} />
              )} />
            </Field>
            <Field label="Estatus" error={errors.status?.message}>
              <Controller name="status" control={control} render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Activo</SelectItem>
                    <SelectItem value="inactive">Inactivo</SelectItem>
                    <SelectItem value="trial">Trial</SelectItem>
                  </SelectContent>
                </Select>
              )} />
            </Field>
          </div>
          <Field label="Dueño de organización *" error={errors.owner_id?.message}>
            <Controller name="owner_id" control={control} render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger><SelectValue placeholder="Selecciona un usuario" /></SelectTrigger>
                <SelectContent>
                  {owners.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.username} {u.individual?.first_name ? `— ${u.individual.first_name} ${u.individual.last_name ?? ''}`.trim() : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )} />
            <p className="mt-1 text-xs text-muted-foreground">
              El <strong>dueño (owner)</strong> es la persona responsable de la
              organización. Debe ser usuario con rol Gerente o Admin.
            </p>
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={isSubmitting || mutation.isPending}>
              {isSubmitting || mutation.isPending ? 'Guardando…' : 'Crear organización'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
