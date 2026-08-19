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
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { LoadingState } from '@/components/ui/loading-state'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { FormSection } from '@/components/ui/form-section'
import { SectionHeader } from '@/components/ui/section-header'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Tabs } from '@/components/ui/tabs'
import { ArrowRight, Building2, LandPlot, MapPinned, Plus, Trash2, UserRound } from 'lucide-react'
import { applyDrfErrors } from '@/features/task-manager/hooks/useDrfErrorMap'
import { Field } from '../components/Field'
import { CountryCombobox } from '../components/CountryCombobox'
import { useUpdateAgroUnit } from '../hooks/useAgroUnits'
import { useAgroSectors } from '../hooks/useAgroSectors'
import { useCountries, useStates } from '../hooks/useGeography'
import { useContactAssignments, useDeleteContactAssignment } from '../hooks/useContacts'
import { useRanches } from '../hooks/useRanches'
import { usePlots } from '../hooks/usePlots'
import { CreateContactDialog } from '../dialogs/CreateContactDialog'
import { RanchFormDialog } from '../components/RanchFormDialog'
import { PlotFormDialog } from '../components/PlotFormDialog'
import { PlotPanel } from './PlotPanel'
import type { AgroUnit, PlotFlat } from '../types'

/** Tipos de agrounidad que actúan como productor (pueden tener ranchos/parcelas). */
const RANCH_OWNER_TYPES = ['Productor', 'Asociación agrícola']

const UNIT_TYPES = [
  'Productor',
  'Acopiadora de grano',
  'Asociación agrícola',
  'Empaque',
  'Laboratorio',
  'Consultoria',
  'Otro',
] as const

const STATUS_LABELS: Record<string, string> = {
  active: 'Activo',
  inactive: 'Inactivo',
  suspended: 'Suspendido',
  pending: 'Pendiente',
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
  'commercial_name',
  'code',
  'unit_type',
  'agro_sector_id',
  'company_name',
  'tax_type',
  'tax_id',
  'phone',
  'email',
  'website',
  'address_line_1',
  'address_line_2',
  'country',
  'state',
  'status',
] as const

interface Props {
  unit: AgroUnit
  onClose: () => void
}

