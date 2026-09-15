import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Wheat } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { LoadingState } from '@/components/ui/loading-state'
import { YieldMapImportDialog } from '@/features/yield-map/components/YieldMapImportDialog'
import { YieldMapModal } from '@/features/yield-map/components/YieldMapModal'
import { useYieldMapSessionDetail } from '@/features/yield-map/hooks/useYieldMapSessionDetail'
import { useYieldMapStats } from '@/features/yield-map/hooks/useYieldMapStats'
import { useUpdateYieldMapSession } from '@/features/yield-map/hooks/useUpdateYieldMapSession'
import { FlushYieldMapDialog } from '../components/FlushYieldMapDialog'
import { DeleteLevelDialog } from '../components/DeleteLevelDialog'
import { useAuthStore } from '@/features/auth/useAuthStore'
import { ROLE_LEVELS } from '@/lib/auth/roles'
import { pointsCount } from '../lib/sesionLabels'
import {
  AdminActions,
  DatosSesionCard,
  FichaImportStatus,
  FichaItem,
  ImportStatusPanels,
  Info,
  Metric,
  MetricGrid,
  SesionActions,
  SesionBody,
  SesionFicha,
  SesionShell,
} from './SesionShell'
import type { MasterProgramTree } from '@/features/task-manager/types'

function n(value: number | null | undefined, digits = 2) {
  return value == null || !Number.isFinite(value) ? '—' : value.toFixed(digits)
}

interface Props {
  sesionId: string
  hijoId: string
  masterId: string
  onClose: () => void
  onBack: () => void
}

/**
 * Modal dedicado a Rendimiento. Conserva el mismo ciclo operativo de NDVI:
 * crear -> importar -> polling -> resumen -> visor, y añade las acciones administrativas
 * de vaciar datos / borrar sesión. Los metadatos se pueden corregir sin tocar los puntos.
 *
 * Es la referencia de diseño de los cinco modales de sesión: su anatomía se extrajo a
 * SesionShell y los demás tipos la consumen desde ahí.
 */
