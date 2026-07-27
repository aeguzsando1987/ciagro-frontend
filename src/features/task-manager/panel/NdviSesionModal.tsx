import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Leaf } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { MasterProgramTree } from '@/features/task-manager/types'
import { useNdviSessionDetail } from '../hooks/useNdviSessionDetail'
import { NdviImportDialog } from '../components/NdviImportDialog'
import { NdviMapModal } from '../components/NdviMapModal'

const IMPORT_STATUS_LABELS: Record<string, string> = {
  pending: 'Sin importar',
  processing: 'Procesando',
  done: 'Completado',
  error: 'Error',
  pending_mapping: 'Pendiente de mapear',
}

interface Props {
  sesionId: string
  hijoId: string
  masterId: string
  onClose: () => void
  onBack: () => void
}

/**
 * Modal de una sesión NDVI. A diferencia de aspersión/fitosanitario, NDVI no tiene
 * evaluación, variable-stats ni reporteador: solo se importa el CSV y se abre el visor de
 * contornos. Por eso es un modal dedicado y simple, no una rama dentro de SesionModal.
 */
export function NdviSesionModal({ sesionId, hijoId, masterId, onClose, onBack }: Props) {
  const [importOpen, setImportOpen] = useState(false)
  const [visorOpen, setVisorOpen] = useState(false)

  const queryClient = useQueryClient()
  const tree = queryClient.getQueryData<MasterProgramTree>(['master-tree', masterId])
  const hijo = tree?.programas.find((p) => p.id === hijoId)

  const { data: detail, isLoading } = useNdviSessionDetail(sesionId)
  const plotId = detail?.plot ?? hijo?.plot ?? null
  const importStatus = detail?.import_status ?? 'pending'
  const points = Number(detail?.points_count ?? 0)
  const canOpenVisor = importStatus === 'done' && points > 0

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <button
              type="button"
              onClick={onBack}
              className="rounded p-1 hover:bg-accent"
              aria-label="Volver"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <Leaf className="h-4 w-4 text-green-600" />
            Sesión NDVI (Índices vegetativos)
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Cargando…</p>
        ) : (
          <div className="space-y-4">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Fecha de la imagen</dt>
              <dd>{detail?.session_date ?? '— (se toma del CSV)'}</dd>

              <dt className="text-muted-foreground">Estado de importación</dt>
              <dd>
                <Badge>{IMPORT_STATUS_LABELS[importStatus] ?? importStatus}</Badge>
              </dd>

              <dt className="text-muted-foreground">Puntos cargados</dt>
              <dd>{points.toLocaleString()}</dd>
            </dl>

            {importStatus === 'pending_mapping' && (
              <p className="rounded bg-amber-50 px-3 py-2 text-xs text-amber-800">
                La importación quedó pendiente de mapeo: faltan columnas obligatorias
                (Longitude / Latitude). Vuelve a importar con un archivo válido.
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={() => setImportOpen(true)}>
                Importar CSV
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={!canOpenVisor}
                onClick={() => setVisorOpen(true)}
                title={canOpenVisor ? '' : 'Importa datos para habilitar el visor'}
              >
                Abrir visor
              </Button>
            </div>
          </div>
        )}
      </DialogContent>

      {importOpen && (
        <NdviImportDialog
          headerId={sesionId}
          importStatus={importStatus}
          importErrors={detail?.import_errors}
          open={importOpen}
          onOpenChange={setImportOpen}
        />
      )}
      {visorOpen && (
        <NdviMapModal
          sessionId={sesionId}
          plotId={plotId}
          open={visorOpen}
          onOpenChange={setVisorOpen}
        />
      )}
    </Dialog>
  )
}
