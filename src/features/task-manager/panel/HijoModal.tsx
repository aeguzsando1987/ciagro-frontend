import { useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQueryClient } from '@tanstack/react-query'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { useAuthStore } from '@/features/auth/useAuthStore'
import { ROLE_LEVELS } from '@/lib/auth/roles'
import { useUpdateHijo } from '@/features/task-manager/hooks/useUpdateHijo'
import { useAgroUnits } from '@/features/task-manager/hooks/useAgroUnits'
import { useRanches } from '@/features/task-manager/hooks/useRanches'
import { usePlots } from '@/features/task-manager/hooks/usePlots'
import { useCrops } from '@/features/task-manager/hooks/useCrops'
import { applyDrfErrors } from '@/features/task-manager/hooks/useDrfErrorMap'
import { PlotMiniMap } from './PlotMiniMap'
import { StatusChanger } from './StatusChanger'
import { CreateSessionDialog } from '@/features/task-manager/dialogs/CreateSessionDialog'
import type { ProgramaTree, MasterProgram, ProgramaStatus } from '@/features/task-manager/types'

const STATUS_BADGE_COLORS: Record<string, string> = {
  pending: 'bg-slate-100 text-slate-700',
  in_progress: 'bg-blue-100 text-blue-700',
  loaded: 'bg-purple-100 text-purple-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-gray-100 text-gray-600',
}

const IMPORT_STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  processing: 'Procesando',
  done: 'Cargado',
  error: 'Error',
  pending_mapping: 'Mapeo pendiente',
}

const editSchema = z
  .object({
    title: z.string().optional(),
    cycle: z.string().optional(),
    plot: z.string().uuid().optional(),
    crop_id: z.number().optional(),
    est_start_date: z.string().min(1, 'Requerido'),
    est_finish_date: z.string().min(1, 'Requerido'),
  })
  .refine((v) => v.est_start_date <= v.est_finish_date, {
    message: 'La fecha inicio no puede ser posterior a la de fin',
    path: ['est_finish_date'],
  })

type EditValues = z.infer<typeof editSchema>
const EDIT_FIELDS = ['title', 'cycle', 'plot', 'crop_id', 'est_start_date', 'est_finish_date'] as const

type SessionRef =
  | { sesionId: string; sesionType: 'aspersion' }
  | { sesionId: string; sesionType: 'phyto' }

interface HijoModalProps {
  hijo: ProgramaTree
  master: MasterProgram
  datacentralId: string
  onClose: () => void
  onBack: () => void
  onNavigateSesion: (ref: SessionRef) => void
}

