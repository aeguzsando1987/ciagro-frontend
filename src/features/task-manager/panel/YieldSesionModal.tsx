import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Pencil, Wheat } from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { LoadingState } from '@/components/ui/loading-state'
import { YieldMapImportDialog } from '@/features/yield-map/components/YieldMapImportDialog'
import { YieldMapModal } from '@/features/yield-map/components/YieldMapModal'
import { useYieldMapSessionDetail } from '@/features/yield-map/hooks/useYieldMapSessionDetail'
import { useYieldMapStats } from '@/features/yield-map/hooks/useYieldMapStats'
import { useUpdateYieldMapSession } from '@/features/yield-map/hooks/useUpdateYieldMapSession'
import { PlotMiniMap } from './PlotMiniMap'
import { usePlotGeometry } from '../hooks/usePlotGeometry'
import { FlushYieldMapDialog } from '../components/FlushYieldMapDialog'
import { DeleteLevelDialog } from '../components/DeleteLevelDialog'
import { useAuthStore } from '@/features/auth/useAuthStore'
import { ROLE_LEVELS } from '@/lib/auth/roles'
import type { MasterProgramTree } from '@/features/task-manager/types'

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  in_progress: 'En progreso',
  loaded: 'Cargado',
  completed: 'Completado',
  cancelled: 'Cancelado',
}

const IMPORT_LABELS: Record<string, string> = {
  pending: 'Sin importar',
  processing: 'Procesando',
  done: 'Completado',
  error: 'Error',
  pending_mapping: 'Mapeo pendiente',
}

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
  const points = Number(detail?.points_count ?? 0)
  const stats = useYieldMapStats(sesionId, points > 0).data
  const plotId = detail?.plot ?? hijo?.plot ?? null
  const plotDetail = usePlotGeometry(plotId).data
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
      <Dialog
        open
        onOpenChange={(open) => {
          if (!open) onClose()
        }}
      >
        <DialogContent className="max-h-[88vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onBack}
                className="rounded p-1 hover:bg-accent"
                aria-label="Volver"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <Wheat className="h-4 w-4 text-emerald-600" />
              Sesión de Rendimiento
              {detail && (
                <Badge variant="secondary">{STATUS_LABELS[detail.status] ?? detail.status}</Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          {detailQuery.isLoading || !detail ? (
            <LoadingState label="Cargando sesión de rendimiento…" />
          ) : (
            <div className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="h-44 overflow-hidden rounded-md border">
                  <PlotMiniMap plotId={plotId} />
                </div>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 self-start text-sm">
                  <dt className="text-muted-foreground">Fecha de cosecha</dt>
                  <dd>{detail.harvest_date ?? '—'}</dd>
                  <dt className="text-muted-foreground">Estado de importación</dt>
                  <dd>
                    <Badge>{IMPORT_LABELS[detail.import_status] ?? detail.import_status}</Badge>
                  </dd>
                  <dt className="text-muted-foreground">Puntos cargados</dt>
                  <dd>{points.toLocaleString('es-MX')}</dd>
                  <dt className="text-muted-foreground">Rancho</dt>
                  <dd>{plotDetail?.properties?.ranch_name ?? '—'}</dd>
                  <dt className="text-muted-foreground">Parcela</dt>
                  <dd>{plotDetail?.properties?.code ?? '—'}</dd>
                  <dt className="text-muted-foreground">Responsable</dt>
                  <dd>{detail.assigned_to?.username ?? 'Sin asignar'}</dd>
                </dl>
              </div>

              {canEdit && (
                <div className="rounded-lg border p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-semibold">Datos de la sesión</h3>
                      <p className="text-xs text-muted-foreground">
                        Puedes corregir fechas sin tocar el CSV ya importado.
                      </p>
                    </div>
                    {!editing && (
                      <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                        <Pencil className="mr-1 h-3.5 w-3.5" /> Editar
                      </Button>
                    )}
                  </div>

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
                </div>
              )}

              {(detail.source_product || detail.source_lot || detail.source_dataset) && (
                <div className="grid gap-3 rounded-lg border bg-muted/20 p-3 text-sm sm:grid-cols-3">
                  <Info label="Producto del CSV" value={detail.source_product ?? '—'} />
                  <Info label="Lote del CSV" value={detail.source_lot ?? '—'} />
                  <Info label="Conjunto de datos" value={detail.source_dataset ?? '—'} />
                </div>
              )}

              {detail.import_status === 'processing' && (
                <LoadingState
                  compact
                  label="Procesando CSV de rendimiento…"
                  className="justify-start rounded-lg border bg-muted/20"
                />
              )}

              {detail.import_status === 'pending_mapping' && (
                <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
                  El archivo no pudo mapearse automáticamente. Verifica que incluya Longitude,
                  Latitude y una columna de rendimiento de cosecha.
                </div>
              )}

              {detail.import_status === 'error' && (
                <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
                  <p className="font-semibold">La importación falló</p>
                  <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap">
                    {JSON.stringify(detail.import_errors, null, 2)}
                  </pre>
                </div>
              )}

              {stats && (
                <div>
                  <h3 className="mb-2 text-sm font-semibold">Resumen del mapa</h3>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <Metric label="Rendimiento promedio" value={`${n(stats.yield_avg)} t/ha`} />
                    <Metric label="Producción total" value={`${n(stats.production_total_t)} t`} />
                    <Metric label="Humedad promedio" value={`${n(stats.moisture_avg)} %`} />
                    <Metric
                      label="Superficie cosechada"
                      value={`${n(stats.surface_total_ha)} ha`}
                    />
                  </div>
                </div>
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

              <div className="flex flex-wrap gap-2 border-t pt-4">
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
              </div>

              {isSuperAdmin && (
                <div className="border-t border-dashed pt-4">
                  <p className="mb-2 text-xs font-medium text-muted-foreground">
                    Acciones de administrador
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {points > 0 && (
                      <Button size="sm" variant="destructive" onClick={() => setFlushOpen(true)}>
                        Eliminar los datos de esta sesión
                      </Button>
                    )}
                    <Button size="sm" variant="destructive" onClick={() => setDeleteOpen(true)}>
                      Eliminar la sesión completa
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

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

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-medium">{value}</p>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </div>
  )
}
