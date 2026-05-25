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
import { useHijoDetail } from '@/features/task-manager/hooks/useHijoDetail'
import { useCrops, cropLabel } from '@/features/task-manager/hooks/useCrops'
import { usePlotsByProducer } from '@/features/task-manager/hooks/usePlots'
import { applyDrfErrors } from '@/features/task-manager/hooks/useDrfErrorMap'
import {
  SEASONS,
  CYCLE_YEARS,
  buildCycle,
  parseCycle,
  isSeason2AfterSeason1,
} from '@/features/task-manager/cycle'
import { PlotMiniMap } from './PlotMiniMap'
import { usePlotGeometry } from '@/features/task-manager/hooks/usePlotGeometry'
import { PlotPanel } from '@/features/admin/panel/PlotPanel'
import type { PlotFlat } from '@/features/admin/types'
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

const STATUS_DISPLAY_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  in_progress: 'En progreso',
  loaded: 'Cargado',
  completed: 'Completado',
  cancelled: 'Cancelado',
}

const IMPORT_STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  processing: 'Procesando',
  done: 'Cargado',
  error: 'Error',
  pending_mapping: 'Mapeo pendiente',
}

/** Valor centinela para "sin temporada 2" — Radix Select no admite value="". */
const NO_SEASON2 = '__none__'

const editSchema = z
  .object({
    // Fechas reales — editables sin fricción (caso de uso §4.4.1).
    actual_start_date: z.string().optional(),
    actual_finish_date: z.string().optional(),
    // Datos de planificación — editables con advertencia (caso de uso §4 NOTA).
    title: z.string().optional(),
    voucher_code: z.string().optional(),
    season1: z.string().optional(),
    season2: z.string().optional(),
    year: z.string().optional(),
    crop_id: z.number().optional(),
    est_start_date: z.string().optional(),
    est_finish_date: z.string().optional(),
    plot_id: z.string().uuid().optional(),
  })
  .refine(
    (v) =>
      !v.actual_start_date ||
      !v.actual_finish_date ||
      v.actual_start_date <= v.actual_finish_date,
    {
      message: 'La fecha real de inicio no puede ser posterior a la de fin',
      path: ['actual_finish_date'],
    }
  )
  .refine(
    (v) =>
      !v.est_start_date ||
      !v.est_finish_date ||
      v.est_start_date <= v.est_finish_date,
    {
      message: 'La fecha de inicio no puede ser posterior a la de fin',
      path: ['est_finish_date'],
    }
  )
  .refine((v) => isSeason2AfterSeason1(v.season1, v.season2), {
    message: 'La temporada 2 debe ser posterior a la temporada 1',
    path: ['season2'],
  })

type EditValues = z.infer<typeof editSchema>
const EDIT_FIELDS = [
  'title', 'voucher_code', 'crop_id',
  'est_start_date', 'est_finish_date',
  'actual_start_date', 'actual_finish_date',
  'plot_id',
] as const

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

/**
 * Modal de detalle del Subprograma (caso de uso §4).
 *
 * Vista: datos del Subprograma + lista de sesiones + mini-mapa de la parcela.
 * Edición (gate Gerente+): las fechas reales se editan directamente; los datos
 * de planificación (título, ciclo, fechas estimadas, cultivo) están detrás de
 * una advertencia de inconsistencia. El productor (agro_unit) NUNCA es editable
 * desde aquí — se hereda del Maestro.
 */
