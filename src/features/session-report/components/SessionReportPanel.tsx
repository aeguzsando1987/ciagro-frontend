/**
 * Panel lateral del Reporteador de Sesiones (Sheet ancho a la derecha).
 *
 * Reutilizable desde el visor (`AspersionMapModal`) y desde el Task Manager (`SesionModal`).
 * Recibe la sesión (`objectId` = UUID del header) y resuelve su reporte único. Estados:
 * cargando / sin reporte (botón "Generar reporte de actividad") / con reporte (tarjeta +
 * formulario + issues + sync). Por GAP-AC-001 el reporteador es solo para aspersión.
 *
 * El acceso ya viene gated (datos cargados + `role_level>=SUPERVISOR`); aquí calculamos
 * `canWrite` (>=TECHNICIAN) para habilitar acciones de escritura. El backend revalida permisos.
 */
import { useState } from 'react'
import { Map as MapIcon, X } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/features/auth/useAuthStore'
import { ROLE_LEVELS } from '@/lib/auth/roles'
import { AspersionMap } from '@/features/geodata-visor/components/AspersionMap'
import { useSessionReport } from '../hooks/useSessionReport'
import { ReportCard } from './ReportCard'
import { ReportForm } from './ReportForm'
import { SessionIssuesTable } from './SessionIssuesTable'
import { ReportDeliverables } from './ReportDeliverables'
import { SyncReportButton } from './SyncReportButton'
import type { SessionType } from '../types'

interface SessionReportPanelProps {
  open: boolean
  onClose: () => void
  /** UUID del header de sesión (object_id). */
  objectId: string
  plotId: string | null
  /** Habilita el selector de responsable interno en los issues. */
  datacentralId?: string | null
  /** Hoy solo `aspersion` (GAP-AC-001). */
  sessionType?: SessionType
}

export function SessionReportPanel({
  open,
  onClose,
  objectId,
  plotId,
  datacentralId,
  sessionType = 'aspersion',
}: SessionReportPanelProps) {
  const roleLevel = useAuthStore((s) => s.user?.role_level ?? ROLE_LEVELS.GUEST)
  const canWrite = roleLevel >= ROLE_LEVELS.TECHNICIAN
  const [creating, setCreating] = useState(false)
  const [mapOpen, setMapOpen] = useState(false)

  const { data: report, isLoading, isError, refetch } = useSessionReport(
    sessionType,
    open ? objectId : null
  )

  return (
    <Sheet open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose() }}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-xl lg:max-w-2xl"
      >
        {/* Cabecera fija: título + Sincronizar (no scrollea con el contenido). */}
        <div className="shrink-0 space-y-2 border-b px-6 py-4">
          <SheetTitle>Reporte de sesión</SheetTitle>
          <SheetDescription>
            Resumen, diagnóstico y temas de atención de la actividad de aspersión.
          </SheetDescription>
          {!isLoading && !isError && report && (
            <SyncReportButton
              report={report}
              sessionType={sessionType}
              objectId={objectId}
              canWrite={canWrite}
            />
          )}
        </div>

        {/* Cuerpo scrollable. */}
        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
          {isLoading && (
            <p className="text-sm text-muted-foreground">Cargando reporte…</p>
          )}

          {isError && !isLoading && (
            <div className="space-y-2">
              <p className="text-sm text-destructive">
                No se pudo cargar el reporte de la sesión.
              </p>
              <Button size="sm" variant="outline" onClick={() => refetch()}>
                Reintentar
              </Button>
            </div>
          )}

          {!isLoading && !isError && !report && !creating && (
            <ReportEmptyState canWrite={canWrite} onGenerate={() => setCreating(true)} />
          )}

          {!isLoading && !isError && !report && creating && (
            <ReportForm
              mode="create"
              sessionType={sessionType}
              objectId={objectId}
              canWrite={canWrite}
              onCancel={() => setCreating(false)}
              onCreated={() => setCreating(false)}
            />
          )}

          {!isLoading && !isError && report && (
            <div className="space-y-4">
              <ReportCard report={report} />
              <ReportForm
                mode="edit"
                sessionType={sessionType}
                objectId={objectId}
                report={report}
                canWrite={canWrite}
              />
              <SessionIssuesTable
                reportId={report.id}
                canWrite={canWrite}
                datacentralId={datacentralId}
              />
              <ReportDeliverables
                report={report}
                sessionType={sessionType}
                objectId={objectId}
                plotId={plotId}
                canWrite={canWrite}
              />
            </div>
          )}
        </div>

        {/* Mapa satelital de la parcela (referencia visual). Botón vertical en el borde
            izquierdo del panel; despliega un drawer bloqueado (sin zoom/rotación) a la
            izquierda. Montaje lazy: solo carga datos con el drawer abierto. Oculto en móvil. */}
        {plotId && (
          <>
            <button
              type="button"
              onClick={() => setMapOpen((v) => !v)}
              className="fixed right-[36rem] top-1/2 z-[60] hidden h-24 w-8 -translate-y-1/2 flex-col items-center justify-center gap-1 rounded-l-md border border-r-0 bg-background shadow-md hover:bg-accent sm:flex lg:right-[42rem]"
              title={mapOpen ? 'Ocultar mapa' : 'Ver mapa de la parcela'}
              aria-label={mapOpen ? 'Ocultar mapa' : 'Ver mapa de la parcela'}
            >
              <MapIcon className="h-4 w-4" />
              <span className="text-[10px] [writing-mode:vertical-rl]">
                {mapOpen ? 'Ocultar' : 'Ver mapa'}
              </span>
            </button>

            {mapOpen && (
              <div className="fixed left-2 right-[36rem] top-2 bottom-2 z-50 hidden overflow-hidden rounded-md border bg-background shadow-xl sm:block lg:right-[42rem]">
                <AspersionMap
                  sessionId={objectId}
                  plotId={plotId}
                  enabled={open && mapOpen}
                  locked
                  className="h-full"
                />
                <button
                  type="button"
                  onClick={() => setMapOpen(false)}
                  className="absolute right-2 top-2 z-10 flex items-center gap-1 rounded-md border bg-background/90 px-2 py-1 text-xs shadow hover:bg-accent"
                  aria-label="Ocultar mapa"
                >
                  <X className="h-3.5 w-3.5" /> Ocultar mapa
                </button>
              </div>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

function ReportEmptyState({
  canWrite,
  onGenerate,
}: {
  canWrite: boolean
  onGenerate: () => void
}) {
  return (
    <div className="rounded border border-dashed p-4 text-center">
      <p className="mb-1 text-sm font-medium">Esta sesión aún no tiene reporte</p>
      <p className="mb-3 text-xs text-muted-foreground">
        Genera el reporte de actividad para registrar observaciones, diagnóstico y temas de
        atención. Los datos denormalizados se calculan desde la sesión.
      </p>
      <Button
        size="sm"
        onClick={onGenerate}
        disabled={!canWrite}
        title={canWrite ? undefined : 'Requiere rol técnico o superior'}
      >
        Generar reporte de actividad
      </Button>
    </div>
  )
}
