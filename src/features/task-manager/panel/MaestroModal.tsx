import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { useAuthStore } from '@/features/auth/useAuthStore'
import { ROLE_LEVELS } from '@/lib/auth/roles'
import { masterTreeQueryOptions } from '@/features/task-manager/hooks/useMasterTree'
import { useUpdateMaestro } from '@/features/task-manager/hooks/useUpdateMaestro'
import { useAgroUnits } from '@/features/task-manager/hooks/useAgroUnits'
import { applyDrfErrors } from '@/features/task-manager/hooks/useDrfErrorMap'
import { StatusChanger } from './StatusChanger'
import { CreateHijoDialog } from '@/features/task-manager/dialogs/CreateHijoDialog'
import { useQuery } from '@tanstack/react-query'
import type { MasterProgram, ProgramaTree, ProgramaStatus } from '@/features/task-manager/types'

const STATUS_BADGE_COLORS: Record<string, string> = {
  pending: 'bg-slate-100 text-slate-700',
  in_progress: 'bg-blue-100 text-blue-700',
  loaded: 'bg-purple-100 text-purple-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-gray-100 text-gray-600',
}

const editSchema = z
  .object({
    title: z.string().min(1, 'Requerido'),
    code: z.string().min(1, 'Requerido'),
    est_start_date: z.string().min(1, 'Requerido'),
    est_finish_date: z.string().min(1, 'Requerido'),
    real_start_date: z.string().optional(),
    real_finish_date: z.string().optional(),
    notes: z.string().optional(),
  })
  .refine((v) => v.est_start_date <= v.est_finish_date, {
    message: 'La fecha inicio no puede ser posterior a la de fin',
    path: ['est_finish_date'],
  })
  .refine(
    (v) => !v.real_start_date || !v.real_finish_date || v.real_start_date <= v.real_finish_date,
    {
      message: 'La fecha real de inicio no puede ser posterior a la de fin',
      path: ['real_finish_date'],
    }
  )

type EditValues = z.infer<typeof editSchema>
const EDIT_FIELDS = [
  'title', 'code', 'est_start_date', 'est_finish_date',
  'real_start_date', 'real_finish_date', 'notes',
] as const

interface MaestroModalProps {
  master: MasterProgram
  datacentral: string
  onClose: () => void
  onNavigateHijo: (hijoId: string) => void
}

