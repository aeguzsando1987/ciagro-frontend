import { useEffect } from 'react'
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
import { Field } from '../components/Field'
import { CountryCombobox } from '../components/CountryCombobox'
import { useCreateAgroUnit } from '../hooks/useAgroUnits'
import { useAgroSectors } from '../hooks/useAgroSectors'
import { useCountries, useStates } from '../hooks/useGeography'

const UNIT_TYPES = [
  'Productor',
  'Acopiadora de grano',
  'Asociación agrícola',
  'Empaque',
  'Laboratorio',
  'Consultoria',
  'Otro',
] as const

const TAX_TYPES = ['RFC', 'Tax ID', 'CUIT', 'RIF', 'TIN', 'SSN', 'NIF', 'CIF', 'RUT', 'Otro'] as const

const schema = z.object({
  commercial_name: z.string().min(1, 'Requerido'),
  code: z.string().min(1, 'Requerido'),
  unit_type: z.string().min(1, 'Requerido'),
  agro_sector_id: z.string().optional(),
  company_name: z.string().optional(),
  tax_type: z.string().optional(),
  tax_id: z.string().optional(),
  headcount: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email('Correo inválido').optional().or(z.literal('')),
  website: z.string().url('URL inválida').optional().or(z.literal('')),
  address_line_1: z.string().optional(),
  address_line_2: z.string().optional(),
  country: z.string().optional(),
  state: z.string().optional(),
  status: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

const KNOWN_FIELDS = [
  'commercial_name', 'code', 'unit_type', 'agro_sector_id',
  'company_name', 'tax_type', 'tax_id', 'headcount',
  'phone', 'email', 'website', 'address_line_1', 'address_line_2',
  'country', 'state', 'status',
] as const

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CreateAgroUnitDialog({ open, onOpenChange }: Props) {
  const mutation = useCreateAgroUnit()
  const { data: sectors = [] } = useAgroSectors()
  const { data: countries = [] } = useCountries()

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      commercial_name: '', code: '', unit_type: '', agro_sector_id: '',
      company_name: '', tax_type: '', tax_id: '', headcount: '',
      phone: '', email: '', website: '',
      address_line_1: '', address_line_2: '',
      country: '', state: '', status: 'pending',
    },
  })

  const selectedCountry = watch('country')
  const selectedCountryIso2 = countries.find((c) => String(c.id) === selectedCountry)?.iso_2 ?? null
  const { data: states = [] } = useStates(selectedCountryIso2)

  // Default Mexico
  useEffect(() => {
    if (!open || countries.length === 0) return
    if (watch('country')) return
    const mx = countries.find((c) => c.iso_2 === 'MX')
    if (mx) setValue('country', String(mx.id))
  }, [open, countries])

  // Reset state when country changes
  useEffect(() => {
    setValue('state', '')
  }, [selectedCountry])

  function handleClose() {
    reset()
    onOpenChange(false)
  }

  async function onSubmit(values: FormValues) {
    try {
      await mutation.mutateAsync({
        commercial_name: values.commercial_name,
        code: values.code,
        unit_type: values.unit_type as never,
        ...(values.agro_sector_id ? { agro_sector_id: Number(values.agro_sector_id) } : {}),
        ...(values.company_name ? { company_name: values.company_name } : {}),
        ...(values.tax_type ? { tax_type: values.tax_type as never } : {}),
        ...(values.tax_id ? { tax_id: values.tax_id } : {}),
        ...(values.headcount ? { headcount: Number(values.headcount) } : {}),
        ...(values.phone ? { phone: values.phone } : {}),
        ...(values.email ? { email: values.email } : {}),
        ...(values.website ? { website: values.website } : {}),
        ...(values.address_line_1 ? { address_line_1: values.address_line_1 } : {}),
        ...(values.address_line_2 ? { address_line_2: values.address_line_2 } : {}),
        ...(values.country ? { country: Number(values.country) } : {}),
        ...(values.state ? { state: Number(values.state) } : {}),
        ...(values.status ? { status: values.status as never } : {}),
      })
      toast.success('Agrounidad creada correctamente.')
      handleClose()
    } catch (err) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      applyDrfErrors(err as any, setError, [...KNOWN_FIELDS])
      toast.error('No se pudo crear la agrounidad. Revisa los campos e intenta de nuevo.')
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nueva agrounidad</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Nombre comercial *" error={errors.commercial_name?.message}>
              <Input {...register('commercial_name')} placeholder="Ej: Rancho Los Pinos" />
            </Field>
            <Field label="Código *" error={errors.code?.message}>
              <Input {...register('code')} placeholder="Ej: RP-001" />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Tipo de unidad *" error={errors.unit_type?.message}>
              <Controller
                name="unit_type"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      {UNIT_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
            <Field label="Sector agrícola" error={errors.agro_sector_id?.message}>
              <Controller
                name="agro_sector_id"
                control={control}
                render={({ field }) => (
                  <Select value={field.value ?? ''} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sin sector" />
                    </SelectTrigger>
                    <SelectContent>
                      {sectors.map((s) => (
                        <SelectItem key={s.id} value={String(s.id)}>{s.sector_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Razón social" error={errors.company_name?.message}>
              <Input {...register('company_name')} placeholder="Opcional" />
            </Field>
            <Field label="Estatus" error={errors.status?.message}>
              <Controller
                name="status"
                control={control}
                render={({ field }) => (
                  <Select value={field.value ?? 'pending'} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Activo</SelectItem>
                      <SelectItem value="inactive">Inactivo</SelectItem>
                      <SelectItem value="suspended">Suspendido</SelectItem>
                      <SelectItem value="pending">Pendiente</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Tipo fiscal" error={errors.tax_type?.message}>
              <Controller
                name="tax_type"
                control={control}
                render={({ field }) => (
                  <Select value={field.value ?? ''} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Opcional" />
                    </SelectTrigger>
                    <SelectContent>
                      {TAX_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
            <Field label="ID / RFC fiscal" error={errors.tax_id?.message}>
              <Input {...register('tax_id')} placeholder="Opcional" />
            </Field>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <Field label="Teléfono" error={errors.phone?.message}>
              <Input {...register('phone')} placeholder="Ej: +52 33..." />
            </Field>
            <Field label="Correo" error={errors.email?.message}>
              <Input {...register('email')} type="email" placeholder="contacto@empresa.com" />
            </Field>
            <Field label="Sitio web" error={errors.website?.message}>
              <Input {...register('website')} placeholder="https://..." />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Dirección línea 1" error={errors.address_line_1?.message}>
              <Input {...register('address_line_1')} placeholder="Calle y número" />
            </Field>
            <Field label="Dirección línea 2" error={errors.address_line_2?.message}>
              <Input {...register('address_line_2')} placeholder="Colonia, municipio" />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="País" error={errors.country?.message}>
              <Controller
                name="country"
                control={control}
                render={({ field }) => (
                  <CountryCombobox
                    countries={countries}
                    value={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
            </Field>
            <Field label="Estado / Provincia" error={errors.state?.message}>
              <Controller
                name="state"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value ?? ''}
                    onValueChange={field.onChange}
                    disabled={states.length === 0}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={states.length === 0 ? 'Selecciona un país' : 'Seleccionar estado'} />
                    </SelectTrigger>
                    <SelectContent>
                      {states.map((s) => (
                        <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                      ))}
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
            <Button type="submit" disabled={isSubmitting || mutation.isPending}>
              {isSubmitting || mutation.isPending ? 'Guardando…' : 'Crear agrounidad'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