export function HijoModal({ hijo, master, datacentralId, onClose, onBack, onNavigateSesion }: HijoModalProps) {
  const [mode, setMode] = useState<'view' | 'edit'>('view')
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [createSesionOpen, setCreateSesionOpen] = useState(false)
  // Estado local del status para feedback inmediato al usuario. El prop `hijo`
  // viene del árbol del Maestro y solo se actualiza al re-abrir el modal; sin
  // este estado la Badge y el StatusChanger quedan stale hasta que el usuario
  // cierra y vuelve a entrar.
  const [localStatus, setLocalStatus] = useState<ProgramaStatus>(
    (hijo.status ?? 'pending') as ProgramaStatus
  )
  const queryClient = useQueryClient()

  const roleLevel = useAuthStore((s) => s.user?.role_level ?? ROLE_LEVELS.GUEST)
  const isManager = roleLevel >= ROLE_LEVELS.MANAGER
  const programIsOpen = localStatus !== 'completed' && localStatus !== 'cancelled'
    && master.status !== 'completed' && master.status !== 'cancelled'
  const canCreateSession = roleLevel >= ROLE_LEVELS.TECHNICIAN && programIsOpen

  // El árbol solo trae campos básicos + sesiones; el detalle agrega las fechas
  // reales y el cultivo, que el formulario de edición necesita.
  const { data: detail } = useHijoDetail(hijo.id)
  const { data: crops = [] } = useCrops()
  const { data: producerPlots = [] } = usePlotsByProducer(master.agro_unit)
  const updateMutation = useUpdateHijo({ hijoId: hijo.id, masterId: master.id })

  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<EditValues>({ resolver: zodResolver(editSchema) })

  function handleEnterEdit() {
    if (!detail) return
    const c = parseCycle(detail.cycle)
    reset({
      actual_start_date: detail.actual_start_date?.slice(0, 10) ?? '',
      actual_finish_date: detail.actual_finish_date?.slice(0, 10) ?? '',
      title: detail.title ?? '',
      voucher_code: detail.voucher_code ?? '',
      season1: c.season1 ?? '',
      season2: c.season2 ?? '',
      year: c.year ? String(c.year) : '',
      crop_id: detail.crop?.id ?? undefined,
      est_start_date: detail.est_start_date?.slice(0, 10) ?? '',
      est_finish_date: detail.est_finish_date?.slice(0, 10) ?? '',
      plot_id: detail.plot ?? undefined,
    })
    setAdvancedOpen(false)
    setMode('edit')
  }

  function handleCancelEdit() {
    reset()
    setAdvancedOpen(false)
    setMode('view')
  }

  async function onSubmitEdit(values: EditValues) {
    // Las fechas reales se envían siempre (null si vacías, para evitar el 400
    // de DRF por formato). Los datos de planificación solo si el usuario abrió
    // la sección avanzada (caso de uso §4 NOTA).
    const patch: Record<string, unknown> = {
      actual_start_date: values.actual_start_date || null,
      actual_finish_date: values.actual_finish_date || null,
    }
    if (advancedOpen) {
      if (values.title) patch.title = values.title
      patch.voucher_code = values.voucher_code || null
      const cycle = buildCycle(values.season1, values.season2, values.year)
      if (cycle) patch.cycle = cycle
      if (values.est_start_date) patch.est_start_date = values.est_start_date
      if (values.est_finish_date) patch.est_finish_date = values.est_finish_date
      if (values.crop_id !== undefined) patch.crop_id = values.crop_id
      if (values.plot_id) patch.plot = values.plot_id
    }
    try {
      await updateMutation.mutateAsync(patch)
      queryClient.invalidateQueries({ queryKey: ['hijo-detail', hijo.id] })
      setMode('view')
    } catch {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (updateMutation.error) applyDrfErrors(updateMutation.error as any, setError, EDIT_FIELDS)
    }
  }

  function handleStatusChange(newStatus: ProgramaStatus) {
    const prevStatus = localStatus
    // Actualizar local de inmediato para feedback visual instantáneo.
    setLocalStatus(newStatus)
    updateMutation.mutate({ status: newStatus }, {
      onError: () => setLocalStatus(prevStatus),  // revertir si el PATCH falla
    })
    // Sincronizar el tree cache para que el Gantt y el Maestro lo reflejen.
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
        <DialogContent className="max-w-4xl">
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
              <Badge className={STATUS_BADGE_COLORS[localStatus]}>
                {STATUS_DISPLAY_LABELS[localStatus] ?? hijo.status_display}
              </Badge>
            </DialogTitle>
          </DialogHeader>

          {mode === 'view' ? (
            <ViewMode
              hijo={hijo}
              localStatus={localStatus}
              cropText={detail?.crop ? cropLabel(detail.crop) : null}
              actualStart={detail?.actual_start_date ?? null}
              actualFinish={detail?.actual_finish_date ?? null}
              allSessions={allSessions}
              isManager={isManager}
              canCreateSession={canCreateSession}
              isMutating={updateMutation.isPending}
              canEdit={!!detail}
              onEdit={handleEnterEdit}
              onStatusChange={handleStatusChange}
              onNavigateSesion={onNavigateSesion}
              onCreateSesion={() => setCreateSesionOpen(true)}
            />
          ) : (
            <form onSubmit={handleSubmit(onSubmitEdit)} className="space-y-4">
              {/* Fechas reales — edición directa (caso de uso §4.4.1) */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="eh-real-start">Inicio real</Label>
                  <Input id="eh-real-start" type="date" {...register('actual_start_date')} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="eh-real-end">Fin real</Label>
                  <Input id="eh-real-end" type="date" {...register('actual_finish_date')} />
                  {errors.actual_finish_date && (
                    <p className="text-xs text-destructive">{errors.actual_finish_date.message}</p>
                  )}
                </div>
              </div>

              {/* Toggle de datos de planificación */}
              <button
                type="button"
                onClick={() => setAdvancedOpen((o) => !o)}
                className="text-sm text-muted-foreground underline hover:text-foreground"
              >
                {advancedOpen ? 'Ocultar' : 'Editar'} datos de planificación
              </button>

              {advancedOpen && (
                <div className="space-y-4 rounded-md border border-yellow-300 bg-yellow-50 p-3 dark:border-yellow-800 dark:bg-yellow-950">
                  <p className="text-xs text-yellow-700 dark:text-yellow-300">
                    ⚠ Cambiar estos campos puede generar inconsistencias con las sesiones
                    y reportes ya registrados de este Subprograma.
                  </p>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="eh-voucher">Voucher / Código</Label>
                      <Input id="eh-voucher" {...register('voucher_code')} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="eh-title">Título</Label>
                      <Input id="eh-title" {...register('title')} />
                    </div>
                  </div>

                  {/* ciclo */}
                  <div className="space-y-1">
                    <Label>Ciclo de cosecha</Label>
                    <div className="grid grid-cols-3 gap-2">
                      <Controller
                        name="season1"
                        control={control}
                        render={({ field }) => (
                          <Select onValueChange={field.onChange} value={field.value ?? ''}>
                            <SelectTrigger><SelectValue placeholder="Temporada 1" /></SelectTrigger>
                            <SelectContent>
                              {SEASONS.map((s) => (
                                <SelectItem key={s} value={s}>{s}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      />
                      <Controller
                        name="season2"
                        control={control}
                        render={({ field }) => (
                          <Select
                            onValueChange={(v) => field.onChange(v === NO_SEASON2 ? '' : v)}
                            value={field.value || NO_SEASON2}
                          >
                            <SelectTrigger><SelectValue placeholder="Temporada 2" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value={NO_SEASON2}>— Sin temporada 2 —</SelectItem>
                              {SEASONS.map((s) => (
                                <SelectItem key={s} value={s}>{s}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      />
                      <Controller
                        name="year"
                        control={control}
                        render={({ field }) => (
                          <Select onValueChange={field.onChange} value={field.value ?? ''}>
                            <SelectTrigger><SelectValue placeholder="Año" /></SelectTrigger>
                            <SelectContent>
                              {CYCLE_YEARS.map((y) => (
                                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </div>
                    {errors.season2 && (
                      <p className="text-xs text-destructive">{errors.season2.message}</p>
                    )}
                  </div>

                  {/* cultivo */}
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
                          <SelectTrigger><SelectValue placeholder="Selecciona cultivo" /></SelectTrigger>
                          <SelectContent>
                            {crops.map((c) => (
                              <SelectItem key={c.id} value={String(c.id)}>{cropLabel(c)}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>

                  {/* parcela */}
                  <div className="space-y-1">
                    <Label>Parcela</Label>
                    {allSessions.length > 0 ? (
                      <div className="rounded border border-muted bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                        <p className="font-medium text-foreground">
                          {producerPlots.find((p) => p.id === hijo.plot)?.properties?.code ?? hijo.plot ?? '—'}
                        </p>
                        <p className="mt-0.5">
                          No se puede cambiar la parcela porque este subprograma ya tiene{' '}
                          {allSessions.length === 1
                            ? '1 sesión registrada'
                            : `${allSessions.length} sesiones registradas`}
                          . Elimina las sesiones primero.
                        </p>
                      </div>
                    ) : (
                      <Controller
                        name="plot_id"
                        control={control}
                        render={({ field }) => (
                          <Select
                            onValueChange={field.onChange}
                            value={field.value ?? ''}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecciona parcela" />
                            </SelectTrigger>
                            <SelectContent>
                              {producerPlots.map((p) => (
                                <SelectItem key={p.id} value={p.id!}>
                                  {p.properties?.code ?? p.id}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      />
                    )}
                    {errors.plot_id && (
                      <p className="text-xs text-destructive">{errors.plot_id.message}</p>
                    )}
                  </div>

                  {/* fechas estimadas */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="eh-est-start">Inicio estimado</Label>
                      <Input id="eh-est-start" type="date" {...register('est_start_date')} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="eh-est-end">Fin estimado</Label>
                      <Input id="eh-est-end" type="date" {...register('est_finish_date')} />
                      {errors.est_finish_date && (
                        <p className="text-xs text-destructive">{errors.est_finish_date.message}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

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
          programa={{ id: hijo.id, master_program: master.id, title: hijo.title, plot: hijo.plot ?? null }}
          master={master}
          datacentralId={datacentralId}
        />
      )}
    </>
  )
}

function ViewMode({
  hijo,
  localStatus,
  cropText,
  actualStart,
  actualFinish,
  allSessions,
  isManager,
  canCreateSession,
  isMutating,
  canEdit,
  onEdit,
  onStatusChange,
  onNavigateSesion,
  onCreateSesion,
}: {
  hijo: ProgramaTree
  localStatus: ProgramaStatus
  cropText: string | null
  actualStart: string | null
  actualFinish: string | null
  allSessions: Array<{ id: string; kind: 'aspersion' | 'phyto'; import_status: string } & Record<string, unknown>>
  isManager: boolean
  canCreateSession: boolean
  isMutating: boolean
  canEdit: boolean
  onEdit: () => void
  onStatusChange: (s: ProgramaStatus) => void
  onNavigateSesion: (ref: { sesionId: string; sesionType: 'aspersion' | 'phyto' }) => void
  onCreateSesion: () => void
}) {
  return (
    <div className="flex gap-4">
      {/* Columna izquierda: datos + status + sesiones */}
      <div className="min-w-0 flex-1 space-y-4">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <div className="col-span-2">
            <dt className="text-xs text-muted-foreground">Título</dt>
            <dd className="font-medium">{hijo.title ?? '(Sin título)'}</dd>
          </div>
          {hijo.voucher_code && (
            <div>
              <dt className="text-xs text-muted-foreground">Voucher / Código</dt>
              <dd>{hijo.voucher_code}</dd>
            </div>
          )}
          {hijo.cycle && (
            <div>
              <dt className="text-xs text-muted-foreground">Ciclo</dt>
              <dd>{hijo.cycle}</dd>
            </div>
          )}
          <div>
            <dt className="text-xs text-muted-foreground">Cultivo</dt>
            <dd>{cropText ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Inicio estimado</dt>
            <dd>{hijo.est_start_date?.slice(0, 10) ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Fin estimado</dt>
            <dd>{hijo.est_finish_date?.slice(0, 10) ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Inicio real</dt>
            <dd>{actualStart?.slice(0, 10) ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Fin real</dt>
            <dd>{actualFinish?.slice(0, 10) ?? '—'}</dd>
          </div>
        </dl>

        <StatusChanger
          currentStatus={localStatus}
          onChangeStatus={onStatusChange}
          isLoading={isMutating}
        />

        {isManager && (
          <Button size="sm" variant="outline" onClick={onEdit} disabled={!canEdit}>
            {canEdit ? 'Editar' : 'Cargando…'}
          </Button>
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
      </div>

      {/* Columna derecha: datos + mapa de la parcela */}
      {hijo.plot && (
        <PlotInfoPanel plotId={hijo.plot} />
      )}
    </div>
  )
}

function PlotInfoPanel({ plotId }: { plotId: string }) {
  const { data: plot } = usePlotGeometry(plotId)
  const [plotDetailOpen, setPlotDetailOpen] = useState(false)
  const p = plot?.properties

  const plotFlat: PlotFlat | null = plot
    ? { ...(plot.properties ?? {}), id: plot.id ?? plotId, geom: plot.geometry ?? null }
    : null

  return (
    <div className="w-72 shrink-0 space-y-2">
      <p className="text-xs font-medium text-muted-foreground">Parcela</p>
      {p && (
        <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
          <div className="col-span-2">
            <dt className="text-muted-foreground">Código</dt>
            <dd className="font-medium">
              {plotFlat ? (
                <button
                  type="button"
                  title="Click para ver detalle de parcela"
                  className="text-primary underline underline-offset-2 hover:opacity-70"
                  onClick={() => setPlotDetailOpen(true)}
                >
                  {p.code ?? '—'}
                </button>
              ) : (
                p.code ?? '—'
              )}
            </dd>
          </div>
          {p.total_area && (
            <div>
              <dt className="text-muted-foreground">Superficie</dt>
              <dd>{Number(p.total_area).toLocaleString('es-MX', { maximumFractionDigits: 2 })} ha</dd>
            </div>
          )}
          {p.tech_spraying !== undefined && (
            <div>
              <dt className="text-muted-foreground">Aspersión tec.</dt>
              <dd>{p.tech_spraying ? 'Sí' : 'No'}</dd>
            </div>
          )}
          {p.comments && (
            <div className="col-span-2">
              <dt className="text-muted-foreground">Comentarios</dt>
              <dd className="text-muted-foreground">{p.comments}</dd>
            </div>
          )}
        </dl>
      )}
      <PlotMiniMap plotId={plotId} />
      {plotFlat && plotDetailOpen && (
        <PlotPanel plot={plotFlat} onClose={() => setPlotDetailOpen(false)} />
      )}
    </div>
  )
}
