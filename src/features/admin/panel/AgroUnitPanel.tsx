import { useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { useAuthStore } from '@/features/auth/useAuthStore'
import { ROLE_LEVELS } from '@/lib/auth/roles'
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
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Trash2 } from 'lucide-react'
import { applyDrfErrors } from '@/features/task-manager/hooks/useDrfErrorMap'
import { Field } from '../components/Field'
import { CountryCombobox } from '../components/CountryCombobox'
import { useUpdateAgroUnit } from '../hooks/useAgroUnits'
import { useAgroSectors } from '../hooks/useAgroSectors'
import { useCountries, useStates } from '../hooks/useGeography'
import { useContactAssignments, useDeleteContactAssignment } from '../hooks/useContacts'
import { CreateContactDialog } from '../dialogs/CreateContactDialog'
import type { AgroUnit } from '../types'

const UNIT_TYPES = [
  'Productor', 'Acopiadora de grano', 'Asociación agrícola',
  'Empaque', 'Laboratorio', 'Consultoria', 'Otro',
] as const

const STATUS_LABELS: Record<string, string> = {
  active: 'Activo', inactive: 'Inactivo', suspended: 'Suspendido', pending: 'Pendiente',
}

const schema = z.object({
  commercial_name: z.string().min(1, 'Requerido'),
  code: z.string().min(1, 'Requerido'),
  unit_type: z.string().min(1, 'Requerido'),
  agro_sector_id: z.string().optional(),
  company_name: z.string().optional(),
  tax_type: z.string().optional(),
  tax_id: z.string().optional(),
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
  'commercial_name', 'code', 'unit_type', 'agro_sector_id', 'company_name',
  'tax_type', 'tax_id', 'phone', 'email', 'website',
  'address_line_1', 'address_line_2', 'country', 'state', 'status',
] as const

interface Props {
  unit: AgroUnit
  onClose: () => void
}

export function AgroUnitPanel({ unit, onClose }: Props) {
  const [mode, setMode] = useState<'view' | 'edit'>('view')
  const [contactDialogOpen, setContactDialogOpen] = useState(false)
  const user = useAuthStore((s) => s.user)
  const canEdit = (user?.role_level ?? 0) >= ROLE_LEVELS.SUPER_ADMIN
  const canManageContacts = (user?.role_level ?? 0) >= ROLE_LEVELS.SUPERVISOR

  const mutation = useUpdateAgroUnit()
  const { data: sectors = [] } = useAgroSectors()
  const { data: countries = [] } = useCountries()
  const { data: assignments = [], isLoading: loadingAssignments } = useContactAssignments(String(unit.id))
  const deleteAssignment = useDeleteContactAssignment()

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
      commercial_name: unit.commercial_name,
      code: unit.code,
      unit_type: unit.unit_type ?? '',
      agro_sector_id: unit.agro_sector ? String((unit.agro_sector as AgroUnit['agro_sector'] & { id: number }).id) : '',
      company_name: unit.company_name ?? '',
      tax_type: unit.tax_type ?? '',
      tax_id: unit.tax_id ?? '',
      phone: unit.phone ?? '',
      email: unit.email ?? '',
      website: unit.website ?? '',
      address_line_1: unit.address_line_1 ?? '',
      address_line_2: unit.address_line_2 ?? '',
      country: unit.country != null ? String(unit.country) : '',
      state: unit.state != null ? String(unit.state) : '',
      status: unit.status ?? 'pending',
    },
  })

  const selectedCountry = watch('country')
  const selectedCountryIso2 = countries.find((c) => String(c.id) === selectedCountry)?.iso_2 ?? null
  const { data: states = [] } = useStates(selectedCountryIso2)

  function cancelEdit() {
    reset()
    setMode('view')
  }

  async function onSubmit(values: FormValues) {
    try {
      await mutation.mutateAsync({
        id: String(unit.id),
        payload: {
          commercial_name: values.commercial_name,
          code: values.code,
          unit_type: values.unit_type as never,
          ...(values.agro_sector_id ? { agro_sector_id: Number(values.agro_sector_id) } : {}),
          company_name: values.company_name ?? '',
          tax_type: (values.tax_type || null) as never,
          tax_id: values.tax_id ?? '',
          phone: values.phone ?? '',
          email: values.email ?? '',
          website: values.website ?? '',
          address_line_1: values.address_line_1 ?? '',
          address_line_2: values.address_line_2 ?? '',
          country: values.country ? Number(values.country) : null,
          state: values.state ? Number(values.state) : null,
          status: values.status as never,
        },
      })
      toast.success('Agrounidad actualizada.')
      setMode('view')
    } catch (err) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      applyDrfErrors(err as any, setError, [...KNOWN_FIELDS])
      toast.error('No se pudo actualizar. Intenta de nuevo.')
    }
  }

  async function handleDeleteAssignment(id: number) {
    try {
      await deleteAssignment.mutateAsync(id)
      toast.success('Asignación eliminada.')
    } catch {
      toast.error('No se pudo eliminar la asignación.')
    }
  }

  return (
    <>
      <Dialog open onOpenChange={onClose}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{unit.commercial_name}</DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="detail">
            <TabsList className="mb-4">
              <TabsTrigger value="detail">Detalle</TabsTrigger>
              <TabsTrigger value="contacts">Contactos</TabsTrigger>
            </TabsList>

            {/* ── Tab Detalle ── */}
            <TabsContent value="detail">
              {mode === 'view' ? (
                <div className="space-y-3 text-sm">
                  <Row label="Código">{unit.code}</Row>
                  <Row label="Tipo">{unit.unit_type}</Row>
                  <Row label="Sector">{(unit.agro_sector as { sector_name?: string } | null)?.sector_name ?? '—'}</Row>
                  <Row label="Razón social">{unit.company_name ?? '—'}</Row>
                  <Row label="Estatus">
                    <Badge variant="outline">{STATUS_LABELS[unit.status ?? ''] ?? unit.status}</Badge>
                  </Row>
                  <Row label="Teléfono">{unit.phone ?? '—'}</Row>
                  <Row label="Correo">{unit.email ?? '—'}</Row>
                  <Row label="Sitio web">{unit.website ?? '—'}</Row>
                  <Row label="Dirección">{[unit.address_line_1, unit.address_line_2].filter(Boolean).join(', ') || '—'}</Row>
                  {canEdit && (
                    <div className="pt-2">
                      <Button size="sm" onClick={() => setMode('edit')}>Editar</Button>
                    </div>
                  )}
                </div>
              ) : (
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Nombre comercial *" error={errors.commercial_name?.message}>
                      <Input {...register('commercial_name')} />
                    </Field>
                    <Field label="Código *" error={errors.code?.message}>
                      <Input {...register('code')} />
                    </Field>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Tipo de unidad *" error={errors.unit_type?.message}>
                      <Controller name="unit_type" control={control} render={({ field }) => (
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {UNIT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      )} />
                    </Field>
                    <Field label="Sector agrícola" error={errors.agro_sector_id?.message}>
                      <Controller name="agro_sector_id" control={control} render={({ field }) => (
                        <Select value={field.value ?? ''} onValueChange={field.onChange}>
                          <SelectTrigger><SelectValue placeholder="Sin sector" /></SelectTrigger>
                          <SelectContent>
                            {sectors.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.sector_name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      )} />
                    </Field>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Estatus" error={errors.status?.message}>
                      <Controller name="status" control={control} render={({ field }) => (
                        <Select value={field.value ?? 'pending'} onValueChange={field.onChange}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="active">Activo</SelectItem>
                            <SelectItem value="inactive">Inactivo</SelectItem>
                            <SelectItem value="suspended">Suspendido</SelectItem>
                            <SelectItem value="pending">Pendiente</SelectItem>
                          </SelectContent>
                        </Select>
                      )} />
                    </Field>
                    <Field label="Razón social" error={errors.company_name?.message}>
                      <Input {...register('company_name')} />
                    </Field>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <Field label="Teléfono" error={errors.phone?.message}>
                      <Input {...register('phone')} />
                    </Field>
                    <Field label="Correo" error={errors.email?.message}>
                      <Input {...register('email')} type="email" />
                    </Field>
                    <Field label="Sitio web" error={errors.website?.message}>
                      <Input {...register('website')} />
                    </Field>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Dirección línea 1" error={errors.address_line_1?.message}>
                      <Input {...register('address_line_1')} />
                    </Field>
                    <Field label="Dirección línea 2" error={errors.address_line_2?.message}>
                      <Input {...register('address_line_2')} />
                    </Field>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="País" error={errors.country?.message}>
                      <Controller name="country" control={control} render={({ field }) => (
                        <CountryCombobox countries={countries} value={field.value} onChange={(v) => { field.onChange(v); setValue('state', '') }} />
                      )} />
                    </Field>
                    <Field label="Estado / Provincia" error={errors.state?.message}>
                      <Controller name="state" control={control} render={({ field }) => (
                        <Select value={field.value ?? ''} onValueChange={field.onChange} disabled={states.length === 0}>
                          <SelectTrigger><SelectValue placeholder={states.length === 0 ? 'Selecciona un país' : 'Estado'} /></SelectTrigger>
                          <SelectContent>
                            {states.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      )} />
                    </Field>
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={cancelEdit}>Cancelar</Button>
                    <Button type="submit" disabled={isSubmitting || mutation.isPending}>
                      {isSubmitting || mutation.isPending ? 'Guardando…' : 'Guardar cambios'}
                    </Button>
                  </DialogFooter>
                </form>
              )}
            </TabsContent>

            {/* ── Tab Contactos ── */}
            <TabsContent value="contacts">
              <div className="space-y-3">
                {loadingAssignments ? (
                  <p className="text-sm text-muted-foreground">Cargando contactos…</p>
                ) : assignments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sin contactos asignados.</p>
                ) : (
                  <ul className="divide-y">
                    {assignments.map((a) => (
                      <li key={a.id} className="flex items-center justify-between py-2 text-sm">
                        <div>
                          <p className="font-medium">{a.contact_name}</p>
                          <p className="text-muted-foreground">{[a.contact_email, a.contact_phone].filter(Boolean).join(' · ')}</p>
                        </div>
                        {canManageContacts && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            onClick={() => handleDeleteAssignment(a.id)}
                            disabled={deleteAssignment.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                {canManageContacts && (
                  <Button size="sm" onClick={() => setContactDialogOpen(true)}>
                    Agregar contacto
                  </Button>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      <CreateContactDialog
        open={contactDialogOpen}
        onOpenChange={setContactDialogOpen}
        agroUnitId={String(unit.id)}
      />
    </>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <span className="w-32 shrink-0 text-muted-foreground">{label}</span>
      <span className="flex-1">{children}</span>
    </div>
  )
}
