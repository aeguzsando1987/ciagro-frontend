import { useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQueryClient } from '@tanstack/react-query'
import { Droplets, Layers, Microscope } from 'lucide-react'
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
import { LoadingState } from '@/components/ui/loading-state'
import { applyDrfErrors } from '../hooks/useDrfErrorMap'
import { useAspersionSessionDetail } from '../hooks/useAspersionSessionDetail'
import { usePhytoSessionDetail } from '../hooks/usePhytoSessionDetail'
import { useSoilMapSessionDetail } from '../hooks/useSoilMapSessionDetail'
import { useUpdateAspersionSession } from '../hooks/useUpdateAspersionSession'
import { useUpdatePhytoSession } from '../hooks/useUpdatePhytoSession'
import { useUpdateSoilMapSession } from '../hooks/useUpdateSoilMapSession'
import { useEvaluations } from '../hooks/useEvaluations'
import { useDatacentralUsers } from '../hooks/useDatacentralUsers'
import type { MasterProgramTree } from '@/features/task-manager/types'
import {
  AdminActions,
  DatosSesionCard,
  FichaImportStatus,
  FichaItem,
  ImportStatusPanels,
  SesionActions,
  SesionBody,
  SesionFicha,
  SesionShell,
} from './SesionShell'
import { pointsCount, sesionStatusLabel } from '../lib/sesionLabels'
import { AspersionImportDialog } from '../components/AspersionImportDialog'
import { SoilMapImportDialog } from '../components/SoilMapImportDialog'
import { FlushSoilMapDialog } from '../components/FlushSoilMapDialog'
import { SoilMapMapModal } from '../components/SoilMapMapModal'
import { AspersionImportSummary } from '../components/AspersionImportSummary'
import { SesionVariableMetrics } from '../components/SesionVariableMetrics'
import { useAspersionVariableStats } from '../hooks/useAspersionVariableStats'
import { useSoilMapVariableStats } from '../hooks/useSoilMapVariableStats'
import { PhytoStatsCard } from '../components/PhytoStatsCard'
import { PhytoMapModal } from '../components/PhytoMapModal'
import { usePhytoSessionStats } from '../hooks/usePhytoSessionStats'
import { AspersionMapModal } from '../components/AspersionMapModal'
import { FlushAspersionDialog } from '../components/FlushAspersionDialog'
import { DeleteLevelDialog } from '../components/DeleteLevelDialog'
import { useAuthStore } from '@/features/auth/useAuthStore'
import { ROLE_LEVELS } from '@/lib/auth/roles'
import { SessionReportPanel } from '@/features/session-report/components/SessionReportPanel'

/* ─── Constants ───────────────────────────────────────────────────── */

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

const phytoEditSchema = z.object({
  estimated_start_date: z.string().min(1, 'Requerido'),
  estimated_end_date: z.string().optional().or(z.literal('')),
  started_at: z.string().optional().or(z.literal('')),
  finished_at: z.string().optional().or(z.literal('')),
  strict_mode: z.boolean(),
  radius_tolerance: z.coerce.number().int().min(1, 'Mínimo 1 m'),
  assigned_to_id: z.string().uuid().optional().or(z.literal('')),
  additional_notes: z.string().optional().or(z.literal('')),
})

const soilMapEditSchema = z.object({
  mapping_date: z.string().min(1, 'Requerido'),
  real_init_date: z.string().optional().or(z.literal('')),
  real_finish_date: z.string().optional().or(z.literal('')),
  est_init_date: z.string().optional().or(z.literal('')),
  est_finish_date: z.string().optional().or(z.literal('')),
  assigned_to_id: z.string().uuid().optional().or(z.literal('')),
})