export function AgroUnitPanel({ unit, onClose }: Props) {
  const [mode, setMode] = useState<'view' | 'edit'>('view')
  const [activeTab, setActiveTab] = useState('detail')
  const [contactDialogOpen, setContactDialogOpen] = useState(false)
  const [ranchFormOpen, setRanchFormOpen] = useState(false)
  const [plotFormRanchId, setPlotFormRanchId] = useState<string | null>(null)
  const [selectedPlot, setSelectedPlot] = useState<PlotFlat | null>(null)
  const user = useAuthStore((s) => s.user)
  const canEdit = (user?.role_level ?? 0) >= ROLE_LEVELS.SUPER_ADMIN
  const canManageContacts = (user?.role_level ?? 0) >= ROLE_LEVELS.SUPERVISOR
  const canManageAssets = (user?.role_level ?? 0) >= ROLE_LEVELS.MANAGER

  // Solo Productor/Asociación agrícola gestionan ranchos y parcelas.
  const canManageRanches = RANCH_OWNER_TYPES.includes(unit.unit_type ?? '')

  const mutation = useUpdateAgroUnit()
  const { data: sectors = [] } = useAgroSectors()
  const { data: countries = [] } = useCountries()
  const { data: assignments = [], isLoading: loadingAssignments } = useContactAssignments(
    String(unit.id)
  )
  const deleteAssignment = useDeleteContactAssignment()
  // Ranchos y parcelas de la agrounidad (filtrados por producer en backend).
  // Para tipos no-productor el backend devuelve [] (no son producer de ningún rancho).
  const { data: ranches = [] } = useRanches(unit.id)
  const { data: plots = [] } = usePlots({ producerId: unit.id })

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
      agro_sector_id: unit.agro_sector
        ? String((unit.agro_sector as AgroUnit['agro_sector'] & { id: number }).id)
        : '',
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
        <DialogContent className="max-w-[60rem]">
          <DialogHeader>
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>Agrounidades</BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>Productores y unidades</BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>{unit.commercial_name}</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
            <DialogTitle>{unit.commercial_name}</DialogTitle>
            <DialogDescription>
              {unit.code} · {unit.unit_type}
            </DialogDescription>
          </DialogHeader>

          {canManageRanches && (
            <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-2 rounded-lg border bg-muted/20 p-3">
              <HierarchyStep
                icon={<Building2 className="h-4 w-4" />}
                label="Productor / Unidad"
                value={unit.commercial_name}
                active={activeTab === 'detail'}
                onClick={() => setActiveTab('detail')}
              />
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              <HierarchyStep
                icon={<MapPinned className="h-4 w-4" />}
                label="Ranchos"
                value={`${ranches.length} registrado${ranches.length === 1 ? '' : 's'}`}
                active={activeTab === 'ranches'}
                onClick={() => setActiveTab('ranches')}
              />
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              <HierarchyStep
                icon={<LandPlot className="h-4 w-4" />}
                label="Parcelas"
                value={`${plots.length} registrada${plots.length === 1 ? '' : 's'}`}
                active={activeTab === 'plots'}
                onClick={() => setActiveTab('plots')}
              />
            </div>
          )}

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList
              className={`mb-4 grid w-full ${canManageRanches ? 'grid-cols-4' : 'grid-cols-2'}`}
            >
              <TabsTrigger value="detail">Detalle</TabsTrigger>
              <TabsTrigger value="contacts">Contactos</TabsTrigger>
              {canManageRanches && (
                <TabsTrigger value="ranches">Ranchos ({ranches.length})</TabsTrigger>
              )}
              {canManageRanches && (
                <TabsTrigger value="plots">Parcelas ({plots.length})</TabsTrigger>
              )}
            </TabsList>

            {/* ── Tab Detalle ── */}
            <TabsContent value="detail">
              {mode === 'view' ? (
                <div className="space-y-6 text-sm">
                  <SectionHeader
                    title="Información de la unidad"
                    description="Datos principales del productor o unidad seleccionada."
                    as="h3"
                    actions={
                      canEdit ? (
                        <Button size="sm" onClick={() => setMode('edit')}>
                          Editar
                        </Button>
                      ) : undefined
                    }
                  />
                  <DetailSection title="Información general">
                    <DetailItem label="Código">{unit.code}</DetailItem>
                    <DetailItem label="Tipo">{unit.unit_type}</DetailItem>
                    <DetailItem label="Sector">
                      {(unit.agro_sector as { sector_name?: string } | null)?.sector_name ?? '—'}
                    </DetailItem>
                    <DetailItem label="Razón social">{unit.company_name ?? '—'}</DetailItem>
                    <DetailItem label="Estatus">
                      <Badge variant="outline">
                        {STATUS_LABELS[unit.status ?? ''] ?? unit.status}
                      </Badge>
                    </DetailItem>
                  </DetailSection>
                  <DetailSection title="Contacto">
                    <DetailItem label="Teléfono">{unit.phone ?? '—'}</DetailItem>
                    <DetailItem label="Correo">{unit.email ?? '—'}</DetailItem>
                    <DetailItem label="Sitio web">{unit.website ?? '—'}</DetailItem>
                  </DetailSection>
                  <DetailSection title="Ubicación">
                    <DetailItem label="Dirección">
                      {[unit.address_line_1, unit.address_line_2].filter(Boolean).join(', ') || '—'}
                    </DetailItem>
                  </DetailSection>
                </div>
              ) : (
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                  <FormSection title="Información general">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="Nombre comercial *" error={errors.commercial_name?.message}>
                        <Input {...register('commercial_name')} />
                      </Field>
                      <Field label="Código *" error={errors.code?.message}>
                        <Input {...register('code')} />
                      </Field>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="Tipo de unidad *" error={errors.unit_type?.message}>
                        <Controller
                          name="unit_type"
                          control={control}
                          render={({ field }) => (
                            <Select value={field.value} onValueChange={field.onChange}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {UNIT_TYPES.map((t) => (
                                  <SelectItem key={t} value={t}>
                                    {t}
                                  </SelectItem>
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
                                  <SelectItem key={s.id} value={String(s.id)}>
                                    {s.sector_name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        />
                      </Field>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
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
                      <Field label="Razón social" error={errors.company_name?.message}>
                        <Input {...register('company_name')} />
                      </Field>
                    </div>
                  </FormSection>
                  <FormSection title="Contacto">
                    <div className="grid gap-4 lg:grid-cols-3">
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
                  </FormSection>
                  <FormSection title="Ubicación">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="Dirección línea 1" error={errors.address_line_1?.message}>
                        <Input {...register('address_line_1')} />
                      </Field>
                      <Field label="Dirección línea 2" error={errors.address_line_2?.message}>
                        <Input {...register('address_line_2')} />
                      </Field>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="País" error={errors.country?.message}>
                        <Controller
                          name="country"
                          control={control}
                          render={({ field }) => (
                            <CountryCombobox
                              countries={countries}
                              value={field.value}
                              onChange={(v) => {
                                field.onChange(v)
                                setValue('state', '')
                              }}
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
                                <SelectValue
                                  placeholder={
                                    states.length === 0 ? 'Selecciona un país' : 'Estado'
                                  }
                                />
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
                  </FormSection>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={cancelEdit}>
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={isSubmitting || mutation.isPending}>
                      {isSubmitting || mutation.isPending ? 'Guardando…' : 'Guardar cambios'}
                    </Button>
                  </DialogFooter>
                </form>
              )}
            </TabsContent>

            {/* ── Tab Contactos ── */}
            <TabsContent value="contacts">
              <div className="space-y-4">
                <SectionIntro
                  icon={<UserRound className="h-5 w-5" />}
                  title="Contactos de la unidad"
                  description="Personas y empresas relacionadas con este productor o unidad."
                  action={
                    canManageContacts ? (
                      <Button size="sm" onClick={() => setContactDialogOpen(true)}>
                        <Plus className="mr-1 h-4 w-4" />
                        Agregar contacto
                      </Button>
                    ) : undefined
                  }
                />
                {loadingAssignments ? (
                  <LoadingState compact label="Cargando contactos…" className="justify-start p-0" />
                ) : assignments.length === 0 ? (
                  <EmptyAssetState
                    icon={<UserRound className="h-6 w-6" />}
                    title="Sin contactos asignados"
                    description="Agrega un contacto para centralizar los datos de comunicación de esta unidad."
                  />
                ) : (
                  <ul className="divide-y">
                    {assignments.map((a) => (
                      <li key={a.id} className="flex items-center justify-between py-2 text-sm">
                        <div>
                          <p className="font-medium">{a.contact_name}</p>
                          <p className="text-muted-foreground">
                            {[a.contact_email, a.contact_phone].filter(Boolean).join(' · ')}
                          </p>
                        </div>
                        {canManageContacts && (
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="text-danger hover:bg-danger-soft hover:text-danger"
                            aria-label={`Eliminar contacto ${a.contact_name}`}
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
              </div>
            </TabsContent>

            {/* ── Tab Ranchos ── */}
            {canManageRanches && (
              <TabsContent value="ranches">
                <div className="space-y-4">
                  <SectionIntro
                    icon={<MapPinned className="h-5 w-5" />}
                    title="Ranchos del productor"
                    description="Cada rancho agrupa las parcelas que pertenecen a esta unidad."
                    action={
                      canManageAssets ? (
                        <Button size="sm" onClick={() => setRanchFormOpen(true)}>
                          <Plus className="mr-1 h-4 w-4" />
                          Nuevo rancho
                        </Button>
                      ) : undefined
                    }
                  />
                  {ranches.length === 0 ? (
                    <EmptyAssetState
                      icon={<MapPinned className="h-6 w-6" />}
                      title="Aún no hay ranchos"
                      description="Crea el primer rancho antes de registrar parcelas para este productor."
                    />
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {ranches.map((r) => (
                        <div key={r.id} className="rounded-lg border bg-card p-3 text-sm shadow-sm">
                          <div>
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="font-medium">{r.name}</p>
                                <p className="text-xs text-muted-foreground">{r.code}</p>
                              </div>
                              <Badge variant="secondary" className="text-xs">
                                {plots.filter((p) => p.ranch === r.id).length} parcelas
                              </Badge>
                            </div>
                            <div className="mt-3 flex items-center justify-between border-t pt-2">
                              <span className="text-xs text-muted-foreground">
                                {r.city || 'Ubicación no indicada'}
                              </span>
                              {canManageAssets && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 px-2 text-xs"
                                  onClick={() => {
                                    setPlotFormRanchId(r.id)
                                    setActiveTab('plots')
                                  }}
                                >
                                  Agregar parcela
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </TabsContent>
            )}

            {/* ── Tab Parcelas ── */}
            {canManageRanches && (
              <TabsContent value="plots">
                <SectionIntro
                  icon={<LandPlot className="h-5 w-5" />}
                  title="Parcelas por rancho"
                  description="Selecciona el rancho al crear una parcela. Solo aparecen los ranchos de este productor."
                  action={
                    canManageAssets && ranches.length > 0 ? (
                      <Button size="sm" onClick={() => setPlotFormRanchId('')}>
                        <Plus className="mr-1 h-4 w-4" />
                        Nueva parcela
                      </Button>
                    ) : undefined
                  }
                />
                {ranches.length === 0 ? (
                  <div className="mt-4">
                    <EmptyAssetState
                      icon={<LandPlot className="h-6 w-6" />}
                      title="Primero crea un rancho"
                      description="Toda parcela debe pertenecer a un rancho del productor."
                      action={
                        canManageAssets ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setRanchFormOpen(true)}
                          >
                            Crear rancho
                          </Button>
                        ) : undefined
                      }
                    />
                  </div>
                ) : (
                  <div className="mt-4 space-y-3">
                    {ranches.map((r) => {
                      const ranchPlots = plots.filter((p) => p.ranch === r.id)
                      return (
                        <div key={r.id} className="overflow-hidden rounded-lg border">
                          <div className="flex items-center justify-between bg-muted/30 px-3 py-2">
                            <div className="flex items-center gap-2">
                              <MapPinned className="h-4 w-4 text-muted-foreground" />
                              <div>
                                <p className="text-sm font-medium">{r.name}</p>
                                <p className="text-xs text-muted-foreground">{r.code}</p>
                              </div>
                            </div>
                            {canManageAssets && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setPlotFormRanchId(r.id)}
                              >
                                <Plus className="mr-1 h-3.5 w-3.5" />
                                Agregar aquí
                              </Button>
                            )}
                          </div>
                          {ranchPlots.length === 0 ? (
                            <p className="px-3 py-4 text-center text-xs text-muted-foreground">
                              Sin parcelas en este rancho.
                            </p>
                          ) : (
                            <ul className="divide-y">
                              {ranchPlots.map((p) => (
                                <li key={p.id}>
                                  <button
                                    type="button"
                                    className="flex min-h-10 w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors duration-150 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/20"
                                    onClick={() => setSelectedPlot(p)}
                                  >
                                    <span className="font-medium">{p.code}</span>
                                    <span className="flex items-center gap-2 text-xs text-muted-foreground">
                                      {p.total_area ? `${p.total_area} ha` : 'Sin vértices'}
                                      <Badge variant="outline" className="text-xs">
                                        {p.status}
                                      </Badge>
                                    </span>
                                  </button>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </TabsContent>
            )}
          </Tabs>
        </DialogContent>
      </Dialog>

      <CreateContactDialog
        open={contactDialogOpen}
        onOpenChange={setContactDialogOpen}
        agroUnitId={String(unit.id)}
      />

      {canManageRanches && (
        <RanchFormDialog
          open={ranchFormOpen}
          onClose={() => setRanchFormOpen(false)}
          fixedProducerId={unit.id}
        />
      )}

      {canManageRanches && (
        <PlotFormDialog
          open={plotFormRanchId !== null}
          onClose={() => setPlotFormRanchId(null)}
          producerId={unit.id}
          suggestedRanchId={plotFormRanchId || undefined}
          onCreateRanch={() => {
            setPlotFormRanchId(null)
            setRanchFormOpen(true)
          }}
          // Abrir el detalle de la parcela recién creada para cargar sus vértices.
          onCreated={(plot) => setSelectedPlot(plot)}
        />
      )}

      {selectedPlot && <PlotPanel plot={selectedPlot} onClose={() => setSelectedPlot(null)} />}
    </>
  )
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 border-t border-border-light pt-4 first:border-t-0 first:pt-0">
      <h4 className="text-sm font-semibold text-foreground">{title}</h4>
      <dl className="grid gap-4 sm:grid-cols-2">{children}</dl>
    </section>
  )
}

function DetailItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 space-y-1">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted">{label}</dt>
      <dd className="break-words text-sm text-foreground">{children}</dd>
    </div>
  )
}

function HierarchyStep({
  icon,
  label,
  value,
  active,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  value: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-10 min-w-0 rounded-md border px-3 py-2 text-left transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 ${
        active ? 'border-primary/40 bg-primary/5' : 'border-transparent hover:bg-muted/60'
      }`}
    >
      <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {icon}
        {label}
      </span>
      <span className="mt-1 block truncate text-sm font-medium">{value}</span>
    </button>
  )
}

function SectionIntro({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode
  title: string
  description: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex items-start gap-2">
        <span className="rounded-md bg-primary/10 p-2 text-brand">{icon}</span>
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      {action}
    </div>
  )
}

function EmptyAssetState({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode
  title: string
  description: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center rounded-lg border border-dashed bg-muted/10 px-4 py-8 text-center">
      <span className="mb-2 rounded-full bg-muted p-3 text-muted-foreground">{icon}</span>
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-1 max-w-sm text-xs text-muted-foreground">{description}</p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  )
}
