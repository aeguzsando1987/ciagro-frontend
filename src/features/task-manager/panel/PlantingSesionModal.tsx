import { useEffect, useState } from 'react'
import { Sprout } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { LoadingState } from '@/components/ui/loading-state'
import { PlantingMapImportDialog } from '@/features/planting-map/components/PlantingMapImportDialog'
import { PlantingMapModal } from '@/features/planting-map/components/PlantingMapModal'
import { FlushPlantingMapDialog } from '@/features/task-manager/components/FlushPlantingMapDialog'
import { DeleteLevelDialog } from '@/features/task-manager/components/DeleteLevelDialog'
import { usePlantingMapSessionDetail } from '@/features/planting-map/hooks/usePlantingMapSessionDetail'
import { usePlantingMapStats } from '@/features/planting-map/hooks/usePlantingMapStats'
import { useUpdatePlantingMapSession } from '@/features/planting-map/hooks/useUpdatePlantingMapSession'
import { PLANTING_LAYER_BY_KEY } from '@/features/planting-map/lib/plantingMapLayers'
import { useAuthStore } from '@/features/auth/useAuthStore'
import { ROLE_LEVELS } from '@/lib/auth/roles'
import {
  DatosSesionCard,
  FichaImportStatus,
  FichaItem,
  ImportStatusPanels,
  Info,
  Metric,
  MetricGrid,
  AdminActions,
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

function n(value: number | null | undefined, digits = 2) {
  return value == null || !Number.isFinite(value) ? '—' : value.toFixed(digits)
}

export function PlantingSesionModal({
  sesionId,
  masterId,
  onClose,
  onBack,
}: Props) {
  const [importOpen, setImportOpen] = useState(false)
  const [visorOpen, setVisorOpen] = useState(false)
  const [flushOpen, setFlushOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [plantingDate, setPlantingDate] = useState('')
  const [estInitDate, setEstInitDate] = useState('')
  const [estFinishDate, setEstFinishDate] = useState('')
  const [realInitDate, setRealInitDate] = useState('')
  const [realFinishDate, setRealFinishDate] = useState('')

  const roleLevel = useAuthStore((state) => state.user?.role_level ?? ROLE_LEVELS.GUEST)
  const canEdit = roleLevel >= ROLE_LEVELS.SUPERVISOR
  const canImport = roleLevel >= ROLE_LEVELS.TECHNICIAN
  const isSuperAdmin = roleLevel >= ROLE_LEVELS.SUPER_ADMIN

  const detailQuery = usePlantingMapSessionDetail(sesionId)
  const detail = detailQuery.data
  const statsQuery = usePlantingMapStats(sesionId, Boolean(detail?.points_count))
  const stats = statsQuery.data
  const updateSession = useUpdatePlantingMapSession(sesionId, masterId)
  const points = Number(detail?.points_count ?? 0)
  const canOpenVisor = points > 0 && detail?.import_status === 'done'

  useEffect(() => {
    if (!detail || editing) return
    setPlantingDate(detail.planting_date ?? '')
    setEstInitDate(detail.est_init_date ?? '')
    setEstFinishDate(detail.est_finish_date ?? '')
    setRealInitDate(detail.real_init_date ?? '')
    setRealFinishDate(detail.real_finish_date ?? '')
  }, [detail, editing])

  async function saveMetadata() {
    if (!plantingDate) {
      toast.error('La fecha de siembra es obligatoria.')
      return
    }
    if (realInitDate && realFinishDate && realInitDate > realFinishDate) {
      toast.error('La fecha real de inicio no puede ser posterior a la fecha real de fin.')
      return
    }
    try {
      await updateSession.mutateAsync({
        planting_date: plantingDate,
        est_init_date: estInitDate || null,
        est_finish_date: estFinishDate || null,
        real_init_date: realInitDate || null,
        real_finish_date: realFinishDate || null,
      })
      toast.success('Sesión de siembra actualizada.')
      setEditing(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo actualizar la sesión.')
    }
  }

  return (
    <>
      <SesionShell
        icon={<Sprout className="h-4 w-4 text-emerald-600" />}
        title="Sesión de Siembra"
        status={detail?.status}
        onBack={onBack}
        onClose={onClose}
      >
        {detailQuery.isLoading || !detail ? (
          <LoadingState label="Cargando sesión de siembra…" />
        ) : (
          <SesionBody>
            <SesionFicha plotId={detail.plot}>
              <FichaItem label="Fecha de siembra">{detail.planting_date ?? '—'}</FichaItem>
              <FichaImportStatus status={detail.import_status} />
              <FichaItem label="Puntos cargados">{points.toLocaleString('es-MX')}</FichaItem>
              <FichaItem label="Capas disponibles">{detail.available_layers.length}</FichaItem>
              <FichaItem label="Responsable">{detail.assigned_to?.username ?? 'Sin asignar'}</FichaItem>
            </SesionFicha>

            <DatosSesionCard
              description="Corrige las fechas de la sesión sin tocar los puntos importados."
              canEdit={canEdit}
              editing={editing}
              onEdit={() => setEditing(true)}
            >
              {editing && (
                <div className="mt-3 space-y-3">
                  <div className="space-y-1">
                    <Label htmlFor="planting-edit-date">Fecha de siembra *</Label>
                    <Input
                      id="planting-edit-date"
                      type="date"
                      value={plantingDate}
                      onChange={(event) => setPlantingDate(event.target.value)}
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <DateField label="Inicio estimado" value={estInitDate} onChange={setEstInitDate} />
                    <DateField label="Fin estimado" value={estFinishDate} onChange={setEstFinishDate} />
                    <DateField label="Inicio real" value={realInitDate} onChange={setRealInitDate} />
                    <DateField label="Fin real" value={realFinishDate} onChange={setRealFinishDate} />
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
              processingLabel="Procesando CSV de siembra…"
              mappingHint="El archivo debe incluir Longitude, Latitude y por lo menos una métrica propia de Siembra."
            />

            {stats && (
              <MetricGrid title="Resumen de la siembra">
                <Metric
                  label="Densidad promedio"
                  value={`${n(stats.numeric.density?.average)} ksds/ha`}
                />
                <Metric
                  label="Velocidad promedio"
                  value={`${n(stats.numeric.speed?.average)} km/h`}
                />
                <Metric
                  label="Productividad promedio"
                  value={`${n(stats.numeric.productivity?.average)} ha/h`}
                />
                <Metric
                  label="Superficie registrada"
                  value={`${n(stats.totals.area_ha)} ha`}
                />
              </MetricGrid>
            )}

            <div className="rounded-lg border p-4">
              <h3 className="text-sm font-semibold">Variables disponibles</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Solo aparecen las variables que realmente existen en el CSV de esta sesión.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {detail.available_layers.map((key) => (
                  <Badge key={key} variant="outline">
                    {PLANTING_LAYER_BY_KEY[key]?.label ?? key}
                  </Badge>
                ))}
              </div>
            </div>

            <SesionActions>
              {canImport && (
                <Button
                  onClick={() => setImportOpen(true)}
                  disabled={detail.import_status === 'processing'}
                >
                  {points > 0 ? 'Reimportar CSV' : 'Importar CSV'}
                </Button>
              )}
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

      {detail && importOpen && (
        <PlantingMapImportDialog
          headerId={detail.id}
          hasPoints={points > 0}
          open={importOpen}
          onOpenChange={setImportOpen}
        />
      )}

      {detail && visorOpen && (
        <PlantingMapModal
          sessionId={detail.id}
          plotId={detail.plot}
          open={visorOpen}
          onOpenChange={setVisorOpen}
        />
      )}
      {isSuperAdmin && flushOpen && (
        <FlushPlantingMapDialog
          open={flushOpen}
          onClose={() => setFlushOpen(false)}
          sessionId={sesionId}
        />
      )}
      {isSuperAdmin && (
        <DeleteLevelDialog
          open={deleteOpen}
          onClose={() => setDeleteOpen(false)}
          level="planting_map"
          onDeleted={onClose}
          id={sesionId}
        />
      )}
    </>
  )
}

function DateField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Input type="date" value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  )
}
