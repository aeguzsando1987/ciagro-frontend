import { createRoute, redirect, useParams, useSearch } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { z } from 'zod'
import { workspaceDcRoute } from './w.$dc'
import { useAuthStore } from '@/features/auth/useAuthStore'
import { ROLE_LEVELS } from '@/lib/auth/roles'
import { queryClient } from '@/lib/queryClient'
import { masterProgramsQueryOptions } from '@/features/task-manager/hooks/useMasterPrograms'
import { useMasterPrograms } from '@/features/task-manager/hooks/useMasterPrograms'
import { useMasterTree } from '@/features/task-manager/hooks/useMasterTree'
import { GanttHierarchy } from '@/features/task-manager/gantt/GanttHierarchy'
import { FilterBar } from '@/features/task-manager/gantt/FilterBar'
import { CreateMasterDialog } from '@/features/task-manager/dialogs/CreateMasterDialog'
import { MaestroModal } from '@/features/task-manager/panel/MaestroModal'
import { HijoModal } from '@/features/task-manager/panel/HijoModal'
import { SesionModal } from '@/features/task-manager/panel/SesionModal'
import { Button } from '@/components/ui/button'
import type { MasterProgram, ProgramaStatus } from '@/features/task-manager/types'

type ModalFrame =
  | { type: 'master'; masterId: string }
  | { type: 'hijo'; hijoId: string; masterId: string }
  | { type: 'sesion'; sesionId: string; sesionType: 'aspersion' | 'phyto'; hijoId: string; masterId: string }

/**
 * Search params del Gantt (paso 2.5).
 * Validados con zod: claves desconocidas o invalidas se descartan con .catch(undefined).
 * El backend acepta status como enum: pending|in_progress|loaded|completed|cancelled.
 */
const statusSchema = z
  .enum(['pending', 'in_progress', 'loaded', 'completed', 'cancelled'])
  .optional()
  .catch(undefined)

const taskManagerSearchSchema = z.object({
  status: statusSchema,
  agro_unit: z.string().optional().catch(undefined),
  // Deep-link desde el Visor de Datos Agrícolas: pre-abre un modal al cargar.
  openMaster: z.string().optional().catch(undefined),
  openHijo: z.string().optional().catch(undefined),
  openSesion: z.string().optional().catch(undefined),
  openSesionType: z.enum(['aspersion', 'phyto']).optional().catch(undefined),
})

/**
 * Ruta /w/$dc/task-manager (paso 2.1 del product-doc Flujo 2).
 *
 * Guard de rol: Supervisor+ (level >= 3). Regla critica #5: usa ROLE_LEVELS, no hardcodea.
 * Loader: precarga GET /field_ops/master-programs/?datacentral=<dc>.
 * Reactivo a search params via loaderDeps (refetch automatico al cambiar filtros).
 */
export const workspaceTaskManagerRoute = createRoute({
  getParentRoute: () => workspaceDcRoute,
  path: '/task-manager',
  validateSearch: taskManagerSearchSchema,
  beforeLoad: ({ params }) => {
    const user = useAuthStore.getState().user
    const level = user?.role_level ?? ROLE_LEVELS.GUEST
    if (level < ROLE_LEVELS.SUPERVISOR) {
      throw redirect({ to: '/w/$dc/dashboard', params: { dc: params.dc } })
    }
  },
  loaderDeps: ({ search }) => ({
    status: search.status,
    agro_unit: search.agro_unit,
  }),
  loader: ({ params, deps }) =>
    queryClient.ensureQueryData(
      masterProgramsQueryOptions({
        datacentral: params.dc,
        status: deps.status as ProgramaStatus | undefined,
        agro_unit: deps.agro_unit,
      })
    ),
  component: TaskManagerPage,
})

