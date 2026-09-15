import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Leaf } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { LoadingState } from '@/components/ui/loading-state'
import type { MasterProgramTree } from '@/features/task-manager/types'
import { useNdviSessionDetail } from '../hooks/useNdviSessionDetail'
import { NdviImportDialog } from '../components/NdviImportDialog'
import { NdviMapModal } from '../components/NdviMapModal'
import { NdviImportSummary } from '../components/NdviImportSummary'
import { SesionVariableMetrics } from '../components/SesionVariableMetrics'
import { useNdviVariableStats } from '../hooks/useNdviVariableStats'
import { FlushNdviDialog } from '../components/FlushNdviDialog'
import { DeleteLevelDialog } from '../components/DeleteLevelDialog'
import { useAuthStore } from '@/features/auth/useAuthStore'
import { ROLE_LEVELS } from '@/lib/auth/roles'
import { pointsCount } from '../lib/sesionLabels'
import {
  AdminActions,
  FichaImportStatus,
  FichaItem,
  ImportStatusPanels,
  SesionActions,
  SesionBody,
  SesionFicha,
  SesionShell,
} from './SesionShell'

interface Props {
  sesionId: string
  hijoId: string
  masterId: string
  onClose: () => void
  onBack: () => void
}

/**
 * Modal de una sesión NDVI. A diferencia de aspersión/fitosanitario, NDVI no tiene
 * evaluación ni reporteador: se importa el CSV, se revisa el resumen de índices y se abre
 * el visor de contornos. Por eso es un modal dedicado y simple, no una rama dentro de
 * SesionModal.
 *
 * La anatomía es la compartida en SesionShell, homologada con el resto de tipos.
 */
export function NdviSesionModal({ sesionId, hijoId, masterId, onClose, onBack }: Props) {
  const [importOpen, setImportOpen] = useState(false)
  const [visorOpen, setVisorOpen] = useState(false)
  const [flushOpen, setFlushOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const roleLevel = useAuthStore((s) => s.user?.role_level ?? ROLE_LEVELS.GUEST)
  const isSuperAdmin = roleLevel >= ROLE_LEVELS.SUPER_ADMIN

  const queryClient = useQueryClient()
  const tree = queryClient.getQueryData<MasterProgramTree>(['master-tree', masterId])
  const hijo = tree?.programas.find((p) => p.id === hijoId)

  const { data: detail, isLoading } = useNdviSessionDetail(sesionId)
  const plotId = detail?.plot ?? hijo?.plot ?? null
  const importStatus = detail?.import_status ?? 'pending'
  const points = pointsCount(detail?.points_count)
  const canOpenVisor = importStatus === 'done' && points > 0
  const varStats = useNdviVariableStats(sesionId, importStatus === 'done' && points > 0)

  return (
    <>
      <SesionShell
        icon={<Leaf className="h-4 w-4 text-green-600" />}
        title="Sesión NDVI (Índices vegetativos)"
        status={detail?.status}
        onBack={onBack}
        onClose={onClose}
      >
        {isLoading ? (
          <LoadingState label="Cargando sesión NDVI…" />
        ) : (
          <SesionBody>
            <SesionFicha plotId={plotId}>
              <FichaItem label="Fecha de la imagen">
                {detail?.session_date ?? '— (se toma del CSV)'}
              </FichaItem>
              <FichaImportStatus status={importStatus} />
              <FichaItem label="Puntos cargados">{points.toLocaleString('es-MX')}</FichaItem>
              <FichaItem label="Responsable">
                {detail?.assigned_to?.username ?? 'Sin asignar'}
              </FichaItem>
            </SesionFicha>

            <ImportStatusPanels
              status={importStatus}
              errors={detail?.import_errors}
              processingLabel="Procesando CSV de NDVI…"
              mappingHint="La importación quedó pendiente de mapeo: faltan columnas obligatorias (Longitude / Latitude). Vuelve a importar con un archivo válido."
            />

            {importStatus === 'done' && points > 0 && (
              <>
                <SesionVariableMetrics
                  title="Índices principales"
                  type="ndvi"
                  variables={varStats.data?.variables}
                  pointsCount={varStats.data?.points_count}
                  isLoading={varStats.isLoading}
                  error={varStats.error}
                />
                <NdviImportSummary headerId={sesionId} />
              </>
            )}

            <SesionActions>
              <Button
                type="button"
                onClick={() => setImportOpen(true)}
                disabled={importStatus === 'processing'}
              >
                {points > 0 ? 'Reimportar CSV' : 'Importar CSV'}
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
              <Button className="ml-auto" variant="ghost" onClick={onBack}>
                Volver al subprograma
              </Button>
            </SesionActions>

            {isSuperAdmin && (
              <AdminActions>
                {points > 0 && (
                  <Button size="sm" variant="destructive" onClick={() => setFlushOpen(true)}>
                    Eliminar los datos de esta sesión
                  </Button>
                )}
                <Button size="sm" variant="destructive" onClick={() => setDeleteOpen(true)}>
                  Eliminar la sesión completa
                </Button>
              </AdminActions>
            )}
          </SesionBody>
        )}
      </SesionShell>

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
      {isSuperAdmin && flushOpen && (
        <FlushNdviDialog open={flushOpen} onClose={() => setFlushOpen(false)} sessionId={sesionId} />
      )}
      {isSuperAdmin && (
        <DeleteLevelDialog
          open={deleteOpen}
          onClose={() => setDeleteOpen(false)}
          level="ndvi"
          onDeleted={onClose}
          id={sesionId}
        />
      )}
    </>
  )
}
