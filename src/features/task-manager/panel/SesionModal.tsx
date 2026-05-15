import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useQueryClient } from '@tanstack/react-query'
import type { MasterProgramTree } from '@/features/task-manager/types'
import { PlotMiniMap } from './PlotMiniMap'

const IMPORT_STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  processing: 'Procesando',
  done: 'Cargado',
  error: 'Error',
  pending_mapping: 'Mapeo pendiente',
}

interface SesionModalProps {
  sesionId: string
  sesionType: 'aspersion' | 'phyto'
  hijoId: string
  masterId: string
  onClose: () => void
  onBack: () => void
}

export function SesionModal({ sesionId, sesionType, hijoId, masterId, onClose, onBack }: SesionModalProps) {
  const queryClient = useQueryClient()

  // Los datos de la sesión están en el tree cache (ya cargado porque el Maestro estaba expandido).
  const tree = queryClient.getQueryData<MasterProgramTree>(['master-tree', masterId])
  const hijo = tree?.programas.find((p) => p.id === hijoId)

  const sesion = sesionType === 'aspersion'
    ? hijo?.aspersion_sessions.find((s) => s.id === sesionId)
    : hijo?.phyto_monitoring_headers.find((s) => s.id === sesionId)

  const fecha = sesion
    ? sesionType === 'aspersion'
      ? (sesion as { aspersion_date: string }).aspersion_date
      : (sesion as { session_date: string }).session_date
    : null

  const importStatus = sesion?.import_status ?? 'pending'

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <button
              type="button"
              onClick={onBack}
              className="mr-1 text-sm text-muted-foreground hover:text-foreground"
            >
              ← Volver
            </button>
            {sesionType === 'aspersion' ? '💧 Sesión de Aspersión' : '🌿 Sesión Fitosanitaria'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {!sesion && (
            <p className="text-sm text-muted-foreground">Cargando datos de la sesión...</p>
          )}

          {sesion && (
            <>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">Tipo</dt>
                  <dd>{sesionType === 'aspersion' ? 'Aspersión' : 'Fitosanitario'}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Fecha</dt>
                  <dd>{fecha ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Estado de importación</dt>
                  <dd>
                    <Badge>{IMPORT_STATUS_LABELS[importStatus] ?? importStatus}</Badge>
                  </dd>
                </div>
                {sesionType === 'phyto' && (sesion as { status?: string }).status && (
                  <div>
                    <dt className="text-xs text-muted-foreground">Status sesión</dt>
                    <dd>{(sesion as { status: string }).status}</dd>
                  </div>
                )}
                {hijo?.plot && (
                  <div className="col-span-2">
                    <dt className="text-xs text-muted-foreground">Parcela (heredada del Hijo)</dt>
                    <dd className="truncate text-xs text-muted-foreground">{hijo.plot}</dd>
                  </div>
                )}
              </dl>

              <PlotMiniMap plotId={hijo?.plot ?? null} />

              {/* Importar datos — placeholder para Sprint 2.D */}
              {sesionType === 'aspersion' && (
                <div className="rounded border border-dashed p-3">
                  <p className="mb-2 text-sm font-medium">Importar puntos georeferenciados</p>
                  <p className="mb-3 text-xs text-muted-foreground">
                    Carga un archivo CSV con los puntos de aspersión de esta sesión.
                  </p>
                  <Button
                    size="sm"
                    disabled
                    title="Disponible en Sprint 2.D"
                  >
                    Importar datos (próximamente)
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