export function HijoModal({ hijo, master, datacentralId, onClose, onBack, onNavigateSesion }: HijoModalProps) {
  const [mode, setMode] = useState<'view' | 'edit'>('view')
  const [createSesionOpen, setCreateSesionOpen] = useState(false)
  const queryClient = useQueryClient()

  const roleLevel = useAuthStore((s) => s.user?.role_level ?? ROLE_LEVELS.GUEST)
  const isManager = roleLevel >= ROLE_LEVELS.MANAGER
  const canCreateSession = roleLevel >= ROLE_LEVELS.TECHNICIAN

  const updateMutation = useUpdateHijo({ hijoId: hijo.id, masterId: master.id })

  const { data: producers = [] } = useAgroUnits()
  const [selectedProducer, setSelectedProducer] = useState<string | undefined>()
  const [selectedRanch, setSelectedRanch] = useState<string | undefined>()
  const { data: ranches = [] } = useRanches(selectedProducer)
  const { data: plots = [] } = usePlots(selectedRanch)
  const { data: crops = [] } = useCrops()

  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<EditValues>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      title: hijo.title ?? '',
      cycle: hijo.cycle ?? '',
      est_start_date: hijo.est_start_date?.slice(0, 10) ?? '',
      est_finish_date: hijo.est_finish_date?.slice(0, 10) ?? '',
    },
  })

  function handleCancelEdit() {
    reset()
    setSelectedProducer(undefined)
    setSelectedRanch(undefined)
    setMode('view')
  }

  async function onSubmitEdit(values: EditValues) {
    try {
      await updateMutation.mutateAsync(values)
      setMode('view')
    } catch {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (updateMutation.error) applyDrfErrors(updateMutation.error as any, setError, EDIT_FIELDS)
    }
  }

  function handleStatusChange(newStatus: ProgramaStatus) {
    updateMutation.mutate({ status: newStatus })
    // Optimistic: actualizar el tree cache directamente
    const treeKey = ['master-tree', master.id]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    queryClient.setQueryData(treeKey, (old: any) => {
      if (!old) return old
      return {
        ...old,
        programas: old.programas.map((p: ProgramaTree) =>
          p.id === hijo.id ? { ...p, status: newStatus } : p
        ),
      }
    })
  }

  const allSessions = [
    ...hijo.aspersion_sessions.map((s) => ({ ...s, kind: 'aspersion' as const })),
    ...hijo.phyto_monitoring_headers.map((s) => ({ ...s, kind: 'phyto' as const })),
  ].sort((a, b) => {
    const dateA = 'aspersion_date' in a ? a.aspersion_date : a.session_date
    const dateB = 'aspersion_date' in b ? b.aspersion_date : b.session_date
    return dateA.localeCompare(dateB)
  })

  return (
    <>
      <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <button
                type="button"
                onClick={onBack}
                className="mr-1 text-sm text-muted-foreground hover:text-foreground"
              >
                ← Volver
              </button>
              Subprograma
              <Badge className={STATUS_BADGE_COLORS[hijo.status ?? 'pending']}>
                {hijo.status_display}
              </Badge>
            </DialogTitle>
          </DialogHeader>

          {mode === 'view' ? (
            <ViewMode
              hijo={hijo}
              allSessions={allSessions}
              isManager={isManager}
              canCreateSession={canCreateSession}
              isMutating={updateMutation.isPending}
              onEdit={() => setMode('edit')}
              onStatusChange={handleStatusChange}
              onNavigateSesion={onNavigateSesion}
              onCreateSesion={() => setCreateSesionOpen(true)}
            />
          ) : (
            <form onSubmit={handleSubmit(onSubmitEdit)} className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="eh-title">Título</Label>
                <Input id="eh-title" {...register('title')} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="eh-cycle">Ciclo</Label>
                <Input id="eh-cycle" {...register('cycle')} />
              </div>

              {/* Cascada productor → rancho → parcela */}
              <div className="space-y-1">
                <Label>Productor</Label>
                <Select onValueChange={(v) => { setSelectedProducer(v); setSelectedRanch(undefined) }}>
                  <SelectTrigger><SelectValue placeholder="Selecciona productor (opcional)" /></SelectTrigger>
                  <SelectContent>
                    {producers.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.commercial_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {selectedProducer && (
                <div className="space-y-1">
                  <Label>Rancho</Label>
                  <Select onValueChange={(v) => setSelectedRanch(v)}>
                    <SelectTrigger><SelectValue placeholder="Selecciona rancho" /></SelectTrigger>
                    <SelectContent>
                      {ranches.map((r) => (
                        <SelectItem key={r.id} value={r.id ?? ''}>{r.properties?.name ?? r.id}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {selectedRanch && (
                <div className="space-y-1">
                  <Label>Parcela</Label>
                  <Controller
                    name="plot"
                    control={control}
                    render={({ field }) => (
                      <Select onValueChange={field.onChange} value={field.value ?? ''}>
                        <SelectTrigger><SelectValue placeholder="Selecciona parcela" /></SelectTrigger>
                        <SelectContent>
                          {plots.map((p) => (
                            <SelectItem key={p.id} value={p.id ?? ''}>{p.properties?.code ?? p.id}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
              )}

              {/* Cultivo */}
              <div className="space-y-1">
                <Label>Cultivo</Label>
                <Controller
                  name="crop_id"
                  control={control}
                  render={({ field }) => (
                    <Select
                      onValueChange={(v) => field.onChange(Number(v))}
                      value={field.value != null ? String(field.value) : ''}
                    >
                      <SelectTrigger><SelectValue placeholder="Cambiar cultivo (opcional)" /></SelectTrigger>
                      <SelectContent>
                        {crops.map((c) => (
                          <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="eh-start">Fecha inicio *</Label>
                  <Input id="eh-start" type="date" {...register('est_start_date')} />
                  {errors.est_start_date && (
                    <p className="text-xs text-destructive">{errors.est_start_date.message}</p>
                  )}
                </div>
                <div className="space-y-1">
                  <Label htmlFor="eh-end">Fecha fin *</Label>
                  <Input id="eh-end" type="date" {...register('est_finish_date')} />
                  {errors.est_finish_date && (
                    <p className="text-xs text-destructive">{errors.est_finish_date.message}</p>
                  )}
                </div>
              </div>

              {errors.root && (
                <p className="rounded bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  {errors.root.message}
                </p>
              )}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={handleCancelEdit}>Cancelar</Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Guardando...' : 'Guardar'}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {createSesionOpen && (
        <CreateSessionDialog
          open={createSesionOpen}
          onOpenChange={setCreateSesionOpen}
          programa={{ id: hijo.id, master_program: master.id, title: hijo.title }}
          master={master}
          datacentralId={datacentralId}
        />
      )}
    </>
  )
}

function ViewMode({
  hijo,
  allSessions,
  isManager,
  canCreateSession,
  isMutating,
  onEdit,
  onStatusChange,
  onNavigateSesion,
  onCreateSesion,
}: {
  hijo: ProgramaTree
  allSessions: Array<{ id: string; kind: 'aspersion' | 'phyto'; import_status: string } & Record<string, unknown>>
  isManager: boolean
  canCreateSession: boolean
  isMutating: boolean
  onEdit: () => void
  onStatusChange: (s: ProgramaStatus) => void
  onNavigateSesion: (ref: { sesionId: string; sesionType: 'aspersion' | 'phyto' }) => void
  onCreateSesion: () => void
}) {
  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <div className="col-span-2">
          <dt className="text-xs text-muted-foreground">Título</dt>
          <dd className="font-medium">{hijo.title ?? '(Sin título)'}</dd>
        </div>
        {hijo.cycle && (
          <div>
            <dt className="text-xs text-muted-foreground">Ciclo</dt>
            <dd>{hijo.cycle}</dd>
          </div>
        )}
        {hijo.plot && (
          <div>
            <dt className="text-xs text-muted-foreground">Parcela</dt>
            <dd className="truncate text-xs">{hijo.plot}</dd>
          </div>
        )}
        <div>
          <dt className="text-xs text-muted-foreground">Inicio estimado</dt>
          <dd>{hijo.est_start_date?.slice(0, 10) ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Fin estimado</dt>
          <dd>{hijo.est_finish_date?.slice(0, 10) ?? '—'}</dd>
        </div>
      </dl>

      <StatusChanger
        currentStatus={(hijo.status ?? 'pending') as ProgramaStatus}
        onChangeStatus={onStatusChange}
        isLoading={isMutating}
      />

      {isManager && (
        <Button size="sm" variant="outline" onClick={onEdit}>Editar</Button>
      )}

      {/* Lista de sesiones */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Sesiones</h3>
          {canCreateSession && (
            <Button size="sm" variant="outline" onClick={onCreateSesion}>+ Nueva Sesión</Button>
          )}
        </div>

        {allSessions.length === 0 && (
          <p className="text-xs text-muted-foreground">Sin sesiones todavía.</p>
        )}
        {allSessions.length > 0 && (
          <ul className="divide-y rounded border">
            {allSessions.map((s) => {
              const fecha = s.kind === 'aspersion'
                ? (s as unknown as { aspersion_date: string }).aspersion_date
                : (s as unknown as { session_date: string }).session_date
              return (
                <li key={`${s.kind}-${s.id}`}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-accent"
                    onClick={() => onNavigateSesion({ sesionId: s.id, sesionType: s.kind })}
                  >
                    <span className="text-sm">
                      {s.kind === 'aspersion' ? '💧 Aspersión' : '🌿 Fitosanitario'} — {fecha}
                    </span>
                    <Badge className="text-xs">
                      {IMPORT_STATUS_LABELS[s.import_status] ?? s.import_status}
                    </Badge>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <PlotMiniMap plotId={hijo.plot ?? null} />
    </div>
  )
}
