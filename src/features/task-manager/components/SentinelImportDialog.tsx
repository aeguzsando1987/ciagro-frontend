import { useState } from 'react'
import { toast } from 'sonner'
import { AlertTriangle, Satellite } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { GpaLoader } from '@/components/ui/gpa-loader'
import { LoadingState } from '@/components/ui/loading-state'
import {
  existingHeaderId,
  sentinelErrorMessage,
  useImportSentinel,
  useSentinelPreview,
  type SentinelAcquisition,
} from '../hooks/useNdviSentinel'

interface Props {
  headerId: string
  /** Fecha de la sesion: es el default de la busqueda, igual que el default del backend. */
  sessionDate?: string | null
  /** Puntos ya cargados. Si hay, importar los REEMPLAZA y hay que avisarlo (D5). */
  pointsCount: number
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Se llama con el header que ya tiene la adquisicion, cuando el backend responde 409 duplicado. */
  onGoToExisting?: (existingId: string) => void
}

const DIAS_DEFAULT = 7
const DIAS_MAX = 60

/** Formato local de la pasada. El instante es UTC y la hora importa: identifica la pasada. */
function fechaHora(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('es-MX', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

/**
 * La distancia en dias es el dato que justifica el flujo de dos pasos: el usuario ve que
 * la pasada mas cercana a lo que pidio puede estar a cinco dias, y decide el.
 */
function deltaLabel(delta: number): string {
  if (delta === 0) return 'el dia pedido'
  const dias = Math.abs(delta) === 1 ? '1 dia' : `${Math.abs(delta)} dias`
  return delta < 0 ? `${dias} antes` : `${dias} despues`
}

function nubeLabel(cloud: number): string {
  return `${cloud.toLocaleString('es-MX', { maximumFractionDigits: 1 })}% de nubes`
}

/**
 * Importacion automatica desde Sentinel-2 (FASE SN-F).
 *
 * SON DOS PASOS Y NO SE SIMPLIFICA A UNO. Una fecha pedida no implica que haya habido pasada
 * del satelite ese dia: la revisita es de ~5 dias y ademas hay nubes. Si el sistema eligiera
 * "la mas cercana" por su cuenta, el agronomo no veria que se descarto ni por que, y esa
 * eleccion es suya: una pasada nublada a 0 dias puede valer menos que una limpia a 5.
 *
 * Los datos caen en las MISMAS tablas que el importador CSV, asi que el visor, las
 * estadisticas y la linea de tiempo funcionan sin cambios. Lo unico que cambia es de donde
 * vinieron, y eso el modal lo muestra aparte.
 */
export function SentinelImportDialog({
  headerId,
  sessionDate,
  pointsCount,
  open,
  onOpenChange,
  onGoToExisting,
}: Props) {
  const [targetDate, setTargetDate] = useState(sessionDate ?? '')
  const [days, setDays] = useState(DIAS_DEFAULT)
  const [seleccionada, setSeleccionada] = useState<string | null>(null)
  const [duplicada, setDuplicada] = useState<string | null>(null)

  const previewMut = useSentinelPreview()
  const importMut = useImportSentinel()

  const resultados = previewMut.data?.results ?? null
  const buscoAlgo = previewMut.isSuccess || previewMut.isError

  const onBuscar = () => {
    setSeleccionada(null)
    setDuplicada(null)
    previewMut.mutate({
      headerId,
      targetDate: targetDate || undefined,
      days,
    })
  }

  const onImportar = () => {
    if (!seleccionada) return
    setDuplicada(null)
    importMut.mutate(
      { headerId, acquisitionId: seleccionada },
      {
        onSuccess: () => {
          toast.success('Importacion encolada. Los puntos y contornos se generaran en breve.')
          onOpenChange(false)
        },
        onError: (err) => {
          // El 409 de adquisicion duplicada es el unico error accionable: el backend dice
          // cual es la sesion que ya la tiene, asi que se ofrece ir a ella en vez de
          // dejar al usuario buscandola a mano.
          const existente = existingHeaderId(err)
          if (existente) setDuplicada(existente)
          toast.error(sentinelErrorMessage(err, 'No se pudo importar la adquisicion.'))
        },
      },
    )
  }

  const cerrar = (next: boolean) => {
    if (!next) {
      previewMut.reset()
      importMut.reset()
      setSeleccionada(null)
      setDuplicada(null)
    }
    onOpenChange(next)
  }

  return (
    <Dialog open={open} onOpenChange={cerrar}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Satellite className="h-4 w-4 text-sky-600" />
            Importar de satelite (Sentinel-2)
          </DialogTitle>
          <DialogDescription>
            Primero se consulta que pasadas del satelite cubren la parcela en esas fechas, y
            luego se elige una. Consultar el catalogo no consume cuota.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-end gap-2">
            <div className="flex-1 space-y-1">
              <Label htmlFor="sentinel-fecha">Fecha objetivo</Label>
              <Input
                id="sentinel-fecha"
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
              />
            </div>
            <div className="w-28 space-y-1">
              <Label htmlFor="sentinel-dias">Radio (dias)</Label>
              <Input
                id="sentinel-dias"
                type="number"
                min={0}
                max={DIAS_MAX}
                value={days}
                onChange={(e) => setDays(Math.max(0, Math.min(DIAS_MAX, Number(e.target.value))))}
              />
            </div>
            <Button type="button" variant="outline" onClick={onBuscar} disabled={previewMut.isPending}>
              {previewMut.isPending && <GpaLoader size="xs" />}
              {previewMut.isPending ? 'Buscando…' : 'Buscar'}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            El satelite pasa cada ~5 dias y no siempre sin nubes, asi que se busca en una
            ventana alrededor de la fecha, no en el dia exacto.
          </p>

          {previewMut.isPending && (
            <LoadingState
              compact
              label="Consultando el catalogo de Copernicus…"
              className="justify-start rounded-lg bg-surface-secondary"
            />
          )}

          {previewMut.isError && (
            <p className="rounded bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {sentinelErrorMessage(
                previewMut.error,
                'No se pudieron consultar las adquisiciones.',
              )}
            </p>
          )}

          {buscoAlgo && resultados !== null && resultados.length === 0 && (
            <p className="rounded bg-surface-secondary px-3 py-2 text-xs text-muted-foreground">
              No hubo pasadas del satelite sobre esta parcela en esa ventana. Prueba con un
              radio de dias mayor.
            </p>
          )}

          {resultados !== null && resultados.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium">
                {resultados.length === 1
                  ? '1 adquisicion disponible'
                  : `${resultados.length} adquisiciones disponibles`}
              </p>
              <ul className="max-h-60 space-y-1 overflow-y-auto">
                {resultados.map((a) => (
                  <li key={a.acquisition_id}>
                    <AcquisitionItem
                      acquisition={a}
                      selected={a.acquisition_id === seleccionada}
                      onSelect={() => setSeleccionada(a.acquisition_id)}
                    />
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* D5: el backend borra y reescribe los puntos dentro de una transaccion, asi que
              importar aqui destruye lo que haya, venga de CSV o de una pasada anterior. */}
          {pointsCount > 0 && resultados !== null && resultados.length > 0 && (
            <p className="flex items-start gap-2 rounded bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                Esta sesion ya tiene {pointsCount.toLocaleString('es-MX')} puntos cargados.
                Importar los <strong>reemplaza</strong> por los de la pasada elegida.
              </span>
            </p>
          )}

          {duplicada && (
            <div className="space-y-2 rounded bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <p>Otra sesion de esta parcela ya tiene esa misma pasada de Sentinel-2.</p>
              {onGoToExisting && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    onGoToExisting(duplicada)
                    cerrar(false)
                  }}
                >
                  Ver la sesion existente
                </Button>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => cerrar(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={onImportar}
            disabled={!seleccionada || importMut.isPending}
          >
            {importMut.isPending && <GpaLoader size="xs" />}
            {importMut.isPending ? 'Importando…' : 'Importar la seleccionada'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function AcquisitionItem({
  acquisition,
  selected,
  onSelect,
}: {
  acquisition: SentinelAcquisition
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`w-full rounded border px-2 py-1.5 text-left text-xs hover:bg-accent ${
        selected ? 'border-primary bg-accent font-medium' : ''
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span>{fechaHora(acquisition.datetime)}</span>
        <Badge variant={acquisition.cloud_cover <= 10 ? 'secondary' : 'outline'}>
          {nubeLabel(acquisition.cloud_cover)}
        </Badge>
      </div>
      <div className="text-[11px] text-muted-foreground">
        {deltaLabel(acquisition.delta_days)} · {acquisition.platform} ·{' '}
        {acquisition.tiles.join(', ')}
      </div>
    </button>
  )
}
