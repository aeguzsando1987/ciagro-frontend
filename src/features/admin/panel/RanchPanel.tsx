import { useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Trash2, Plus } from 'lucide-react'
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
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { EmptyState } from '@/components/ui/empty-state'
import { FormSection } from '@/components/ui/form-section'
import { SectionHeader } from '@/components/ui/section-header'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Tabs } from '@/components/ui/tabs'
import { useAuthStore } from '@/features/auth/useAuthStore'
import { ROLE_LEVELS } from '@/lib/auth/roles'
import { applyDrfErrors } from '@/features/task-manager/hooks/useDrfErrorMap'
import { Field } from '../components/Field'
import { AssignCombobox } from '../components/AssignCombobox'
import { PlotFormDialog } from '../components/PlotFormDialog'
import { PlotPanel } from './PlotPanel'
import { useUpdateRanch, useDeleteRanch } from '../hooks/useRanches'
import { usePlots } from '../hooks/usePlots'
import {
  useRanchPartners,
  useCreateRanchPartner,
  useDeleteRanchPartner,
} from '../hooks/useRanchPartners'
import { useProducers } from '../hooks/useProducers'
import { useAgroUnits } from '../hooks/useAgroUnits'
import type { RanchFlat, PlotFlat, RelationType } from '../types'

// Espejo de RanchPartnerSerializer.RELATION_TO_UNIT_TYPE (backend): cada tipo de
// relación admite socios de un único unit_type, que se usa para filtrar el selector.
const REL_TO_UNIT_TYPE: Record<RelationType, string> = {
  guild: 'Asociación agrícola',
  grain_collector: 'Acopiadora de grano',
  lab: 'Laboratorio',
}

const schema = z.object({
  name: z.string().min(1, 'Requerido'),
  producer: z.string().optional(),
  city: z.string().optional(),
  address_line_1: z.string().optional(),
  lat: z.string().optional(),
  lon: z.string().optional(),
  area_uom: z.enum(['ha', 'ac', 'm2']).optional(),
  status: z.enum(['active', 'inactive', 'closed']).optional(),
})

type FormValues = z.infer<typeof schema>
const KNOWN_FIELDS = [
  'name',
  'producer',
  'city',
  'address_line_1',
  'lat',
  'lon',
  'area_uom',
  'status',
] as const

function formatPlotArea(value: number | string | null | undefined) {
  if (value == null || value === '') return '—'
  const area = Number(value)
  return Number.isFinite(area)
    ? `${area.toLocaleString('es-MX', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })} ha`
    : '—'
}

interface Props {
  ranch: RanchFlat
  onClose: () => void
}