export function MaestroModal({ master, datacentral, onClose, onNavigateHijo }: MaestroModalProps) {
  const [mode, setMode] = useState<'view' | 'edit'>('view')
  const [createHijoOpen, setCreateHijoOpen] = useState(false)

  const roleLevel = useAuthStore((s) => s.user?.role_level ?? ROLE_LEVELS.GUEST)
  const isManager = roleLevel >= ROLE_LEVELS.MANAGER

  // Árbol lazy: si ya estaba en cache (Maestro expandido en Gantt) → hit inmediato.
  const { data: tree } = useQuery(masterTreeQueryOptions(master.id, true))
  const { data: producers = [] } = useAgroUnits(datacentral)

  const producerName =
    producers.find((p) => p.id === master.agro_unit)?.commercial_name ?? master.agro_unit

  const updateMutation = useUpdateMaestro({ masterId: master.id, datacentral })

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<EditValues>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      title: master.title,
      code: master.code,
      est_start_date: master.est_start_date ?? '',
      est_finish_date: master.est_finish_date ?? '',
      real_start_date: master.real_start_date ?? '',
      real_finish_date: master.real_finish_date ?? '',
      notes: master.notes ?? '',
    },
  })

  function handleCancelEdit() {
    reset()
    setMode('view')
  }

  async function onSubmitEdit(values: EditValues) {
    // Las fechas reales son opcionales: un <input type="date"> vacío produce "",
    // que DRF rechaza por formato. Se envía null para que el backend las deje
    // sin valor (campos null=True en MasterProgram).
    const payload = {
      ...values,
      real_start_date: values.real_start_date || null,
      real_finish_date: values.real_finish_date || null,
    }
    try {
      await updateMutation.mutateAsync(payload)
      setMode('view')
    } catch {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (updateMutation.error) applyDrfErrors(updateMutation.error as any, setError, EDIT_FIELDS)
    }
  }

  function handleStatusChange(newStatus: ProgramaStatus) {
    updateMutation.mutate({ status: newStatus })
  }

  return (
    <>
      <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Programa
              <Badge className={STATUS_BADGE_COLORS[master.status ?? 'pending']}>
                {master.status_display}
              </Badge>
            </DialogTitle>
          </DialogHeader>

          {mode === 'view' ? (
            <ViewMode
              master={master}
              producerName={producerName}
              tree={tree}
              isManager={isManager}
              isMutating={updateMutation.isPending}
              onEdit={() => setMode('edit')}
              onStatusChange={handleStatusChange}
              onNavigateHijo={onNavigateHijo}
              onCreateHijo={() => setCreateHijoOpen(true)}
            />
          ) : (
            <form onSubmit={handleSubmit(onSubmitEdit)} className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="em-title">Título *</Label>
                <Input id="em-title" {...register('title')} />
                {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
              </div>
              <div className="space-y-1">
                <Label htmlFor="em-code">Código *</Label>
                <Input id="em-code" {...register('code')} />
                {errors.code && <p className="text-xs text-destructive">{errors.code.message}</p>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="em-start">Fecha inicio *</Label>
                  <Input id="em-start" type="date" {...register('est_start_date')} />
                  {errors.est_start_date && (
                    <p className="text-xs text-destructive">{errors.est_start_date.message}</p>
                  )}
                </div>
                <div className="space-y-1">
                  <Label htmlFor="em-end">Fecha fin *</Label>
                  <Input id="em-end" type="date" {...register('est_finish_date')} />
                  {errors.est_finish_date && (
                    <p className="text-xs text-destructive">{errors.est_finish_date.message}</p>
                  )}
                </div>
              </div>
              {/* Fechas reales de ejecución (caso de uso §2.4.1) — opcionales:
                  se llenan cuando el Programa efectivamente inicia/termina. */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="em-real-start">Inicio real</Label>
                  <Input id="em-real-start" type="date" {...register('real_start_date')} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="em-real-end">Fin real</Label>
                  <Input id="em-real-end" type="date" {...register('real_finish_date')} />
                  {errors.real_finish_date && (
                    <p className="text-xs text-destructive">{errors.real_finish_date.message}</p>
                  )}
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="em-notes">Notas</Label>
                <Input id="em-notes" {...register('notes')} />
              </div>
              {errors.root && (
                <p className="rounded bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  {errors.root.message}
                </p>
              )}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={handleCancelEdit}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Guardando...' : 'Guardar'}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {createHijoOpen && (
        <CreateHijoDialog
          open={createHijoOpen}
          onOpenChange={setCreateHijoOpen}
          master={master}
        />
      )}
    </>
  )
}

function ViewMode({
  master,
  producerName,
  tree,
  isManager,
  isMutating,
  onEdit,
  onStatusChange,
  onNavigateHijo,
  onCreateHijo,
}: {
  master: MasterProgram
  producerName: string
  tree: { programas: ProgramaTree[] } | undefined
  isManager: boolean
  isMutating: boolean
  onEdit: () => void
  onStatusChange: (s: ProgramaStatus) => void
  onNavigateHijo: (id: string) => void
  onCreateHijo: () => void
}) {
  return (
    <div className="space-y-4">
      {/* Datos generales */}
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <div className="col-span-2">
          <dt className="text-xs text-muted-foreground">Título</dt>
          <dd className="font-medium">{master.title}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Código</dt>
          <dd>{master.code}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Productor</dt>
          <dd className="truncate">{producerName}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Inicio estimado</dt>
          <dd>{master.est_start_date ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Fin estimado</dt>
          <dd>{master.est_finish_date ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Inicio real</dt>
          <dd>{master.real_start_date ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Fin real</dt>
          <dd>{master.real_finish_date ?? '—'}</dd>
        </div>
        {master.notes && (
          <div className="col-span-2">
            <dt className="text-xs text-muted-foreground">Notas</dt>
            <dd className="text-muted-foreground">{master.notes}</dd>
          </div>
        )}
      </dl>

      {/* Cambio de status */}
      <StatusChanger
        currentStatus={(master.status ?? 'pending') as ProgramaStatus}
        onChangeStatus={onStatusChange}
        isLoading={isMutating}
      />

      {/* Acciones */}
      {isManager && (
        <Button size="sm" variant="outline" onClick={onEdit}>
          Editar
        </Button>
      )}

      {/* Lista de Hijos */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Subprogramas</h3>
          {isManager && (
            <Button size="sm" variant="outline" onClick={onCreateHijo}>
              + Nuevo Subprograma
            </Button>
          )}
        </div>

        {!tree && (
          <p className="text-xs text-muted-foreground">Cargando subprogramas...</p>
        )}
        {tree && tree.programas.length === 0 && (
          <p className="text-xs text-muted-foreground">Sin subprogramas todavía.</p>
        )}
        {tree && tree.programas.length > 0 && (
          <ul className="divide-y rounded border">
            {tree.programas.map((hijo) => (
              <li key={hijo.id}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-accent"
                  onClick={() => onNavigateHijo(hijo.id)}
                >
                  <span className="truncate text-sm font-medium">
                    {hijo.title ?? '(Sin título)'}
                  </span>
                  <div className="ml-2 flex shrink-0 flex-col items-end gap-0.5">
                    <Badge className={`text-xs ${STATUS_BADGE_COLORS[hijo.status ?? 'pending']}`}>
                      {hijo.status_display}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {hijo.est_start_date?.slice(0, 10) ?? '?'} — {hijo.est_finish_date?.slice(0, 10) ?? '?'}
                    </span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