type AspersionEditValues = z.infer<typeof aspersionEditSchema>
type PhytoEditValues = z.infer<typeof phytoEditSchema>
type SoilMapEditValues = z.infer<typeof soilMapEditSchema>

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
  sesionType: 'aspersion' | 'phyto' | 'soil_map'
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
  const soilMapQuery = useSoilMapSessionDetail(sesionType === 'soil_map' ? sesionId : null)

  const aspersionMutation = useUpdateAspersionSession(sesionId, masterId)
  const phytoMutation = useUpdatePhytoSession(sesionId, masterId)
  const soilMapMutation = useUpdateSoilMapSession(sesionId, masterId)

  const isLoading =
    sesionType === 'aspersion'
      ? aspersionQuery.isLoading
      : sesionType === 'phyto'
        ? phytoQuery.isLoading
        : soilMapQuery.isLoading
  const aspersionDetail = aspersionQuery.data
  const phytoDetail = phytoQuery.data
  const soilMapDetail = soilMapQuery.data

  const plotId =
    sesionType === 'aspersion'
      ? (aspersionDetail?.plot ?? hijo?.plot ?? null)
      : sesionType === 'phyto'
        ? (phytoDetail?.plot ?? hijo?.plot ?? null)
        : (soilMapDetail?.plot ?? hijo?.plot ?? null)

  const currentStatus =
    sesionType === 'aspersion'
      ? (aspersionDetail?.status ?? 'pending')
      : sesionType === 'phyto'
        ? (phytoDetail?.status ?? 'pending')
        : (soilMapDetail?.status ?? 'pending')

  const transitions =
    sesionType === 'phyto'
      ? (PHYTO_TRANSITIONS[currentStatus] ?? [])
      : (ASPERSION_TRANSITIONS[currentStatus] ?? [])

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
    } else if (sesionType === 'phyto') {
      phytoMutation.mutate(
        { status: newStatus as never },
        { onError: (e: unknown) => setStatusError(String(e)) }
      )
    } else {
      soilMapMutation.mutate(
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
    (aspersionMutation.isPending || phytoMutation.isPending || soilMapMutation.isPending) &&
    !isEditing

  const SESION_META = {
    aspersion: {
      title: 'Sesión de Aspersión',
      icon: <Droplets className="h-4 w-4 text-sky-600" />,
    },
    phyto: {
      title: 'Sesión Fitosanitaria',
      icon: <Microscope className="h-4 w-4 text-lime-600" />,
    },
    soil_map: {
      title: 'Sesión de Mapeo de Suelo',
      icon: <Layers className="h-4 w-4 text-amber-600" />,
    },
  }[sesionType]

  return (
    <SesionShell
      icon={SESION_META.icon}
      title={SESION_META.title}
      status={currentStatus}
      onBack={onBack}
      onClose={onClose}
    >
        {isLoading && <LoadingState label="Cargando sesión…" />}

        {!isLoading && !isEditing && sesionType === 'aspersion' && aspersionDetail && (
          <AspersionView
            onDeleted={onClose}
            detail={aspersionDetail}
            plotId={plotId}
            datacentralId={datacentralId}
            transitions={transitions}
            isMutatingStatus={isMutatingStatus}
            cancelPromptOpen={cancelPromptOpen}
            cancelNotes={cancelNotes}
            onCancelNotesChange={setCancelNotes}
            onCancelConfirm={handleCancelConfirm}
            onCancelDismiss={() => {
              setCancelPromptOpen(false)
              setCancelNotes('')
            }}
            statusError={statusError}
            onStatusChange={handleStatusChange}
            onEdit={() => setIsEditing(true)}
            onBack={onBack}
          />
        )}

        {!isLoading && !isEditing && sesionType === 'phyto' && phytoDetail && (
          <PhytoView
            onDeleted={onClose}
            detail={phytoDetail}
            plotId={plotId}
            transitions={transitions}
            isMutatingStatus={isMutatingStatus}
            cancelPromptOpen={cancelPromptOpen}
            cancelNotes={cancelNotes}
            onCancelNotesChange={setCancelNotes}
            onCancelConfirm={handleCancelConfirm}
            onCancelDismiss={() => {
              setCancelPromptOpen(false)
              setCancelNotes('')
            }}
            statusError={statusError}
            onStatusChange={handleStatusChange}
            onEdit={() => setIsEditing(true)}
            onBack={onBack}
          />
        )}

        {!isLoading && !isEditing && sesionType === 'soil_map' && soilMapDetail && (
          <SoilMapView
            onDeleted={onClose}
            detail={soilMapDetail}
            plotId={plotId}
            datacentralId={datacentralId}
            transitions={transitions}
            isMutatingStatus={isMutatingStatus}
            statusError={statusError}
            onStatusChange={handleStatusChange}
            onEdit={() => setIsEditing(true)}
            onBack={onBack}
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

        {!isLoading && isEditing && sesionType === 'soil_map' && soilMapDetail && (
          <SoilMapEditForm
            detail={soilMapDetail}
            sesionId={sesionId}
            masterId={masterId}
            datacentralId={datacentralId}
            onCancel={() => setIsEditing(false)}
            onSaved={() => setIsEditing(false)}
          />
        )}
    </SesionShell>
  )
}

/* ─── Shared status/cancel fragment ──────────────────────────────── */

interface StatusBarProps {
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
      {transitions.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Cambiar estado a:</span>
          {transitions.map((s) => (
            <Button
              key={s}
              size="sm"
              variant="outline"
              disabled={isMutating}
              onClick={() => onStatusChange(s)}
            >
              {sesionStatusLabel(s)}
            </Button>
          ))}
        </div>
      )}

      {cancelPromptOpen && (
        <div className="space-y-2 rounded border border-destructive/30 bg-destructive/5 p-3">
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

      {statusError && <p className="text-xs text-destructive">{statusError}</p>}
    </div>
  )
}

/* ─── Aspersión view ──────────────────────────────────────────────── */

interface AspersionViewProps {
  /** Cierra el modal de la sesion tras borrarla: si no, queda abierto sobre algo inexistente. */
  onDeleted: () => void
  detail: import('../hooks/useAspersionSessionDetail').AspersionSessionDetail
  plotId: string | null
  datacentralId: string
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
  /** Cierra la sesion y vuelve al subprograma, como en Rendimiento y NDVI. */
  onBack: () => void
}

function AspersionView({
  onDeleted,
  detail,
  plotId,
  datacentralId,
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
  onBack,
}: AspersionViewProps) {
  const [importOpen, setImportOpen] = useState(false)
  const [mapOpen, setMapOpen] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [flushOpen, setFlushOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const roleLevel = useAuthStore((s) => s.user?.role_level ?? ROLE_LEVELS.GUEST)
  const points = pointsCount(detail.points_count)
  const hasPoints = points > 0
  // El rol decide si la accion EXISTE; los datos deciden si esta habilitada. Ofrecer un
  // visor deshabilitado a quien nunca podra abrirlo solo genera preguntas.
  const canSeeVisor = roleLevel >= ROLE_LEVELS.SUPERVISOR
  const canOpenVisor = canSeeVisor && detail.import_status === 'done' && hasPoints
  const isSuperAdmin = roleLevel >= ROLE_LEVELS.SUPER_ADMIN
  // Las tarjetas y la tabla de detalle comparten esta query: react-query la resuelve una vez.
  const varStats = useAspersionVariableStats(detail.id, detail.import_status === 'done')

  return (
    <SesionBody>
      <SesionFicha plotId={plotId}>
        <FichaItem label="Fecha de aspersión">{detail.aspersion_date}</FichaItem>
        <FichaImportStatus status={detail.import_status} />
        <FichaItem label="Puntos cargados">{points.toLocaleString('es-MX')}</FichaItem>
        <FichaItem label="Responsable">
          {typeof detail.assigned_to === 'object' && detail.assigned_to !== null
            ? (detail.assigned_to as { username: string }).username
            : 'Sin asignar'}
        </FichaItem>
        <FichaItem label="Evaluación">{detail.evaluation ?? '—'}</FichaItem>
        <FichaItem label="Inicio estimado">{detail.est_start_date ?? '—'}</FichaItem>
        <FichaItem label="Fin estimado">{detail.est_finish_date ?? '—'}</FichaItem>
        <FichaItem label="Inicio real">{detail.act_start_date ?? '—'}</FichaItem>
        <FichaItem label="Fin real">{detail.act_finish_date ?? '—'}</FichaItem>
      </SesionFicha>

      <StatusBar
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

      <DatosSesionCard
        description="Puedes corregir fechas, evaluación y responsable sin tocar el CSV ya importado."
        canEdit
        onEdit={onEdit}
      />

      <ImportStatusPanels
        status={detail.import_status}
        errors={detail.import_errors}
        processingLabel="Procesando CSV de aspersión…"
        mappingHint="El archivo no pudo mapearse automáticamente. Verifica que incluya las columnas de longitud y latitud de cada punto."
      />

      {detail.import_status === 'done' && (
        <>
          <SesionVariableMetrics
            title="Resumen de la aplicación"
            type="aspersion"
            variables={varStats.data?.variables}
            pointsCount={varStats.data?.points_count}
            isLoading={varStats.isLoading}
            error={varStats.error}
          />
          <AspersionImportSummary headerId={detail.id} />
        </>
      )}

      <SesionActions note="La reimportación añade puntos a los existentes, no los reemplaza.">
        <Button
          onClick={() => setImportOpen(true)}
          disabled={detail.import_status === 'processing'}
        >
          {detail.import_status === 'done' ? 'Reimportar datos' : 'Importar datos'}
        </Button>
        {canSeeVisor && (
          <Button
            variant="outline"
            disabled={!canOpenVisor}
            onClick={() => setMapOpen(true)}
            title={canOpenVisor ? '' : 'Importa datos para habilitar el visor'}
          >
            Abrir visor de datos de aspersión
          </Button>
        )}
        {canSeeVisor && (
          <Button variant="outline" disabled={!canOpenVisor} onClick={() => setReportOpen(true)}>
            Reportes
          </Button>
        )}
        <Button className="ml-auto" variant="ghost" onClick={onBack}>
          Volver al subprograma
        </Button>
      </SesionActions>

      {isSuperAdmin && (
        <AdminActions>
          {hasPoints && (
            <Button size="sm" variant="destructive" onClick={() => setFlushOpen(true)}>
              Eliminar los datos de esta sesión
            </Button>
          )}
          <Button size="sm" variant="destructive" onClick={() => setDeleteOpen(true)}>
            Eliminar la sesión completa
          </Button>
        </AdminActions>
      )}

      <AspersionImportDialog
        headerId={detail.id}
        importStatus={detail.import_status}
        importErrors={detail.import_errors}
        open={importOpen}
        onOpenChange={setImportOpen}
      />

      {isSuperAdmin && (
        <FlushAspersionDialog
          open={flushOpen}
          onClose={() => setFlushOpen(false)}
          sessionId={detail.id}
        />
      )}

      {isSuperAdmin && (
        <DeleteLevelDialog
          open={deleteOpen}
          onClose={() => setDeleteOpen(false)}
          level="aspersion"
          onDeleted={onDeleted}
          id={detail.id}
        />
      )}

      {canOpenVisor && (
        <AspersionMapModal
          open={mapOpen}
          onClose={() => setMapOpen(false)}
          sessionId={detail.id}
          plotId={plotId}
          datacentralId={datacentralId}
        />
      )}

      {canOpenVisor && (
        <SessionReportPanel
          open={reportOpen}
          onClose={() => setReportOpen(false)}
          objectId={detail.id}
          plotId={plotId}
          datacentralId={datacentralId}
        />
      )}
    </SesionBody>
  )
}

/* ─── Soil map view ───────────────────────────────────────────────── */

interface SoilMapViewProps {
  /** Cierra el modal de la sesion tras borrarla: si no, queda abierto sobre algo inexistente. */
  onDeleted: () => void
  detail: import('../hooks/useSoilMapSessionDetail').SoilMapSessionDetail
  plotId: string | null
  datacentralId: string
  transitions: string[]
  isMutatingStatus: boolean
  statusError: string | null
  onStatusChange: (s: string) => void
  onEdit: () => void
  onBack: () => void
}

function canViewSoilMap(
  roleLevel: number,
  importStatus: string,
  pointsCount: string | number | null | undefined
) {
  return (
    roleLevel >= ROLE_LEVELS.SUPERVISOR &&
    importStatus === 'done' &&
    parseInt(String(pointsCount ?? '0'), 10) > 0
  )
}

export function SoilMapView({
  onDeleted,
  detail,
  plotId,
  datacentralId,
  transitions,
  isMutatingStatus,
  statusError,
  onStatusChange,
  onEdit,
  onBack,
}: SoilMapViewProps) {
  const [importOpen, setImportOpen] = useState(false)
  const [mapOpen, setMapOpen] = useState(false)
  const [flushOpen, setFlushOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const roleLevel = useAuthStore((s) => s.user?.role_level ?? ROLE_LEVELS.GUEST)
  const points = pointsCount(detail.points_count)
  const hasPoints = points > 0
  const canSeeVisor = roleLevel >= ROLE_LEVELS.SUPERVISOR
  const canOpenVisor = canViewSoilMap(roleLevel, detail.import_status, detail.points_count)
  const isSuperAdmin = roleLevel >= ROLE_LEVELS.SUPER_ADMIN
  const varStats = useSoilMapVariableStats(detail.id, detail.import_status === 'done')

  return (
    <SesionBody>
      <SesionFicha plotId={plotId}>
        <FichaItem label="Fecha del mapeo">{detail.mapping_date}</FichaItem>
        <FichaImportStatus status={detail.import_status} />
        <FichaItem label="Puntos importados">{points.toLocaleString('es-MX')}</FichaItem>
        <FichaItem label="Responsable">
          {typeof detail.assigned_to === 'object' && detail.assigned_to !== null
            ? (detail.assigned_to.username ?? 'Sin asignar')
            : 'Sin asignar'}
        </FichaItem>
        <FichaItem label="Inicio estimado">{detail.est_init_date ?? '—'}</FichaItem>
        <FichaItem label="Fin estimado">{detail.est_finish_date ?? '—'}</FichaItem>
        <FichaItem label="Inicio real">{detail.real_init_date ?? '—'}</FichaItem>
        <FichaItem label="Fin real">{detail.real_finish_date ?? '—'}</FichaItem>
      </SesionFicha>

      <StatusBar
        transitions={transitions}
        isMutating={isMutatingStatus}
        cancelPromptOpen={false}
        cancelNotes=""
        onCancelNotesChange={() => undefined}
        onCancelConfirm={() => undefined}
        onCancelDismiss={() => undefined}
        statusError={statusError}
        onStatusChange={onStatusChange}
      />

      <DatosSesionCard
        description="Puedes corregir fechas y responsable sin tocar el CSV ya importado."
        canEdit
        onEdit={onEdit}
      />

      <ImportStatusPanels
        status={detail.import_status}
        errors={detail.import_errors}
        processingLabel="Procesando CSV de suelo…"
        mappingHint="El archivo no pudo mapearse automáticamente. Verifica que incluya las coordenadas y las variables de análisis de suelo."
      />

      {detail.import_status === 'done' && (
        <SesionVariableMetrics
          title="Resumen del análisis de suelo"
          type="soil_map"
          variables={varStats.data?.variables}
          pointsCount={varStats.data?.points_count}
          isLoading={varStats.isLoading}
          error={varStats.error}
        />
      )}

      <SesionActions note="La reimportación añade muestras a las existentes, no las reemplaza.">
        <Button
          onClick={() => setImportOpen(true)}
          disabled={detail.import_status === 'processing'}
        >
          {detail.import_status === 'done' ? 'Reimportar datos' : 'Importar datos'}
        </Button>
        {canSeeVisor && (
          <Button
            variant="outline"
            disabled={!canOpenVisor}
            onClick={() => setMapOpen(true)}
            title={canOpenVisor ? '' : 'Importa datos para habilitar el visor'}
            data-testid="soil-map-ready"
          >
            Abrir visor de datos de suelo
          </Button>
        )}
        <Button className="ml-auto" variant="ghost" onClick={onBack}>
          Volver al subprograma
        </Button>
      </SesionActions>

      {isSuperAdmin && (
        <AdminActions>
          {hasPoints && (
            <Button size="sm" variant="destructive" onClick={() => setFlushOpen(true)}>
              Eliminar los datos de esta sesión
            </Button>
          )}
          <Button size="sm" variant="destructive" onClick={() => setDeleteOpen(true)}>
            Eliminar la sesión completa
          </Button>
        </AdminActions>
      )}

      <SoilMapImportDialog
        headerId={detail.id}
        importStatus={detail.import_status}
        importErrors={detail.import_errors}
        open={importOpen}
        onOpenChange={setImportOpen}
      />

      {isSuperAdmin && (
        <FlushSoilMapDialog
          open={flushOpen}
          onClose={() => setFlushOpen(false)}
          sessionId={detail.id}
        />
      )}

      {isSuperAdmin && (
        <DeleteLevelDialog
          open={deleteOpen}
          onClose={() => setDeleteOpen(false)}
          level="soil_map"
          onDeleted={onDeleted}
          id={detail.id}
        />
      )}

      {canOpenVisor && (
        <SoilMapMapModal
          open={mapOpen}
          onClose={() => setMapOpen(false)}
          sessionId={detail.id}
          plotId={plotId}
          datacentralId={datacentralId}
        />
      )}
    </SesionBody>
  )
}

/* ─── Phyto view ──────────────────────────────────────────────────── */

interface PhytoViewProps {
  /** Cierra el modal de la sesion tras borrarla: si no, queda abierto sobre algo inexistente. */
  onDeleted: () => void
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
  onBack: () => void
}

function PhytoView({
  onDeleted,
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
  onBack,
}: PhytoViewProps) {
  const [mapOpen, setMapOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const roleLevel = useAuthStore((s) => s.user?.role_level ?? ROLE_LEVELS.GUEST)
  const { data: stats } = usePhytoSessionStats(detail.id)
  const canSeeVisor = roleLevel >= ROLE_LEVELS.SUPERVISOR
  const canOpenVisor = canSeeVisor && (stats?.checkpoints_count ?? 0) > 0
  const isSuperAdmin = roleLevel >= ROLE_LEVELS.SUPER_ADMIN

  return (
    <SesionBody>
      <SesionFicha plotId={plotId}>
        <FichaItem label="Inicio estimado">{detail.estimated_start_date ?? '—'}</FichaItem>
        <FichaItem label="Fin estimado">{detail.estimated_end_date ?? '—'}</FichaItem>
        <FichaItem label="Inicio en campo">
          {detail.started_at ? detail.started_at.replace('T', ' ').slice(0, 16) : '—'}
        </FichaItem>
        <FichaItem label="Fin en campo">
          {detail.finished_at ? detail.finished_at.replace('T', ' ').slice(0, 16) : '—'}
        </FichaItem>
        <FichaItem label="Responsable">
          {detail.assigned_to ? `${String(detail.assigned_to).slice(0, 8)}…` : 'Sin asignar'}
        </FichaItem>
        <FichaItem label="Modo estricto">{detail.strict_mode ? 'Sí' : 'No'}</FichaItem>
        <FichaItem label="Radio de tolerancia">{detail.radius_tolerance ?? 5} m</FichaItem>
      </SesionFicha>

      {detail.additional_notes && (
        <div className="rounded-lg border bg-muted/20 p-3">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Notas</p>
          <p className="mt-0.5 text-sm">{detail.additional_notes}</p>
        </div>
      )}

      <StatusBar
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

      <DatosSesionCard
        description="Puedes corregir fechas, tolerancia y responsable sin tocar los puntos de control levantados en campo."
        canEdit
        onEdit={onEdit}
      />

      <PhytoStatsCard headerId={detail.id} />

      <SesionActions>
        {canSeeVisor && (
          <Button
            variant="outline"
            disabled={!canOpenVisor}
            onClick={() => setMapOpen(true)}
            title={canOpenVisor ? '' : 'Sin puntos de control levantados todavía'}
          >
            Abrir visor de datos fitosanitarios
          </Button>
        )}
        <Button className="ml-auto" variant="ghost" onClick={onBack}>
          Volver al subprograma
        </Button>
      </SesionActions>

      {isSuperAdmin && (
        <AdminActions>
          <Button size="sm" variant="destructive" onClick={() => setDeleteOpen(true)}>
            Eliminar la sesión completa
          </Button>
        </AdminActions>
      )}

      {isSuperAdmin && (
        <DeleteLevelDialog
          open={deleteOpen}
          onClose={() => setDeleteOpen(false)}
          level="phyto"
          onDeleted={onDeleted}
          id={detail.id}
        />
      )}

      {canOpenVisor && (
        <PhytoMapModal
          open={mapOpen}
          onClose={() => setMapOpen(false)}
          sessionId={detail.id}
          plotId={plotId}
        />
      )}
    </SesionBody>
  )
}

/* ─── Aspersión edit form ─────────────────────────────────────────── */

const ASPERSION_EDIT_FIELDS = [
  'aspersion_date',
  'act_start_date',
  'act_finish_date',
  'est_start_date',
  'est_finish_date',
  'evaluation_id',
  'assigned_to_id',
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

  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<AspersionEditValues>({
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
      ...(values.act_start_date
        ? { act_start_date: values.act_start_date }
        : { act_start_date: null }),
      ...(values.act_finish_date
        ? { act_finish_date: values.act_finish_date }
        : { act_finish_date: null }),
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
                  <Select
                    onValueChange={(v) => field.onChange(v === '__none__' ? undefined : v)}
                    value={field.value || '__none__'}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sin evaluación" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Sin evaluación</SelectItem>
                      {evaluations.map((e) => (
                        <SelectItem key={e.id} value={e.id}>
                          {e.name}
                        </SelectItem>
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
                  <Select
                    onValueChange={(v) => field.onChange(v === '__none__' ? undefined : v)}
                    value={field.value || '__none__'}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sin cambio" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Sin cambio</SelectItem>
                      {dcUsers.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {dcUsers.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No hay técnicos asignados a esta CIA. Asigna usuarios en Administración para poder
                  designar un responsable.
                </p>
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
          {isSubmitting || mutation.isPending ? 'Guardando...' : 'Guardar'}
        </Button>
      </div>
    </form>
  )
}

/* ─── Soil map edit form ──────────────────────────────────────────── */

const SOIL_MAP_EDIT_FIELDS = [
  'mapping_date',
  'real_init_date',
  'real_finish_date',
  'est_init_date',
  'est_finish_date',
  'assigned_to_id',
] as const

function SoilMapEditForm({
  detail,
  sesionId,
  masterId,
  datacentralId,
  onCancel,
  onSaved,
}: {
  detail: import('../hooks/useSoilMapSessionDetail').SoilMapSessionDetail
  sesionId: string
  masterId: string
  datacentralId: string
  onCancel: () => void
  onSaved: () => void
}) {
  const [showMeta, setShowMeta] = useState(false)
  const { data: dcUsers = [] } = useDatacentralUsers(datacentralId)
  const mutation = useUpdateSoilMapSession(sesionId, masterId)

  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SoilMapEditValues>({
    resolver: zodResolver(soilMapEditSchema),
    defaultValues: {
      mapping_date: detail.mapping_date ?? '',
      real_init_date: detail.real_init_date ?? '',
      real_finish_date: detail.real_finish_date ?? '',
      est_init_date: detail.est_init_date ?? '',
      est_finish_date: detail.est_finish_date ?? '',
      assigned_to_id: '',
    },
  })

  function onSubmit(values: SoilMapEditValues) {
    const patch = {
      mapping_date: values.mapping_date,
      real_init_date: values.real_init_date || null,
      real_finish_date: values.real_finish_date || null,
      est_init_date: values.est_init_date || null,
      est_finish_date: values.est_finish_date || null,
      ...(values.assigned_to_id ? { assigned_to_id: values.assigned_to_id } : {}),
    }

    mutation.mutate(patch, {
      onSuccess: () => onSaved(),
      onError: (error: unknown) => {
        if (typeof error === 'object' && error !== null) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          applyDrfErrors(error as any, setError, SOIL_MAP_EDIT_FIELDS)
        }
      },
    })
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Fechas reales
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="sme-real-start">Inicio real</Label>
            <Input id="sme-real-start" type="date" {...register('real_init_date')} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="sme-real-end">Fin real</Label>
            <Input id="sme-real-end" type="date" {...register('real_finish_date')} />
          </div>
        </div>
      </div>

      <div>
        <button
          type="button"
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          onClick={() => setShowMeta((value) => !value)}
        >
          {showMeta ? '▾' : '▸'} Editar metadatos
        </button>
        {showMeta && (
          <div className="mt-2 space-y-3 rounded border border-amber-300 bg-amber-50 p-3 dark:border-amber-700 dark:bg-amber-950">
            <p className="text-xs text-amber-800 dark:text-amber-200">
              Cambiar estos campos puede crear inconsistencia con lo planificado originalmente.
            </p>
            <div className="space-y-1">
              <Label htmlFor="sme-date">Fecha del mapeo *</Label>
              <Input id="sme-date" type="date" {...register('mapping_date')} />
              {errors.mapping_date && (
                <p className="text-xs text-destructive">{errors.mapping_date.message}</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="sme-est-start">Inicio estimado</Label>
                <Input id="sme-est-start" type="date" {...register('est_init_date')} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="sme-est-end">Fin estimado</Label>
                <Input id="sme-est-end" type="date" {...register('est_finish_date')} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Responsable</Label>
              <Controller
                name="assigned_to_id"
                control={control}
                render={({ field }) => (
                  <Select
                    onValueChange={(value) =>
                      field.onChange(value === '__none__' ? undefined : value)
                    }
                    value={field.value || '__none__'}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sin cambio" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Sin cambio</SelectItem>
                      {dcUsers.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.full_name}
                        </SelectItem>
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
          {isSubmitting || mutation.isPending ? 'Guardando...' : 'Guardar'}
        </Button>
      </div>
    </form>
  )
}

/* ─── Phyto edit form ─────────────────────────────────────────────── */

const PHYTO_EDIT_FIELDS = [
  'estimated_start_date',
  'estimated_end_date',
  'started_at',
  'finished_at',
  'strict_mode',
  'radius_tolerance',
  'assigned_to_id',
  'additional_notes',
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

  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<PhytoEditValues>({
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
      ...(values.started_at
        ? { started_at: fromDatetimeLocal(values.started_at) }
        : { started_at: null }),
      ...(values.finished_at
        ? { finished_at: fromDatetimeLocal(values.finished_at) }
        : { finished_at: null }),
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
                  <Select
                    onValueChange={(v) => field.onChange(v === '__none__' ? undefined : v)}
                    value={field.value || '__none__'}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sin cambio" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Sin cambio</SelectItem>
                      {dcUsers.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {dcUsers.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No hay técnicos asignados a esta CIA. Asigna usuarios en Administración para poder
                  designar un responsable.
                </p>
              )}
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
          {isSubmitting || mutation.isPending ? 'Guardando...' : 'Guardar'}
        </Button>
      </div>
    </form>
  )
}
