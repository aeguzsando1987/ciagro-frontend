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
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { applyDrfErrors } from '../hooks/useDrfErrorMap'
import { useAspersionSessionDetail } from '../hooks/useAspersionSessionDetail'
import { usePhytoSessionDetail } from '../hooks/usePhytoSessionDetail'
import { useUpdateAspersionSession } from '../hooks/useUpdateAspersionSession'
import { useUpdatePhytoSession } from '../hooks/useUpdatePhytoSession'
import { useEvaluations } from '../hooks/useEvaluations'
import { useDatacentralUsers } from '../hooks/useDatacentralUsers'
import type { MasterProgramTree } from '@/features/task-manager/types'
import { PlotMiniMap } from './PlotMiniMap'
import { AspersionImportDialog } from '../components/AspersionImportDialog'
import { AspersionImportSummary } from '../components/AspersionImportSummary'
import { AspersionMapModal } from '../components/AspersionMapModal'
import { useAuthStore } from '@/features/auth/useAuthStore'
import { ROLE_LEVELS } from '@/lib/auth/roles'

/* ─── Constants ───────────────────────────────────────────────────── */

const IMPORT_STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  processing: 'Procesando',
  done: 'Cargado',
  error: 'Error',
  pending_mapping: 'Mapeo pendiente',
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  in_progress: 'En progreso',
  loaded: 'Cargado',
  completed: 'Completado',
  cancelled: 'Cancelado',
}

const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-slate-100 text-slate-800',
  in_progress: 'bg-blue-100 text-blue-800',
  loaded: 'bg-purple-100 text-purple-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
}

// Valid next statuses per current status — aspersion follows full lifecycle
const ASPERSION_TRANSITIONS: Record<string, string[]> = {
  pending: ['in_progress'],
  in_progress: ['pending', 'loaded'],
  loaded: ['in_progress', 'completed', 'cancelled'],
  completed: [],
  cancelled: [],
}

// Phyto has no "loaded" state — direct operational lifecycle
const PHYTO_TRANSITIONS: Record<string, string[]> = {
  pending: ['in_progress'],
  in_progress: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
}

/* ─── Schemas ─────────────────────────────────────────────────────── */

const aspersionEditSchema = z.object({
  aspersion_date: z.string().min(1, 'Requerido'),
  act_start_date: z.string().optional().or(z.literal('')),
  act_finish_date: z.string().optional().or(z.literal('')),
  est_start_date: z.string().optional().or(z.literal('')),
  est_finish_date: z.string().optional().or(z.literal('')),
  evaluation_id: z.string().uuid().optional().or(z.literal('')),
  assigned_to_id: z.string().uuid().optional().or(z.literal('')),
})

const phytoEditSchema = z
  .object({
    estimated_start_date: z.string().min(1, 'Requerido'),
    estimated_end_date: z.string().optional().or(z.literal('')),
    started_at: z.string().optional().or(z.literal('')),
    finished_at: z.string().optional().or(z.literal('')),
    strict_mode: z.boolean(),
    radius_tolerance: z.coerce.number().int().min(1, 'Mínimo 1 m'),
    assigned_to_id: z.string().uuid().optional().or(z.literal('')),
    additional_notes: z.string().optional().or(z.literal('')),
  })

type AspersionEditValues = z.infer<typeof aspersionEditSchema>
type PhytoEditValues = z.infer<typeof phytoEditSchema>

/* ─── Helpers ─────────────────────────────────────────────────────── */

function toDatetimeLocal(iso: string | null | undefined): string {
  if (!iso) return ''
  // Strip timezone and seconds: "2026-06-15T10:30:00Z" → "2026-06-15T10:30"
  return iso.replace(/:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?$/, '')
}

function fromDatetimeLocal(value: string | undefined): string | undefined {
  if (!value) return undefined
  // Append seconds for backend compatibility
  return value.length === 16 ? `${value}:00` : value
}

/* ─── Component ────────────────────────────────────────────────────── */

interface SesionModalProps {
  sesionId: string
  sesionType: 'aspersion' | 'phyto'
  hijoId: string
  masterId: string
  datacentralId: string
  onClose: () => void
  onBack: () => void
}