function TaskManagerPage() {
  const { dc } = useParams({ from: '/_authenticated/w/$dc/task-manager' })
  const search = useSearch({ from: '/_authenticated/w/$dc/task-manager' })
  const [createMasterOpen, setCreateMasterOpen] = useState(false)
  const [modalStack, setModalStack] = useState<ModalFrame[]>([])

  // Deep-link desde el Visor de Datos Agrícolas: pre-abre el modal correspondiente una
  // sola vez al montar, según los search params open* (sesión → subprograma → maestro).
  const deepLinkInit = useRef(false)
  useEffect(() => {
    if (deepLinkInit.current) return
    deepLinkInit.current = true
    if (search.openSesion && search.openHijo && search.openMaster) {
      setModalStack([{
        type: 'sesion',
        sesionId: search.openSesion,
        sesionType: search.openSesionType ?? 'aspersion',
        hijoId: search.openHijo,
        masterId: search.openMaster,
      }])
    } else if (search.openHijo && search.openMaster) {
      setModalStack([{ type: 'hijo', hijoId: search.openHijo, masterId: search.openMaster }])
    } else if (search.openMaster) {
      setModalStack([{ type: 'master', masterId: search.openMaster }])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const user = useAuthStore((s) => s.user)
  const isManager = (user?.role_level ?? 0) >= ROLE_LEVELS.MANAGER
  const isSuperAdmin = (user?.role_level ?? 0) >= ROLE_LEVELS.SUPER_ADMIN
  const isOwnerOfThisDc = user?.datacentrals.some((d) => d.id === dc && d.is_owner) ?? false
  const canCreateMaster = isSuperAdmin || isOwnerOfThisDc

  const { data: masters, isLoading, error } = useMasterPrograms({
    datacentral: dc,
    status: search.status,
    agro_unit: search.agro_unit,
  })

  function pushModal(frame: ModalFrame) {
    setModalStack((prev) => [...prev, frame])
  }
  function popModal() {
    setModalStack((prev) => prev.slice(0, -1))
  }
  function clearModal() {
    setModalStack([])
  }

  function handleTaskClick(
    id: string,
    level: 'master' | 'hijo' | 'sesion',
    masterId: string,
    extra: { hijoId: string; sesionType: 'aspersion' | 'phyto' } | null,
  ) {
    if (level === 'master') {
      pushModal({ type: 'master', masterId: id })
    } else if (level === 'hijo') {
      pushModal({ type: 'hijo', hijoId: id, masterId })
    } else if (extra?.hijoId) {
      pushModal({ type: 'sesion', sesionId: id, sesionType: extra.sesionType, hijoId: extra.hijoId, masterId })
    }
  }

  const topFrame = modalStack[modalStack.length - 1]
  const masterForModal = topFrame
    ? masters?.find((m: MasterProgram) =>
        topFrame.type === 'master' ? m.id === topFrame.masterId : m.id === topFrame.masterId
      )
    : undefined

  return (
    <div className="flex h-full flex-col gap-4">
      <header className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Programas</h1>
          <p className="text-sm text-muted-foreground">
            Cronograma de Programas, Subprogramas y Sesiones.
          </p>
        </div>
        {canCreateMaster && (
          <Button size="sm" onClick={() => setCreateMasterOpen(true)}>
            + Nuevo Programa
          </Button>
        )}
      </header>

      <FilterBar />

      {isLoading && <p className="text-muted-foreground">Cargando Programas...</p>}
      {error && <p className="text-destructive">Error al cargar Programas.</p>}
      {masters && masters.length === 0 && !isLoading && (
        <p className="text-muted-foreground">
          No hay Programas en este workspace todavía.
          {isManager && ' Usa el botón "+ Nuevo Programa" para crear el primero.'}
        </p>
      )}
      {masters && masters.length > 0 && (
        <GanttHierarchy masters={masters} onTaskClick={handleTaskClick} />
      )}

      <CreateMasterDialog
        open={createMasterOpen}
        onOpenChange={setCreateMasterOpen}
        datacentral={dc}
      />

      {/* Modal navigator — renderiza el frame superior del stack */}
      {topFrame?.type === 'master' && masterForModal && (
        <MaestroModal
          master={masterForModal}
          datacentral={dc}
          onClose={clearModal}
          onNavigateHijo={(hijoId) =>
            pushModal({ type: 'hijo', hijoId, masterId: topFrame.masterId })
          }
        />
      )}
      {topFrame?.type === 'hijo' && masterForModal && (
        <HijoModalWrapper
          hijoId={topFrame.hijoId}
          masterId={topFrame.masterId}
          master={masterForModal}
          datacentralId={dc}
          onClose={clearModal}
          onBack={popModal}
          onNavigateSesion={({ sesionId, sesionType }) =>
            pushModal({ type: 'sesion', sesionId, sesionType, hijoId: topFrame.hijoId, masterId: topFrame.masterId })
          }
        />
      )}
      {topFrame?.type === 'sesion' && (
        <SesionModal
          sesionId={topFrame.sesionId}
          sesionType={topFrame.sesionType}
          hijoId={topFrame.hijoId}
          masterId={topFrame.masterId}
          datacentralId={dc}
          onClose={clearModal}
          onBack={popModal}
        />
      )}
    </div>
  )
}

/* ─── HijoModalWrapper ─────────────────────────────────────────────
 * Componente separado para que useQuery cree una suscripción reactiva
 * al tree cache. getQueryData() en el render del padre es una lectura
 * puntual — no re-renderiza cuando React Query actualiza el cache tras
 * invalidar (ej. al crear una sesión). Con useQuery el componente
 * recibe el hijo actualizado automáticamente cuando llega el refetch.
 * ─────────────────────────────────────────────────────────────────── */
function HijoModalWrapper({
  hijoId,
  masterId,
  master,
  datacentralId,
  onClose,
  onBack,
  onNavigateSesion,
}: {
  hijoId: string
  masterId: string
  master: MasterProgram
  datacentralId: string
  onClose: () => void
  onBack: () => void
  onNavigateSesion: (ref: { sesionId: string; sesionType: 'aspersion' | 'phyto' }) => void
}) {
  const { data: tree, isLoading } = useMasterTree(masterId, true)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hijo = tree?.programas.find((p) => p.id === hijoId) as any
  if (isLoading) return <p className="p-8 text-muted-foreground">Cargando subprograma…</p>
  if (!hijo) return null
  return (
    <HijoModal
      hijo={hijo}
      master={master}
      datacentralId={datacentralId}
      onClose={onClose}
      onBack={onBack}
      onNavigateSesion={onNavigateSesion}
    />
  )
}
