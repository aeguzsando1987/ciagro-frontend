import { useState } from 'react'
import { useForm } from 'react-hook-form'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AssignCombobox } from '../components/AssignCombobox'
import { Trash2 } from 'lucide-react'
import { applyDrfErrors } from '@/features/task-manager/hooks/useDrfErrorMap'
import { Field } from '../components/Field'
import { useUpdateDataCentral } from '../hooks/useDataCentrals'
import { useUserAssignments, useCreateUserAssignment, useDeleteUserAssignment } from '../hooks/useUserAssignments'
import { useDataCentralAssignments, useCreateDataCentralAssignment, useDeleteDataCentralAssignment } from '../hooks/useDataCentralAssignments'
import { useUsers } from '../hooks/useUsers'
import { useAgroUnits } from '../hooks/useAgroUnits'
import type { DataCentralDetail } from '../types'

const schema = z.object({
  name: z.string().min(1, 'Requerido'),
  description: z.string().optional(),
})

type FormValues = z.infer<typeof schema>
const KNOWN_FIELDS = ['name', 'description'] as const

interface Props {
  dc: DataCentralDetail
  onClose: () => void
}

export function DataCentralPanel({ dc, onClose }: Props) {
  const [mode, setMode] = useState<'view' | 'edit'>('view')
  const [selectedUserId, setSelectedUserId] = useState('')
  // Filtrado optimista: IDs asignados localmente antes de que el refetch confirme.
  // Se eliminan del selector de forma inmediata; si el servidor falla, se revierten.
  const [localAssignedUserIds, setLocalAssignedUserIds] = useState<Set<string>>(new Set())
  const [localAssignedUnitIds, setLocalAssignedUnitIds] = useState<Set<string>>(new Set())
  const user = useAuthStore((s) => s.user)
  const isSuperAdmin = (user?.role_level ?? 0) >= ROLE_LEVELS.SUPER_ADMIN
  const isOwnerOfThisDc = user?.datacentrals.some((d) => d.id === dc.id && d.is_owner) ?? false
  const canEdit = isSuperAdmin || isOwnerOfThisDc

  const mutation = useUpdateDataCentral()
  const { data: userAssignments = [], isLoading: loadingUA } = useUserAssignments(dc.id)
  const { data: dcAssignments = [], isLoading: loadingDCA } = useDataCentralAssignments(dc.id)
  const { data: allUsers = [] } = useUsers()
  const { data: allUnits = [] } = useAgroUnits()
  const createUA = useCreateUserAssignment()
  const deleteUA = useDeleteUserAssignment()
  const createDCA = useCreateDataCentralAssignment()
  const deleteDCA = useDeleteDataCentralAssignment()

  const assignedUserIds = new Set(userAssignments.map((a) => a.user_id))
  const assignableUsers = allUsers.filter(
    (u) => !assignedUserIds.has(u.id) && !localAssignedUserIds.has(u.id),
  )

  const assignedUnitIds = new Set(dcAssignments.map((a) => a.agro_unit_id))
  const assignableUnits = allUnits.filter(
    (u) => !assignedUnitIds.has(String(u.id)) && !localAssignedUnitIds.has(String(u.id)),
  )

  const {
    register, handleSubmit, reset, setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: dc.name, description: dc.description ?? '' },
  })

  function cancelEdit() {
    reset()
    setMode('view')
  }

  async function onSubmit(values: FormValues) {
    try {
      await mutation.mutateAsync({
        id: dc.id,
        payload: {
          name: values.name,
          description: values.description ?? '',
          data_central_main_id: (dc.data_central_main as { id: string }).id,
        },
      })
      toast.success('CIA actualizada.')
      setMode('view')
    } catch (err) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      applyDrfErrors(err as any, setError, [...KNOWN_FIELDS])
      toast.error('No se pudo actualizar. Intenta de nuevo.')
    }
  }

  async function handleAssignUser() {
    if (!selectedUserId) return
    const id = selectedUserId
    // Optimista: eliminar del selector de inmediato
    setLocalAssignedUserIds((prev) => new Set([...prev, id]))
    setSelectedUserId('')
    try {
      await createUA.mutateAsync({ user_id: id, datacentral_id: dc.id })
      toast.success('Usuario asignado.')
    } catch {
      // Rollback: devolver al selector si el servidor rechaza
      setLocalAssignedUserIds((prev) => { const n = new Set(prev); n.delete(id); return n })
      setSelectedUserId(id)
      toast.error('No se pudo asignar el usuario.')
    }
  }

  async function handleRemoveUser(id: number) {
    try {
      await deleteUA.mutateAsync(id)
      toast.success('Asignación eliminada.')
    } catch {
      toast.error('No se pudo eliminar la asignación.')
    }
  }

  async function handleAssignUnits(ids: string[]) {
    // Optimista: eliminar todos del selector de inmediato
    setLocalAssignedUnitIds((prev) => new Set([...prev, ...ids]))
    let failed = 0
    const failedIds: string[] = []
    for (const id of ids) {
      try {
        await createDCA.mutateAsync({ agro_unit_id: id, datacentral_id: dc.id })
      } catch {
        failed++
        failedIds.push(id)
      }
    }
    // Rollback de los que fallaron
    if (failedIds.length > 0) {
      setLocalAssignedUnitIds((prev) => {
        const n = new Set(prev)
        failedIds.forEach((fid) => n.delete(fid))
        return n
      })
    }
    if (failed === 0) {
      toast.success(`${ids.length} agrounidad${ids.length > 1 ? 'es asignadas' : ' asignada'}.`)
    } else {
      toast.error(`${failed} asignación(es) no pudieron completarse.`)
    }
  }

  async function handleRemoveUnit(id: number) {
    try {
      await deleteDCA.mutateAsync(id)
      toast.success('Asignación eliminada.')
    } catch {
      toast.error('No se pudo eliminar la asignación.')
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {dc.name}
            {dc.is_primary && <Badge variant="secondary" className="ml-2 text-xs">Principal</Badge>}
          </DialogTitle>
          <button
            type="button"
            onClick={onClose}
            className="mt-0.5 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← {(dc.data_central_main as { name: string }).name}
          </button>
        </DialogHeader>

        <Tabs defaultValue="detail">
          <TabsList className="mb-4">
            <TabsTrigger value="detail">Detalle</TabsTrigger>
            <TabsTrigger value="users">Usuarios ({dc.user_assignments_count ?? userAssignments.length})</TabsTrigger>
            <TabsTrigger value="units">Agrounidades ({dc.agro_unit_assignments_count ?? dcAssignments.length})</TabsTrigger>
          </TabsList>

          {/* ── Tab Detalle ── */}
          <TabsContent value="detail">
            {mode === 'view' ? (
              <div className="space-y-3 text-sm">
                <Row label="Nombre">{dc.name}</Row>
                <Row label="Descripción">{dc.description || '—'}</Row>
                <Row label="Slug"><span className="font-mono text-xs">{dc.slug}</span></Row>
                <Row label="Tipo">
                  {dc.is_primary
                    ? <Badge variant="secondary">Principal</Badge>
                    : <Badge variant="outline">Secundaria</Badge>}
                </Row>
                <Row label="Organización">{(dc.data_central_main as { name: string }).name}</Row>
                <Row label="Creada">{dc.created_at ? new Date(dc.created_at).toLocaleDateString('es-MX') : '—'}</Row>
                {canEdit && !dc.is_primary && (
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
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={cancelEdit}>Cancelar</Button>
                  <Button type="submit" disabled={isSubmitting || mutation.isPending}>
                    {isSubmitting || mutation.isPending ? 'Guardando…' : 'Guardar cambios'}
                  </Button>
                </DialogFooter>
              </form>
            )}
          </TabsContent>

          {/* ── Tab Usuarios ── */}
          <TabsContent value="users">
            <div className="space-y-3">
              {loadingUA ? (
                <p className="text-sm text-muted-foreground">Cargando usuarios…</p>
              ) : userAssignments.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin usuarios asignados.</p>
              ) : (
                <ul className="divide-y">
                  {userAssignments.map((a) => (
                    <li key={a.id} className="flex items-center justify-between py-2 text-sm">
                      <div>
                        <p className="font-medium">{a.user_username}</p>
                        <p className="text-xs text-muted-foreground">
                          {a.created_at ? new Date(a.created_at).toLocaleDateString('es-MX') : ''}
                        </p>
                      </div>
                      {canEdit && (
                        <Button
                          size="icon" variant="ghost"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleRemoveUser(a.id)}
                          disabled={deleteUA.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {canEdit && (
                <div className="space-y-2 pt-1">
                  <AssignCombobox
                    items={assignableUsers.map((u) => ({ id: u.id, label: u.username }))}
                    value={selectedUserId}
                    onChange={setSelectedUserId}
                    placeholder="Busca un usuario…"
                    disabled={createUA.isPending}
                  />
                  <Button
                    size="sm"
                    onClick={handleAssignUser}
                    disabled={!selectedUserId || createUA.isPending}
                  >
                    Asignar
                  </Button>
                </div>
              )}
            </div>
          </TabsContent>

          {/* ── Tab Agrounidades ── */}
          <TabsContent value="units">
            <div className="space-y-3">
              {loadingDCA ? (
                <p className="text-sm text-muted-foreground">Cargando agrounidades…</p>
              ) : dcAssignments.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin agrounidades asignadas.</p>
              ) : (
                <ul className="divide-y">
                  {dcAssignments.map((a) => (
                    <li key={a.id} className="flex items-center justify-between py-2 text-sm">
                      <div>
                        <p className="font-medium">{a.agro_unit_name}</p>
                        <p className="text-xs text-muted-foreground font-mono">{a.agro_unit_code}</p>
                      </div>
                      {canEdit && (
                        <Button
                          size="icon" variant="ghost"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleRemoveUnit(a.id)}
                          disabled={deleteDCA.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {canEdit && (
                <div className="pt-1">
                  <AssignCombobox
                    multiSelect
                    items={assignableUnits.map((u) => ({
                      id: String(u.id),
                      label: u.commercial_name,
                      sublabel: u.code,
                    }))}
                    values={[]}
                    onChangeMulti={handleAssignUnits}
                    placeholder="Busca agrounidades…"
                    assignLabel="Asignar"
                    disabled={createDCA.isPending}
                  />
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
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