export function RanchPanel({ ranch, onClose }: Props) {
  const [mode, setMode] = useState<'view' | 'edit'>('view')
  const [createPlotOpen, setCreatePlotOpen] = useState(false)
  const [selectedPlot, setSelectedPlot] = useState<PlotFlat | null>(null)
  const [partnerRelType, setPartnerRelType] = useState<RelationType>('guild')
  const [partnerUnitId, setPartnerUnitId] = useState('')

  const user = useAuthStore((s) => s.user)
  const roleLevel = user?.role_level ?? 0
  const canEdit = roleLevel >= ROLE_LEVELS.MANAGER
  const canDelete = roleLevel >= ROLE_LEVELS.SUPER_ADMIN

  const { data: plots = [] } = usePlots({ ranchId: ranch.id })
  const { data: partners = [] } = useRanchPartners(ranch.id)
  const { data: producers = [] } = useProducers()
  // Agrounidades disponibles para el tipo de relación seleccionado (filtradas en backend).
  const { data: partnerUnits = [] } = useAgroUnits(REL_TO_UNIT_TYPE[partnerRelType])
  const updateMutation = useUpdateRanch()
  const deleteMutation = useDeleteRanch()
  const createPartnerMutation = useCreateRanchPartner()
  const deletePartnerMutation = useDeleteRanchPartner()

  const {
    register,
    handleSubmit,
    control,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: ranch.name ?? '',
      producer: ranch.producer ?? '',
      city: ranch.city ?? '',
      address_line_1: ranch.address_line_1 ?? '',
      lat: ranch.lat ?? '',
      lon: ranch.lon ?? '',
      area_uom: ranch.area_uom ?? 'ha',
      status: ranch.status ?? 'active',
    },
  })

  function handleClose() {
    reset()
    setMode('view')
    onClose()
  }

  async function onSubmit(values: FormValues) {
    try {
      await updateMutation.mutateAsync({
        id: ranch.id,
        payload: {
          name: values.name,
          producer: values.producer || null,
          city: values.city || null,
          address_line_1: values.address_line_1 || '',
          lat: values.lat || null,
          lon: values.lon || null,
          area_uom: values.area_uom ?? 'ha',
          status: values.status ?? 'active',
        },
      })
      toast.success('Rancho actualizado.')
      setMode('view')
    } catch (err) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      applyDrfErrors(err as any, setError, [...KNOWN_FIELDS])
      toast.error('No se pudo actualizar el rancho.')
    }
  }

  async function handleDelete() {
    if (!confirm(`¿Eliminar el rancho "${ranch.code}"? Esta acción no se puede deshacer.`)) return
    try {
      await deleteMutation.mutateAsync(ranch.id)
      toast.success('Rancho eliminado.')
      handleClose()
    } catch {
      toast.error('No se pudo eliminar el rancho.')
    }
  }

  async function handleAddPartner() {
    if (!partnerUnitId) return
    try {
      await createPartnerMutation.mutateAsync({
        ranch: ranch.id,
        partner: partnerUnitId,
        relation_type: partnerRelType,
      })
      toast.success('Socio asociado.')
      setPartnerUnitId('')
    } catch {
      toast.error('No se pudo asociar el socio.')
    }
  }

  async function handleRemovePartner(id: number) {
    try {
      await deletePartnerMutation.mutateAsync({ id, ranchId: ranch.id })
      toast.success('Socio eliminado.')
    } catch {
      toast.error('No se pudo eliminar el socio.')
    }
  }

  const producerItems = producers.map((p) => ({
    id: p.id,
    label: p.commercial_name,
    sublabel: p.code,
  }))
  const producerName =
    producers.find((producer) => producer.id === ranch.producer)?.commercial_name ??
    String(ranch.producer ?? 'Productor')

  const REL_LABELS: Record<RelationType, string> = {
    guild: 'Asociación Agrícola',
    grain_collector: 'Acopiadora',
    lab: 'Laboratorio',
  }

  return (
    <>
      <Dialog open onOpenChange={handleClose}>
        <DialogContent className="max-w-[48rem]">
          <DialogHeader>
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>{producerName}</BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>Ranchos</BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>{ranch.name}</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
            <DialogTitle className="flex items-center gap-2">
              {ranch.code} — {ranch.name}
              <Badge variant="outline" className="text-xs font-normal">
                {ranch.status ?? 'active'}
              </Badge>
            </DialogTitle>
            <DialogDescription>
              Información del rancho, parcelas y aliados relacionados.
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="detail">
            <TabsList>
              <TabsTrigger value="detail">Detalle</TabsTrigger>
              <TabsTrigger value="plots">
                Parcelas {plots.length > 0 && `(${plots.length})`}
              </TabsTrigger>
              <TabsTrigger value="partners">
                Aliados {partners.length > 0 && `(${partners.length})`}
              </TabsTrigger>
            </TabsList>

            {/* ── Tab Detalle ── */}
            <TabsContent value="detail" className="space-y-4 pt-3">
              {mode === 'view' ? (
                <div className="space-y-2 text-sm">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                    <span className="text-muted-foreground">Productor</span>
                    <span>{producerName}</span>
                    <span className="text-muted-foreground">Ciudad</span>
                    <span>{ranch.city || '—'}</span>
                    <span className="text-muted-foreground">Dirección</span>
                    <span>{ranch.address_line_1 || '—'}</span>
                    <span className="text-muted-foreground">Coordenadas</span>
                    <span>{ranch.lat && ranch.lon ? `${ranch.lat}, ${ranch.lon}` : '—'}</span>
                    <span className="text-muted-foreground">Unidad de área</span>
                    <span>{ranch.area_uom ?? 'ha'}</span>
                    <span className="text-muted-foreground">Área total</span>
                    <span>{formatPlotArea(ranch.total_area)}</span>
                  </div>
                  {canEdit && (
                    <div className="flex justify-end pt-2">
                      <Button size="sm" variant="outline" onClick={() => setMode('edit')}>
                        Editar
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                  <FormSection title="Información general">
                    <Field label="Nombre" error={errors.name?.message}>
                      <Input {...register('name')} />
                    </Field>

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
                  </FormSection>

                  <FormSection title="Ubicación y medición">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="Ciudad" error={errors.city?.message}>
                        <Input {...register('city')} />
                      </Field>
                      <Field label="Unidad de área" error={errors.area_uom?.message}>
                        <Controller
                          name="area_uom"
                          control={control}
                          render={({ field }) => (
                            <Select value={field.value ?? 'ha'} onValueChange={field.onChange}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="ha">Hectáreas</SelectItem>
                                <SelectItem value="ac">Acres</SelectItem>
                                <SelectItem value="m2">Metros²</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        />
                      </Field>
                    </div>

                    <Field label="Dirección" error={errors.address_line_1?.message}>
                      <Input {...register('address_line_1')} />
                    </Field>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="Latitud" error={errors.lat?.message}>
                        <Input {...register('lat')} placeholder="18.9500" />
                      </Field>
                      <Field label="Longitud" error={errors.lon?.message}>
                        <Input {...register('lon')} placeholder="-99.2000" />
                      </Field>
                    </div>

                    <Field label="Estatus" error={errors.status?.message}>
                      <Controller
                        name="status"
                        control={control}
                        render={({ field }) => (
                          <Select value={field.value ?? 'active'} onValueChange={field.onChange}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="active">Activo</SelectItem>
                              <SelectItem value="inactive">Inactivo</SelectItem>
                              <SelectItem value="closed">Cerrado</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </Field>
                  </FormSection>

                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setMode('view')}
                    >
                      Cancelar
                    </Button>
                    <Button type="submit" size="sm" disabled={isSubmitting}>
                      {isSubmitting ? 'Guardando…' : 'Guardar'}
                    </Button>
                  </div>
                </form>
              )}
            </TabsContent>

            {/* ── Tab Parcelas ── */}
            <TabsContent value="plots" className="space-y-4 pt-3">
              <SectionHeader
                title="Parcelas del rancho"
                description="Superficies georreferenciadas que pertenecen a este rancho."
                as="h3"
                actions={
                  canEdit ? (
                    <Button size="sm" onClick={() => setCreatePlotOpen(true)}>
                      <Plus className="mr-1 h-4 w-4" />
                      Nueva parcela
                    </Button>
                  ) : undefined
                }
              />
              {plots.length === 0 ? (
                <EmptyState
                  compact
                  title="Sin parcelas registradas"
                  description="Crea la primera parcela para completar la jerarquía del rancho."
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Código</TableHead>
                      <TableHead>Área</TableHead>
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {plots.map((plotItem) => (
                      <TableRow
                        key={plotItem.id}
                        className="cursor-pointer"
                        onClick={() => setSelectedPlot(plotItem)}
                      >
                        <TableCell className="font-medium">{plotItem.code}</TableCell>
                        <TableCell className="text-secondary">
                          {formatPlotArea(plotItem.total_area)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{plotItem.status}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>

            {/* ── Tab Aliados ── */}
            <TabsContent value="partners" className="space-y-3 pt-3">
              {canEdit && (
                <div className="flex items-end gap-2">
                  <div className="flex-1 space-y-1">
                    <label className="text-xs text-muted-foreground">Tipo de relación</label>
                    <Select
                      value={partnerRelType}
                      onValueChange={(v) => {
                        setPartnerRelType(v as RelationType)
                        setPartnerUnitId('') // cambia la lista filtrada → limpiar selección
                      }}
                    >
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="guild">Asociación Agrícola</SelectItem>
                        <SelectItem value="grain_collector">Acopiadora</SelectItem>
                        <SelectItem value="lab">Laboratorio</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex-1 space-y-1">
                    <label className="text-xs text-muted-foreground">Unidad</label>
                    <Select
                      value={partnerUnitId}
                      onValueChange={setPartnerUnitId}
                      disabled={partnerUnits.length === 0}
                    >
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue
                          placeholder={
                            partnerUnits.length === 0
                              ? `Sin unidades de tipo «${REL_TO_UNIT_TYPE[partnerRelType]}»`
                              : 'Selecciona una unidad'
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {partnerUnits.map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.commercial_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    size="sm"
                    onClick={handleAddPartner}
                    disabled={!partnerUnitId || createPartnerMutation.isPending}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              )}
              {partners.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin aliados registrados.</p>
              ) : (
                <div className="space-y-1">
                  {partners.map((pa) => (
                    <div
                      key={pa.id}
                      className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                    >
                      <div>
                        <span className="font-medium">{pa.partner_name ?? pa.partner}</span>
                        <Badge variant="secondary" className="ml-2 text-xs">
                          {REL_LABELS[pa.relation_type]}
                        </Badge>
                      </div>
                      {canDelete && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="text-danger hover:bg-danger-soft hover:text-danger"
                          aria-label={`Eliminar aliado ${pa.partner_name ?? pa.partner}`}
                          onClick={() => handleRemovePartner(pa.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>

          {canDelete && (
            <DialogFooter className="mt-2 border-t pt-3">
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
              >
                <Trash2 className="mr-1 h-4 w-4" />
                {deleteMutation.isPending ? 'Eliminando…' : 'Eliminar rancho'}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {createPlotOpen && (
        <PlotFormDialog
          open={createPlotOpen}
          onClose={() => setCreatePlotOpen(false)}
          fixedRanchId={ranch.id}
        />
      )}
      {selectedPlot && <PlotPanel plot={selectedPlot} onClose={() => setSelectedPlot(null)} />}
    </>
  )
}