export function YieldSesionModal({ sesionId, hijoId, masterId, onClose, onBack }: Props) {
  const [importOpen, setImportOpen] = useState(false)
  const [visorOpen, setVisorOpen] = useState(false)
  const [flushOpen, setFlushOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [harvestDate, setHarvestDate] = useState('')
  const [estInitDate, setEstInitDate] = useState('')
  const [estFinishDate, setEstFinishDate] = useState('')

  const roleLevel = useAuthStore((s) => s.user?.role_level ?? ROLE_LEVELS.GUEST)
  const canEdit = roleLevel >= ROLE_LEVELS.SUPERVISOR
  const isSuperAdmin = roleLevel >= ROLE_LEVELS.SUPER_ADMIN

  const queryClient = useQueryClient()
  const tree = queryClient.getQueryData<MasterProgramTree>(['master-tree', masterId])
  const hijo = tree?.programas.find((program) => program.id === hijoId)
  const detailQuery = useYieldMapSessionDetail(sesionId)
  const detail = detailQuery.data
  const updateSession = useUpdateYieldMapSession(sesionId, masterId)
  const points = pointsCount(detail?.points_count)
  const stats = useYieldMapStats(sesionId, points > 0).data
  const plotId = detail?.plot ?? hijo?.plot ?? null
  const canOpenVisor = points > 0 && detail?.import_status !== 'processing'

  useEffect(() => {
    if (!detail || editing) return
    setHarvestDate(detail.harvest_date ?? '')
    setEstInitDate(detail.est_init_date ?? '')
    setEstFinishDate(detail.est_finish_date ?? '')
  }, [detail, editing])

  async function saveMetadata() {
    if (!harvestDate) {
      toast.error('La fecha de cosecha es obligatoria.')
      return
    }
    try {
      await updateSession.mutateAsync({
        harvest_date: harvestDate,
        est_init_date: estInitDate || null,
        est_finish_date: estFinishDate || null,
      })
      toast.success('Sesión de rendimiento actualizada.')
      setEditing(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo actualizar la sesión.')
    }
  }

  return (
    <>
      <SesionShell
        icon={<Wheat className="h-4 w-4 text-emerald-600" />}
        title="Sesión de Rendimiento"
        status={detail?.status}
        onBack={onBack}
        onClose={onClose}
      >
        {detailQuery.isLoading || !detail ? (
          <LoadingState label="Cargando sesión de rendimiento…" />
        ) : (
          <SesionBody>
            <SesionFicha plotId={plotId}>
              <FichaItem label="Fecha de cosecha">{detail.harvest_date ?? '—'}</FichaItem>
              <FichaImportStatus status={detail.import_status} />
              <FichaItem label="Puntos cargados">{points.toLocaleString('es-MX')}</FichaItem>
              <FichaItem label="Responsable">
                {detail.assigned_to?.username ?? 'Sin asignar'}
              </FichaItem>
            </SesionFicha>

            <DatosSesionCard
              description="Puedes corregir fechas sin tocar el CSV ya importado."
              canEdit={canEdit}
              editing={editing}
              onEdit={() => setEditing(true)}
            >
              {editing && (
                <div className="mt-3 space-y-3">
                  <div className="space-y-1">
                    <Label htmlFor="yield-edit-harvest">Fecha de cosecha *</Label>
                    <Input
                      id="yield-edit-harvest"
                      type="date"
                      value={harvestDate}
                      onChange={(e) => setHarvestDate(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label htmlFor="yield-edit-start">Inicio estimado</Label>
                      <Input
                        id="yield-edit-start"
                        type="date"
                        value={estInitDate}
                        onChange={(e) => setEstInitDate(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="yield-edit-finish">Fin estimado</Label>
                      <Input
                        id="yield-edit-finish"
                        type="date"
                        value={estFinishDate}
                        onChange={(e) => setEstFinishDate(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setEditing(false)}
                      disabled={updateSession.isPending}
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="button"
                      onClick={() => void saveMetadata()}
                      disabled={updateSession.isPending}
                    >
                      {updateSession.isPending ? 'Guardando…' : 'Guardar cambios'}
                    </Button>
                  </div>
                </div>
              )}
            </DatosSesionCard>

            {(detail.source_product || detail.source_lot || detail.source_dataset) && (
              <div className="grid gap-3 rounded-lg border bg-muted/20 p-3 text-sm sm:grid-cols-3">
                <Info label="Producto del CSV" value={detail.source_product ?? '—'} />
                <Info label="Lote del CSV" value={detail.source_lot ?? '—'} />
                <Info label="Conjunto de datos" value={detail.source_dataset ?? '—'} />
              </div>
            )}

            <ImportStatusPanels
              status={detail.import_status}
              errors={detail.import_errors}
              processingLabel="Procesando CSV de rendimiento…"
              mappingHint="El archivo no pudo mapearse automáticamente. Verifica que incluya Longitude, Latitude y una columna de rendimiento de cosecha."
            />

            {stats && (
              <MetricGrid title="Resumen del mapa">
                <Metric label="Rendimiento promedio" value={`${n(stats.yield_avg)} t/ha`} />
                <Metric label="Producción total" value={`${n(stats.production_total_t)} t`} />
                <Metric label="Humedad promedio" value={`${n(stats.moisture_avg)} %`} />
                <Metric label="Superficie cosechada" value={`${n(stats.surface_total_ha)} ha`} />
              </MetricGrid>
            )}

            <div className="rounded-lg border p-4">
              <h3 className="text-sm font-semibold">Vistas disponibles dentro del mapa</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                El selector del mapa cambia la misma sesión entre Rendimiento, Humedad, Velocidad,
                Producción y Elevación.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {[
                  'Rendimiento (t/ha)',
                  'Humedad (%)',
                  'Velocidad (km/h)',
                  'Producción (t/h)',
                  'Elevación (m)',
                ].map((label) => (
                  <Badge key={label} variant="outline">
                    {label}
                  </Badge>
                ))}
              </div>
            </div>

            <SesionActions>
              <Button
                onClick={() => setImportOpen(true)}
                disabled={detail.import_status === 'processing'}
              >
                {points > 0 ? 'Reimportar CSV' : 'Importar CSV'}
              </Button>
              <Button
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

      {detail && (
        <YieldMapImportDialog
          headerId={detail.id}
          importStatus={detail.import_status}
          importErrors={detail.import_errors}
          open={importOpen}
          onOpenChange={setImportOpen}
        />
      )}
      {detail && visorOpen && (
        <YieldMapModal
          sessionId={detail.id}
          plotId={plotId}
          open={visorOpen}
          onOpenChange={setVisorOpen}
        />
      )}
      {isSuperAdmin && flushOpen && (
        <FlushYieldMapDialog
          open={flushOpen}
          onClose={() => setFlushOpen(false)}
          sessionId={sesionId}
        />
      )}
      {isSuperAdmin && (
        <DeleteLevelDialog
          open={deleteOpen}
          onClose={() => setDeleteOpen(false)}
          level="yield_map"
          onDeleted={onClose}
          id={sesionId}
        />
      )}
    </>
  )
}
