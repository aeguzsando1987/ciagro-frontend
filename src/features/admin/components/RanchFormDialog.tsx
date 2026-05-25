import { useState } from 'react'
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
import { useCountries, useStates } from '../hooks/useGeography'
import { useProducers } from '../hooks/useProducers'
import { useCreateRanch, useUpdateRanch } from '../hooks/useRanches'
import type { RanchFlat } from '../types'

const schema = z.object({
  code: z.string().min(1, 'Requerido'),
  name: z.string().min(1, 'Requerido'),
  producer: z.string().optional(),
  country: z.coerce.number().nullable().optional(),
  state: z.coerce.number().nullable().optional(),
  city: z.string().optional(),
  address_line_1: z.string().optional(),
  address_line_2: z.string().optional(),
  lat: z.string().optional(),
  lon: z.string().optional(),
  area_uom: z.enum(['ha', 'ac', 'm2']).optional(),
  status: z.enum(['active', 'inactive', 'closed']).optional(),
})

type FormValues = z.infer<typeof schema>

const KNOWN_FIELDS = [
  'code', 'name', 'producer', 'country', 'state', 'city',
  'address_line_1', 'address_line_2', 'lat', 'lon', 'area_uom', 'status',
] as const

interface Props {
  open: boolean
  onClose: () => void
  initialData?: RanchFlat
}

export function RanchFormDialog({ open, onClose, initialData }: Props) {
  const isEdit = !!initialData

  // Estado separado para la cascada: necesitamos iso_2 del país para filtrar estados,
  // pero el campo del form guarda el id numérico (FK del backend).
  const [selectedCountryIso2, setSelectedCountryIso2] = useState<string | null>(null)

  const { data: countries = [] } = useCountries()
  const { data: states = [] } = useStates(selectedCountryIso2)
  const { data: producers = [] } = useProducers()
  const createMutation = useCreateRanch()
  const updateMutation = useUpdateRanch()

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
          name: initialData.name ?? '',
          producer: initialData.producer ?? '',
          country: initialData.country ?? undefined,
          state: initialData.state ?? undefined,
          city: initialData.city ?? '',
          address_line_1: initialData.address_line_1 ?? '',
          address_line_2: initialData.address_line_2 ?? '',
          lat: initialData.lat ?? '',
          lon: initialData.lon ?? '',
          area_uom: initialData.area_uom ?? 'ha',
          status: initialData.status ?? 'active',
        }
      : { area_uom: 'ha', status: 'active' },
  })

  function handleClose() {
    reset()
    setSelectedCountryIso2(null)
    onClose()
  }

  async function onSubmit(values: FormValues) {
    try {
      const payload = {
        code: values.code,
        name: values.name,
        producer: values.producer || null,
        country: values.country ?? null,
        state: values.state ?? null,
        city: values.city || null,
        address_line_1: values.address_line_1 || '',
        address_line_2: values.address_line_2 || '',
        lat: values.lat || null,
        lon: values.lon || null,
        area_uom: values.area_uom ?? 'ha',
        status: values.status ?? 'active',
      }

      if (isEdit) {
        await updateMutation.mutateAsync({ id: initialData.id, payload })
        toast.success('Rancho actualizado correctamente.')
      } else {
        await createMutation.mutateAsync(payload)
        toast.success('Rancho creado correctamente.')
      }
      handleClose()
    } catch (err) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      applyDrfErrors(err as any, setError, [...KNOWN_FIELDS])
      toast.error('No se pudo guardar el rancho.')
    }
  }

  const producerItems = producers.map((p) => ({
    id: p.id,
    label: p.commercial_name,
    sublabel: p.code,
  }))

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose() }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar rancho' : 'Nuevo rancho'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Código" error={errors.code?.message}>
              <Input {...register('code')} disabled={isEdit} />
            </Field>
            <Field label="Nombre" error={errors.name?.message}>
              <Input {...register('name')} />
            </Field>
          </div>

          <Field label="Productor" error={errors.producer?.message}>
            <Controller
              name="producer"
              control={control}
              render={({ field }) => (
                <AssignCombobox
                  items={producerItems}
                  placeholder="Seleccionar productor…"
                  value={field.value ?? ''}
                  onChange={field.onChange}
                />
              )}
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="País" error={errors.country?.message}>
              <Controller
                name="country"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value != null ? String(field.value) : ''}
                    onValueChange={(val) => {
                      field.onChange(val ? Number(val) : null)
                      // Actualizar iso_2 para la cascada de estados
                      const country = countries.find((c) => c.id === Number(val))
                      setSelectedCountryIso2(country?.iso_2 ?? null)
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="País…" />
                    </SelectTrigger>
                    <SelectContent>
                      {countries.map((c) => (
                        <SelectItem key={c.id} value={String(c.id)}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>

            <Field label="Estado" error={errors.state?.message}>
              <Controller
                name="state"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value != null ? String(field.value) : ''}
                    onValueChange={(val) => field.onChange(val ? Number(val) : null)}
                    disabled={!selectedCountryIso2}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={selectedCountryIso2 ? 'Estado…' : 'Elige país primero'} />
                    </SelectTrigger>
                    <SelectContent>
                      {states.map((s) => (
                        <SelectItem key={s.id} value={String(s.id)}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
          </div>

          <Field label="Ciudad" error={errors.city?.message}>
            <Input {...register('city')} />
          </Field>

          <Field label="Dirección línea 1" error={errors.address_line_1?.message}>
            <Input {...register('address_line_1')} />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Latitud" error={errors.lat?.message}>
              <Input {...register('lat')} placeholder="18.9500" />
            </Field>
            <Field label="Longitud" error={errors.lon?.message}>
              <Input {...register('lon')} placeholder="-99.2000" />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Unidad de área" error={errors.area_uom?.message}>
              <Controller
                name="area_uom"
                control={control}
                render={({ field }) => (
                  <Select value={field.value ?? 'ha'} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ha">Hectáreas</SelectItem>
                      <SelectItem value="ac">Acres</SelectItem>
                      <SelectItem value="m2">Metros²</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
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
                      <SelectItem value="closed">Cerrado</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
          </div>

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
