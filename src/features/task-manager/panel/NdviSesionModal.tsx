import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Leaf } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { LoadingState } from '@/components/ui/loading-state'
import type { MasterProgramTree } from '@/features/task-manager/types'
import { useNdviSessionDetail } from '../hooks/useNdviSessionDetail'
import { NdviImportDialog } from '../components/NdviImportDialog'
import { SentinelImportDialog } from '../components/SentinelImportDialog'
import { NdviMapModal } from '../components/NdviMapModal'
import { NdviImportSummary } from '../components/NdviImportSummary'
import { SesionVariableMetrics } from '../components/SesionVariableMetrics'
import { useNdviVariableStats } from '../hooks/useNdviVariableStats'
import { FlushNdviDialog } from '../components/FlushNdviDialog'
import { DeleteLevelDialog } from '../components/DeleteLevelDialog'
import { useAuthStore } from '@/features/auth/useAuthStore'
import { ROLE_LEVELS } from '@/lib/auth/roles'
import { pointsCount } from '../lib/sesionLabels'
import { acquisitionSummary, isSentinel, sourceLabel, sourceShortLabel } from '../lib/ndviSource'
import { fetchSesionLocation, type SesionLocation } from '../hooks/useNdviSentinel'
import { Badge } from '@/components/ui/badge'
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
  /**
   * Abre otra sesion en la pila de modales. Lo usa el 409 de adquisicion duplicada: el
   * backend dice cual es la sesion que ya tiene esa pasada, y puede vivir en otro subprograma.
   */
  onNavigateSesion?: (location: SesionLocation) => void
}

/**
 * Modal de una sesión NDVI. A diferencia de aspersión/fitosanitario, NDVI no tiene
 * evaluación ni reporteador: se importa el CSV, se revisa el resumen de índices y se abre
 * el visor de contornos. Por eso es un modal dedicado y simple, no una rama dentro de
 * SesionModal.
 *
 * La anatomía es la compartida en SesionShell, homologada con el resto de tipos.
 */
export function NdviSesionModal({
  sesionId,
  hijoId,
  masterId,
  onClose,
  onBack,
  onNavigateSesion,
}: Props) {
  const [importOpen, setImportOpen] = useState(false)
  const [sentinelOpen, setSentinelOpen] = useState(false)
  const [visorOpen, setVisorOpen] = useState(false)
  const [flushOpen, setFlushOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const roleLevel = useAuthStore((s) => s.user?.role_level ?? ROLE_LEVELS.GUEST)
  const isSuperAdmin = roleLevel >= ROLE_LEVELS.SUPER_ADMIN
  // El endpoint sentinel-import exige IsTechnician (nivel >= 2). Deshabilitar aqui evita
  // ofrecer una accion que el backend va a rechazar con 403.
  const canImportSentinel = roleLevel >= ROLE_LEVELS.TECHNICIAN

  const queryClient = useQueryClient()
  const tree = queryClient.getQueryData<MasterProgramTree>(['master-tree', masterId])
  const hijo = tree?.programas.find((p) => p.id === hijoId)

  const { data: detail, isLoading } = useNdviSessionDetail(sesionId)
  const plotId = detail?.plot ?? hijo?.plot ?? null
  const importStatus = detail?.import_status ?? 'pending'
  const points = pointsCount(detail?.points_count)
  const canOpenVisor = importStatus === 'done' && points > 0
  const varStats = useNdviVariableStats(sesionId, importStatus === 'done' && points > 0)
  const source = detail?.source ?? null
  const meta = acquisitionSummary(detail?.acquisition_meta)

  return (
    <>
      <SesionShell
        icon={<Leaf className="h-4 w-4 text-green-600" />}
        title="Sesión NDVI (Índices vegetativos)"
        status={detail?.status}
        badge={
          source ? (
            <Badge variant={isSentinel(source) ? 'secondary' : 'outline'}>
              {sourceShortLabel(source)}
            </Badge>
          ) : undefined
        }
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
              <FichaItem label="Origen de los datos">
                {sourceLabel(source)}
                {detail?.acquisition_id ? ` · ${detail.acquisition_id}` : ''}
                {meta ? (
                  <span className="block text-xs text-muted-foreground">{meta}</span>
                ) : null}
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
                onClick={() => setSentinelOpen(true)}
                disabled={importStatus === 'processing' || !canImportSentinel}
                title={
                  canImportSentinel
                    ? 'Trae los indices directamente de Sentinel-2, sin archivo'
                    : 'Tu nivel de usuario no permite importar datos de satelite'
                }
              >
                Importar de satélite
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
      {sentinelOpen && (
        <SentinelImportDialog
          headerId={sesionId}
          sessionDate={detail?.session_date ?? null}
          pointsCount={points}
          open={sentinelOpen}
          onOpenChange={setSentinelOpen}
          onGoToExisting={
            onNavigateSesion
              ? (existingId) => {
                  // La sesion duplicada puede colgar de otro subprograma, asi que hay que
                  // resolver su ubicacion antes de empujarla a la pila de modales.
                  void fetchSesionLocation(existingId).then((location) => {
                    if (location) onNavigateSesion(location)
                    // Si no se pudo resolver (la sesion existe pero esta fuera del alcance
                    // del usuario, por ejemplo), decirlo: peor seria un clic que no hace nada.
                    else toast.error('No se pudo abrir la sesion que ya tiene esa adquisicion.')
                  })
                }
              : undefined
          }
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