export function SesionModal({
  sesionId,
  sesionType,
  hijoId,
  masterId,
  datacentralId,
  onClose,
  onBack,
}: SesionModalProps) {
  const [isEditing, setIsEditing] = useState(false)
  // For Phyto cancelled: capture notes before confirming status change
  const [cancelPromptOpen, setCancelPromptOpen] = useState(false)
  const [cancelNotes, setCancelNotes] = useState('')
  const [statusError, setStatusError] = useState<string | null>(null)

  const queryClient = useQueryClient()
  const tree = queryClient.getQueryData<MasterProgramTree>(['master-tree', masterId])
  const hijo = tree?.programas.find((p) => p.id === hijoId)

  const aspersionQuery = useAspersionSessionDetail(sesionType === 'aspersion' ? sesionId : null)
  const phytoQuery = usePhytoSessionDetail(sesionType === 'phyto' ? sesionId : null)

  const aspersionMutation = useUpdateAspersionSession(sesionId, masterId)
  const phytoMutation = useUpdatePhytoSession(sesionId, masterId)

  const isLoading = sesionType === 'aspersion' ? aspersionQuery.isLoading : phytoQuery.isLoading
  const aspersionDetail = aspersionQuery.data
  const phytoDetail = phytoQuery.data

  const plotId =
    sesionType === 'aspersion'
      ? (aspersionDetail?.plot ?? hijo?.plot ?? null)
      : (phytoDetail?.plot ?? hijo?.plot ?? null)

  const currentStatus =
    sesionType === 'aspersion'
      ? (aspersionDetail?.status ?? 'pending')
      : (phytoDetail?.status ?? 'pending')

  const transitions =
    sesionType === 'aspersion'
      ? ASPERSION_TRANSITIONS[currentStatus] ?? []
      : PHYTO_TRANSITIONS[currentStatus] ?? []

  function handleStatusChange(newStatus: string) {
    setStatusError(null)
    if (sesionType === 'phyto' && newStatus === 'cancelled') {
      // Require notes before submitting cancelled
      setCancelPromptOpen(true)
      return
    }
    if (sesionType === 'aspersion') {
      aspersionMutation.mutate(
        { status: newStatus as never },
        { onError: (e: unknown) => setStatusError(String(e)) }
      )
    } else {
      phytoMutation.mutate(
        { status: newStatus as never },
        { onError: (e: unknown) => setStatusError(String(e)) }
      )
    }
  }

  function handleCancelConfirm() {
    phytoMutation.mutate(
      { status: 'cancelled' as never, additional_notes: cancelNotes },
      {
        onSuccess: () => {
          setCancelPromptOpen(false)
          setCancelNotes('')
        },
        onError: (e: unknown) => setStatusError(String(e)),
      }
    )
  }

  const isMutatingStatus =
    (aspersionMutation.isPending || phytoMutation.isPending) && !isEditing

  const title = sesionType === 'aspersion' ? 'Sesión de Aspersión' : 'Sesión Fitosanitaria'
  const fecha =
    sesionType === 'aspersion'
      ? aspersionDetail?.aspersion_date
      : phytoDetail?.estimated_start_date

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <button
              type="button"
              onClick={onBack}
              className="mr-1 text-sm text-muted-foreground hover:text-foreground"
            >
              ← Volver
            </button>
            {title}
            {fecha && (
              <span className="text-sm font-normal text-muted-foreground">— {fecha}</span>
            )}
          </DialogTitle>
        </DialogHeader>

        {isLoading && (
          <p className="py-4 text-center text-sm text-muted-foreground">Cargando sesión...</p>
        )}

        {!isLoading && !isEditing && sesionType === 'aspersion' && aspersionDetail && (
          <AspersionView
            detail={aspersionDetail}
            plotId={plotId}
            transitions={transitions}
            isMutatingStatus={isMutatingStatus}
            cancelPromptOpen={cancelPromptOpen}
            cancelNotes={cancelNotes}
            onCancelNotesChange={setCancelNotes}
            onCancelConfirm={handleCancelConfirm}
            onCancelDismiss={() => { setCancelPromptOpen(false); setCancelNotes('') }}
            statusError={statusError}
            onStatusChange={handleStatusChange}
            onEdit={() => setIsEditing(true)}
          />
        )}

        {!isLoading && !isEditing && sesionType === 'phyto' && phytoDetail && (
          <PhytoView
            detail={phytoDetail}
            plotId={plotId}
            transitions={transitions}
            isMutatingStatus={isMutatingStatus}
            cancelPromptOpen={cancelPromptOpen}
            cancelNotes={cancelNotes}
            onCancelNotesChange={setCancelNotes}
            onCancelConfirm={handleCancelConfirm}
            onCancelDismiss={() => { setCancelPromptOpen(false); setCancelNotes('') }}
            statusError={statusError}
            onStatusChange={handleStatusChange}
            onEdit={() => setIsEditing(true)}
          />
        )}

        {!isLoading && isEditing && sesionType === 'aspersion' && aspersionDetail && (
          <AspersionEditForm
            detail={aspersionDetail}
            sesionId={sesionId}
            masterId={masterId}
            datacentralId={datacentralId}
            onCancel={() => setIsEditing(false)}
            onSaved={() => setIsEditing(false)}
          />
        )}

        {!isLoading && isEditing && sesionType === 'phyto' && phytoDetail && (
          <PhytoEditForm
            detail={phytoDetail}
            sesionId={sesionId}
            masterId={masterId}
            datacentralId={datacentralId}
            onCancel={() => setIsEditing(false)}
            onSaved={() => setIsEditing(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

/* ─── Shared status/cancel fragment ──────────────────────────────── */

interface StatusBarProps {
  currentStatus: string
  transitions: string[]
  isMutating: boolean
  cancelPromptOpen: boolean
  cancelNotes: string
  onCancelNotesChange: (v: string) => void
  onCancelConfirm: () => void
  onCancelDismiss: () => void
  statusError: string | null
  onStatusChange: (s: string) => void
}

function StatusBar({
  currentStatus,
  transitions,
  isMutating,
  cancelPromptOpen,
  cancelNotes,
  onCancelNotesChange,
  onCancelConfirm,
  onCancelDismiss,
  statusError,
  onStatusChange,
}: StatusBarProps) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Badge className={STATUS_BADGE[currentStatus]}>
          {STATUS_LABELS[currentStatus] ?? currentStatus}
        </Badge>
        {transitions.length > 0 && (
          <>
            <span className="text-xs text-muted-foreground">Cambiar a:</span>
            {transitions.map((s) => (
              <Button
                key={s}
                size="sm"
                variant="outline"
                disabled={isMutating}
                onClick={() => onStatusChange(s)}
              >
                {STATUS_LABELS[s]}
              </Button>
            ))}
          </>
        )}
      </div>

      {cancelPromptOpen && (
        <div className="rounded border border-destructive/30 bg-destructive/5 p-3 space-y-2">
          <p className="text-xs font-medium text-destructive">
            Cancelar sesión — indica la razón (requerido)
          </p>
          <textarea
            className="w-full rounded border px-2 py-1 text-xs"
            rows={2}
            placeholder="Razón de cancelación..."
            value={cancelNotes}
            onChange={(e) => onCancelNotesChange(e.target.value)}
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="destructive"
              disabled={!cancelNotes.trim() || isMutating}
              onClick={onCancelConfirm}
            >
              Confirmar cancelación
            </Button>
            <Button size="sm" variant="outline" onClick={onCancelDismiss}>
              Descartar
            </Button>
          </div>
        </div>
      )}

      {statusError && (
        <p className="text-xs text-destructive">{statusError}</p>
      )}
    </div>
  )
}

/* ─── Aspersión view ──────────────────────────────────────────────── */

interface AspersionViewProps {
  detail: import('../hooks/useAspersionSessionDetail').AspersionSessionDetail
  plotId: string | null
  transitions: string[]
  isMutatingStatus: boolean
  cancelPromptOpen: boolean
  cancelNotes: string
  onCancelNotesChange: (v: string) => void
  onCancelConfirm: () => void
  onCancelDismiss: () => void
  statusError: string | null
  onStatusChange: (s: string) => void
  onEdit: () => void
}

function AspersionView({
  detail,
  plotId,
  transitions,
  isMutatingStatus,
  cancelPromptOpen,
  cancelNotes,
  onCancelNotesChange,
  onCancelConfirm,
  onCancelDismiss,
  statusError,
  onStatusChange,
  onEdit,
}: AspersionViewProps) {
  const [importOpen, setImportOpen] = useState(false)
  const [mapOpen, setMapOpen] = useState(false)
  const roleLevel = useAuthStore((s) => s.user?.role_level ?? ROLE_LEVELS.GUEST)
  const canViewMap =
    roleLevel >= ROLE_LEVELS.SUPERVISOR &&
    detail.import_status === 'done' &&
    parseInt(detail.points_count ?? '0', 10) > 0
  return (
    <div className="space-y-4">
      <div className="flex gap-4">
        <div className="min-w-0 flex-1 space-y-4">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">Fecha de aspersión</dt>
              <dd>{detail.aspersion_date}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Evaluación</dt>
              <dd className="text-xs text-muted-foreground">{detail.evaluation ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Inicio estimado</dt>
              <dd>{detail.est_start_date ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Fin estimado</dt>
              <dd>{detail.est_finish_date ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Inicio real</dt>
              <dd>{detail.act_start_date ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Fin real</dt>
              <dd>{detail.act_finish_date ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Responsable</dt>
              <dd>
                {typeof detail.assigned_to === 'object' && detail.assigned_to !== null
                  ? (detail.assigned_to as { username: string }).username
                  : '—'}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Importación</dt>
              <dd>
                <Badge variant="outline">
                  {IMPORT_STATUS_LABELS[detail.import_status] ?? detail.import_status}
                </Badge>
              </dd>
            </div>
          </dl>

          <StatusBar
            currentStatus={detail.status ?? 'pending'}
            transitions={transitions}
            isMutating={isMutatingStatus}
            cancelPromptOpen={cancelPromptOpen}
            cancelNotes={cancelNotes}
            onCancelNotesChange={onCancelNotesChange}
            onCancelConfirm={onCancelConfirm}
            onCancelDismiss={onCancelDismiss}
            statusError={statusError}
            onStatusChange={onStatusChange}
          />

          <div className="rounded border border-dashed p-3">
            <p className="mb-1 text-sm font-medium">Importar puntos georeferenciados</p>
            <p className="mb-2 text-xs text-muted-foreground">
              Carga un archivo CSV con los puntos de aspersión de esta sesión.
            </p>
            <Button size="sm" onClick={() => setImportOpen(true)}>
              {detail.import_status === 'done' ? 'Reimportar datos' : 'Importar datos'}
            </Button>
          </div>

          {detail.import_status === 'done' && <AspersionImportSummary headerId={detail.id} />}

          <AspersionImportDialog
            headerId={detail.id}
            importStatus={detail.import_status}
            importErrors={detail.import_errors}
            open={importOpen}
            onOpenChange={setImportOpen}
          />
        </div>

        <div className="w-72 shrink-0 space-y-2">
          <PlotMiniMap plotId={plotId} />
          {canViewMap && (
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              onClick={() => setMapOpen(true)}
            >
              📍 Abrir visor de datos de aspersión
            </Button>
          )}
        </div>
      </div>

      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={onEdit}>
          Editar
        </Button>
      </div>

      {canViewMap && (
        <AspersionMapModal
          open={mapOpen}
          onClose={() => setMapOpen(false)}
          sessionId={detail.id}
          plotId={plotId}
        />
      )}
    </div>
  )
}

/* ─── Phyto view ──────────────────────────────────────────────────── */

interface PhytoViewProps {
  detail: import('../hooks/usePhytoSessionDetail').PhytoSessionDetail
  plotId: string | null
  transitions: string[]
  isMutatingStatus: boolean
  cancelPromptOpen: boolean
  cancelNotes: string
  onCancelNotesChange: (v: string) => void
  onCancelConfirm: () => void
  onCancelDismiss: () => void
  statusError: string | null
  onStatusChange: (s: string) => void
  onEdit: () => void
}

function PhytoView({
  detail,
  plotId,
  transitions,
  isMutatingStatus,
  cancelPromptOpen,
  cancelNotes,
  onCancelNotesChange,
  onCancelConfirm,
  onCancelDismiss,
  statusError,
  onStatusChange,
  onEdit,
}: PhytoViewProps) {
  return (
    <div className="space-y-4">
      <div className="flex gap-4">
        <div className="min-w-0 flex-1 space-y-4">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">Inicio estimado</dt>
              <dd>{detail.estimated_start_date ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Fin estimado</dt>
              <dd>{detail.estimated_end_date ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Inicio en campo</dt>
              <dd>{detail.started_at ? detail.started_at.replace('T', ' ').slice(0, 16) : '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Fin en campo</dt>
              <dd>{detail.finished_at ? detail.finished_at.replace('T', ' ').slice(0, 16) : '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Modo estricto</dt>
              <dd>{detail.strict_mode ? 'Sí' : 'No'}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Radio de tolerancia</dt>
              <dd>{detail.radius_tolerance ?? 5} m</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Responsable</dt>
              <dd className="text-xs text-muted-foreground">
                {detail.assigned_to ? `${String(detail.assigned_to).slice(0, 8)}…` : '—'}
              </dd>
            </div>
            {detail.additional_notes && (
              <div className="col-span-2">
                <dt className="text-xs text-muted-foreground">Notas</dt>
                <dd className="text-sm">{detail.additional_notes}</dd>
              </div>
            )}
          </dl>

          <StatusBar
            currentStatus={detail.status ?? 'pending'}
            transitions={transitions}
            isMutating={isMutatingStatus}
            cancelPromptOpen={cancelPromptOpen}
            cancelNotes={cancelNotes}
            onCancelNotesChange={onCancelNotesChange}
            onCancelConfirm={onCancelConfirm}
            onCancelDismiss={onCancelDismiss}
            statusError={statusError}
            onStatusChange={onStatusChange}
          />
        </div>

        <div className="w-72 shrink-0">
          <PlotMiniMap plotId={plotId} />
        </div>
      </div>

      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={onEdit}>
          Editar
        </Button>
      </div>
    </div>
  )
}

/* ─── Aspersión edit form ─────────────────────────────────────────── */

const ASPERSION_EDIT_FIELDS = [
  'aspersion_date', 'act_start_date', 'act_finish_date',
  'est_start_date', 'est_finish_date', 'evaluation_id', 'assigned_to_id',
] as const

function AspersionEditForm({
  detail,
  sesionId,
  masterId,
  datacentralId,
  onCancel,
  onSaved,
}: {
  detail: import('../hooks/useAspersionSessionDetail').AspersionSessionDetail
  sesionId: string
  masterId: string
  datacentralId: string
  onCancel: () => void
  onSaved: () => void
}) {
  const [showMeta, setShowMeta] = useState(false)
  const { data: evaluations = [] } = useEvaluations('ASPERSION')
  const { data: dcUsers = [] } = useDatacentralUsers(datacentralId)
  const mutation = useUpdateAspersionSession(sesionId, masterId)

  const { register, handleSubmit, control, setError, formState: { errors, isSubmitting } } =
    useForm<AspersionEditValues>({
      resolver: zodResolver(aspersionEditSchema),
      defaultValues: {
        aspersion_date: detail.aspersion_date ?? '',
        act_start_date: detail.act_start_date ?? '',
        act_finish_date: detail.act_finish_date ?? '',
        est_start_date: detail.est_start_date ?? '',
        est_finish_date: detail.est_finish_date ?? '',
        evaluation_id: (detail.evaluation as string | null) ?? '',
        assigned_to_id: '',
      },
    })

  function onSubmit(values: AspersionEditValues) {
    const patch = {
      aspersion_date: values.aspersion_date,
      ...(values.act_start_date ? { act_start_date: values.act_start_date } : { act_start_date: null }),
      ...(values.act_finish_date ? { act_finish_date: values.act_finish_date } : { act_finish_date: null }),
      ...(values.est_start_date ? { est_start_date: values.est_start_date } : {}),
      ...(values.est_finish_date ? { est_finish_date: values.est_finish_date } : {}),
      ...(values.evaluation_id ? { evaluation_id: values.evaluation_id } : {}),
      ...(values.assigned_to_id ? { assigned_to_id: values.assigned_to_id } : {}),
    }
    mutation.mutate(patch as never, {
      onSuccess: () => onSaved(),
      onError: (e: unknown) => {
        if (typeof e === 'object' && e !== null) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          applyDrfErrors(e as any, setError, ASPERSION_EDIT_FIELDS)
        }
      },
    })
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Fechas reales — siempre visibles, sin fricción */}
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Fechas reales
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="ae-act-start">Inicio real</Label>
            <Input id="ae-act-start" type="date" {...register('act_start_date')} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ae-act-end">Fin real</Label>
            <Input id="ae-act-end" type="date" {...register('act_finish_date')} />
          </div>
        </div>
      </div>

      {/* Metadatos — detrás de toggle */}
      <div>
        <button
          type="button"
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          onClick={() => setShowMeta((v) => !v)}
        >
          {showMeta ? '▾' : '▸'} Editar metadatos
        </button>
        {showMeta && (
          <div className="mt-2 space-y-3 rounded border border-amber-300 bg-amber-50 p-3 dark:border-amber-700 dark:bg-amber-950">
            <p className="text-xs text-amber-800 dark:text-amber-200">
              Cambiar estos campos puede crear inconsistencia con lo planificado originalmente.
            </p>
            <div className="space-y-1">
              <Label htmlFor="ae-date">Fecha de aspersión *</Label>
              <Input id="ae-date" type="date" {...register('aspersion_date')} />
              {errors.aspersion_date && (
                <p className="text-xs text-destructive">{errors.aspersion_date.message}</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="ae-est-start">Inicio estimado</Label>
                <Input id="ae-est-start" type="date" {...register('est_start_date')} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="ae-est-end">Fin estimado</Label>
                <Input id="ae-est-end" type="date" {...register('est_finish_date')} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Evaluación</Label>
              <Controller
                name="evaluation_id"
                control={control}
                render={({ field }) => (
                  <Select onValueChange={(v) => field.onChange(v === '__none__' ? undefined : v)} value={field.value || '__none__'}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sin evaluación" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Sin evaluación</SelectItem>
                      {evaluations.map((e) => (
                        <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-1">
              <Label>Responsable</Label>
              <Controller
                name="assigned_to_id"
                control={control}
                render={({ field }) => (
                  <Select onValueChange={(v) => field.onChange(v === '__none__' ? undefined : v)} value={field.value || '__none__'}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sin cambio" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Sin cambio</SelectItem>
                      {dcUsers.map((u) => (
                        <SelectItem key={u.id} value={u.id}>{u.full_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>
        )}
      </div>

      {errors.root && (
        <p className="rounded bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {errors.root.message}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting || mutation.isPending}>
          {(isSubmitting || mutation.isPending) ? 'Guardando...' : 'Guardar'}
        </Button>
      </div>
    </form>
  )
}

/* ─── Phyto edit form ─────────────────────────────────────────────── */

const PHYTO_EDIT_FIELDS = [
  'estimated_start_date', 'estimated_end_date', 'started_at', 'finished_at',
  'strict_mode', 'radius_tolerance', 'assigned_to_id', 'additional_notes',
] as const

function PhytoEditForm({
  detail,
  sesionId,
  masterId,
  datacentralId,
  onCancel,
  onSaved,
}: {
  detail: import('../hooks/usePhytoSessionDetail').PhytoSessionDetail
  sesionId: string
  masterId: string
  datacentralId: string
  onCancel: () => void
  onSaved: () => void
}) {
  const [showMeta, setShowMeta] = useState(false)
  const { data: dcUsers = [] } = useDatacentralUsers(datacentralId)
  const mutation = useUpdatePhytoSession(sesionId, masterId)

  const { register, handleSubmit, control, setError, formState: { errors, isSubmitting } } =
    useForm<PhytoEditValues>({
      resolver: zodResolver(phytoEditSchema),
      defaultValues: {
        estimated_start_date: detail.estimated_start_date ?? '',
        estimated_end_date: detail.estimated_end_date ?? '',
        started_at: toDatetimeLocal(detail.started_at),
        finished_at: toDatetimeLocal(detail.finished_at),
        strict_mode: detail.strict_mode ?? true,
        radius_tolerance: detail.radius_tolerance ?? 5,
        assigned_to_id: '',
        additional_notes: detail.additional_notes ?? '',
      },
    })

  function onSubmit(values: PhytoEditValues) {
    const patch = {
      estimated_start_date: values.estimated_start_date,
      strict_mode: values.strict_mode,
      radius_tolerance: values.radius_tolerance,
      ...(values.estimated_end_date ? { estimated_end_date: values.estimated_end_date } : {}),
      ...(values.started_at ? { started_at: fromDatetimeLocal(values.started_at) } : { started_at: null }),
      ...(values.finished_at ? { finished_at: fromDatetimeLocal(values.finished_at) } : { finished_at: null }),
      ...(values.assigned_to_id ? { assigned_to_id: values.assigned_to_id } : {}),
      ...(values.additional_notes ? { additional_notes: values.additional_notes } : {}),
    }
    mutation.mutate(patch as never, {
      onSuccess: () => onSaved(),
      onError: (e: unknown) => {
        if (typeof e === 'object' && e !== null) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          applyDrfErrors(e as any, setError, PHYTO_EDIT_FIELDS)
        }
      },
    })
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Fechas en campo — siempre visibles */}
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Fechas en campo
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="pe-started">Inicio en campo</Label>
            <Input id="pe-started" type="datetime-local" {...register('started_at')} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="pe-finished">Fin en campo</Label>
            <Input id="pe-finished" type="datetime-local" {...register('finished_at')} />
          </div>
        </div>
      </div>

      {/* Metadatos — detrás de toggle */}
      <div>
        <button
          type="button"
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          onClick={() => setShowMeta((v) => !v)}
        >
          {showMeta ? '▾' : '▸'} Editar metadatos
        </button>
        {showMeta && (
          <div className="mt-2 space-y-3 rounded border border-amber-300 bg-amber-50 p-3 dark:border-amber-700 dark:bg-amber-950">
            <p className="text-xs text-amber-800 dark:text-amber-200">
              Cambiar estos campos puede crear inconsistencia con lo planificado originalmente.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="pe-est-start">Inicio estimado *</Label>
                <Input id="pe-est-start" type="date" {...register('estimated_start_date')} />
                {errors.estimated_start_date && (
                  <p className="text-xs text-destructive">{errors.estimated_start_date.message}</p>
                )}
              </div>
              <div className="space-y-1">
                <Label htmlFor="pe-est-end">Fin estimado</Label>
                <Input id="pe-est-end" type="date" {...register('estimated_end_date')} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="pe-radius">Radio de tolerancia (m)</Label>
                <Input id="pe-radius" type="number" min={1} {...register('radius_tolerance')} />
                {errors.radius_tolerance && (
                  <p className="text-xs text-destructive">{errors.radius_tolerance.message}</p>
                )}
              </div>
              <div className="flex items-end pb-1">
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input type="checkbox" className="h-4 w-4" {...register('strict_mode')} />
                  Modo estricto
                </label>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Responsable</Label>
              <Controller
                name="assigned_to_id"
                control={control}
                render={({ field }) => (
                  <Select onValueChange={(v) => field.onChange(v === '__none__' ? undefined : v)} value={field.value || '__none__'}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sin cambio" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Sin cambio</SelectItem>
                      {dcUsers.map((u) => (
                        <SelectItem key={u.id} value={u.id}>{u.full_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="pe-notes">Notas adicionales</Label>
              <textarea
                id="pe-notes"
                rows={2}
                className="w-full rounded border px-2 py-1 text-sm"
                {...register('additional_notes')}
              />
              {errors.additional_notes && (
                <p className="text-xs text-destructive">{errors.additional_notes.message}</p>
              )}
            </div>
          </div>
        )}
      </div>

      {errors.root && (
        <p className="rounded bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {errors.root.message}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting || mutation.isPending}>
          {(isSubmitting || mutation.isPending) ? 'Guardando...' : 'Guardar'}
        </Button>
      </div>
    </form>
  )
}
