import { useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { useAuthStore } from '@/features/auth/useAuthStore'
import { ROLE_LEVELS } from '@/lib/auth/roles'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { applyDrfErrors } from '@/features/task-manager/hooks/useDrfErrorMap'
import { Field } from '../components/Field'
import { CountryCombobox } from '../components/CountryCombobox'
import { useUpdateDataCentralMain, useDataCentrals } from '../hooks/useDataCentrals'
import { useCountries } from '../hooks/useGeography'
import { useUsers } from '../hooks/useUsers'
import { CreateDataCentralDialog } from '../dialogs/CreateDataCentralDialog'
import type { DataCentralMainDetail, DataCentralDetail } from '../types'

const STATUS_LABELS: Record<string, string> = {
  active: 'Activo', inactive: 'Inactivo', trial: 'Trial',
}

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
  dcm: DataCentralMainDetail
  onClose: () => void
  onOpenDC: (dc: DataCentralDetail) => void
}

export function DataCentralMainPanel({ dcm, onClose, onOpenDC }: Props) {
  const [mode, setMode] = useState<'view' | 'edit'>('view')
  const [createDCOpen, setCreateDCOpen] = useState(false)
  const user = useAuthStore((s) => s.user)
  const canEdit = (user?.role_level ?? 0) >= ROLE_LEVELS.SUPER_ADMIN

  const mutation = useUpdateDataCentralMain()
  const { data: countries = [] } = useCountries()
  const { data: allUsers = [] } = useUsers()
  // Panel admin: incluye CIAs de organizaciones inactivas para poder gestionarlas.
  const { data: datacentrals = [], isLoading: loadingDCs } = useDataCentrals(dcm.id, true)

  const owners = allUsers.filter((u) => (u.user_role?.level ?? 0) >= 4)

  const {
    register, handleSubmit, control, reset, setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: dcm.name,
      description: dcm.description ?? '',
      country: dcm.country != null ? String(dcm.country) : '',
      status: (dcm.status as FormValues['status']) ?? 'active',
      owner_id: dcm.owner ?? '',
    },
  })

  function cancelEdit() {
    reset()
    setMode('view')
  }

  async function onSubmit(values: FormValues) {
    try {
      await mutation.mutateAsync({
        id: dcm.id,
        payload: {
          name: values.name,
          description: values.description ?? '',
          country: values.country ? Number(values.country) : null,
          status: values.status,
          owner_id: values.owner_id,
        },
      })
      toast.success('Organización actualizada.')
      setMode('view')
    } catch (err) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      applyDrfErrors(err as any, setError, [...KNOWN_FIELDS])
      toast.error('No se pudo actualizar. Intenta de nuevo.')
    }
  }

  return (
    <>
      <Dialog open onOpenChange={onClose}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{dcm.name}</DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="detail">
            <TabsList className="mb-4">
              <TabsTrigger value="detail">Detalle</TabsTrigger>
              <TabsTrigger value="cias">CIAs Hijas ({dcm.datacentrals_count ?? datacentrals.length})</TabsTrigger>
            </TabsList>

            {/* ── Tab Detalle ── */}
            <TabsContent value="detail">
              {mode === 'view' ? (
                <div className="space-y-3 text-sm">
                  <Row label="Nombre">{dcm.name}</Row>
                  <Row label="Descripción">{dcm.description || '—'}</Row>
                  <Row label="Estatus">
                    <Badge variant="outline">{STATUS_LABELS[dcm.status ?? ''] ?? dcm.status}</Badge>
                  </Row>
                  <Row label="Dueño de organización">
                    <div>
                      <div>{dcm.owner_username ?? dcm.owner ?? '—'}</div>
                      <p className="text-xs text-muted-foreground">
                        Persona responsable de la organización (rol Gerente o Admin).
                      </p>
                    </div>
                  </Row>
                  <Row label="CIAs">{dcm.datacentrals_count ?? '—'}</Row>
                  <Row label="Creada">{dcm.created_at ? new Date(dcm.created_at).toLocaleDateString('es-MX') : '—'}</Row>
                  {canEdit && (
                    <div className="pt-2">
                      <Button size="sm" onClick={() => setMode('edit')}>Editar</Button>
                    </div>
                  )}
                </div>
              ) : (
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                  <Field label="Nombre *" error={errors.name?.message}>
                    <Input {...register('name')} />
                  </Field>
                  <Field label="Descripción" error={errors.description?.message}>
                    <textarea
                      {...register('description')}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      rows={3}
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
                            <SelectItem key={u.id} value={u.id}>{u.username}</SelectItem>
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
                    <Button type="button" variant="outline" onClick={cancelEdit}>Cancelar</Button>
                    <Button type="submit" disabled={isSubmitting || mutation.isPending}>
                      {isSubmitting || mutation.isPending ? 'Guardando…' : 'Guardar cambios'}
                    </Button>
                  </DialogFooter>
                </form>
              )}
            </TabsContent>

            {/* ── Tab CIAs Hijas ── */}
            <TabsContent value="cias">
              <div className="space-y-3">
                {loadingDCs ? (
                  <p className="text-sm text-muted-foreground">Cargando CIAs…</p>
                ) : datacentrals.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sin CIAs registradas.</p>
                ) : (
                  <div className="rounded-md border overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="px-4 py-2 text-left font-medium">Nombre</th>
                          <th className="px-4 py-2 text-left font-medium">Slug</th>
                          <th className="px-4 py-2 text-left font-medium">Tipo</th>
                          <th className="px-4 py-2 text-left font-medium">Usuarios</th>
                          <th className="px-4 py-2 text-left font-medium">AgroUnits</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {datacentrals.map((dc) => (
                          <tr
                            key={dc.id}
                            className="cursor-pointer hover:bg-muted/30 transition-colors"
                            onClick={() => onOpenDC(dc)}
                          >
                            <td className="px-4 py-2 font-medium">{dc.name}</td>
                            <td className="px-4 py-2 text-muted-foreground text-xs">{dc.slug}</td>
                            <td className="px-4 py-2">
                              {dc.is_primary && <Badge variant="secondary">Principal</Badge>}
                            </td>
                            <td className="px-4 py-2">{dc.user_assignments_count ?? '—'}</td>
                            <td className="px-4 py-2">{dc.agro_unit_assignments_count ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {canEdit && (
                  <Button size="sm" onClick={() => setCreateDCOpen(true)}>+ Nueva CIA</Button>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      <CreateDataCentralDialog
        open={createDCOpen}
        onOpenChange={setCreateDCOpen}
        dataCentralMainId={dcm.id}
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
