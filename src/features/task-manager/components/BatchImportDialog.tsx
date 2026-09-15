import { useState } from 'react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  MAX_FILES_PER_BATCH,
  MAX_FILE_SIZE_MB,
  useBatchImportJob,
  useCreateBatchImport,
  validateBatchSelection,
  type BatchActivityType,
} from '../hooks/useBatchImport'
import { BatchItemMessages, BatchItemStatusBadge } from './BatchItemMessages'
import { jobStatusLabel, jobStatusVariant } from '../lib/batchMessages'

/**
 * Carga por lote de sesiones desde el subprograma (FASE CL-F).
 *
 * Se eligen UN tipo de actividad y N archivos, y se genera una sesion por archivo con sus
 * puntos ya importados, en segundo plano. El avance se ve archivo por archivo.
 *
 * ES UN DIALOGO Y NO UNA RUTA porque es el patron dominante del repo: todo el detalle del
 * Task Manager vive en modales apilados y no hay una sola ruta con UUID de subprograma.
 */

interface Props {
  programaId: string
  /** Codigo de la parcela heredada. De el sale el nombre de cada sesion (BR-CL-6). */
  plotCode: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Se llama al cerrar si el lote llego a crear sesiones, para refrescar el arbol. */
  onFinished?: () => void
}

/** Un lote carga sesiones de un solo tipo (BR-CL-2). Suelo y fitosanitario no aplican. */
const ACTIVITY_OPTIONS: { value: BatchActivityType; label: string }[] = [
  { value: 'aspersion', label: 'Aspersion' },
  { value: 'ndvi', label: 'NDVI' },
  { value: 'yield_map', label: 'Rendimiento' },
]

export function BatchImportDialog({
  programaId,
  plotCode,
  open,
  onOpenChange,
  onFinished,
}: Props) {
  const [activityType, setActivityType] = useState<BatchActivityType>('aspersion')
  const [files, setFiles] = useState<File[]>([])
  const [jobId, setJobId] = useState<string | null>(null)

  const createMut = useCreateBatchImport()
  const { data: job } = useBatchImportJob(jobId)

  const enviado = jobId !== null
  const errorSeleccion = files.length > 0 ? validateBatchSelection(files) : null

  const onSubmit = () => {
    createMut.mutate(
      { programaId, activityType, files },
      {
        onSuccess: (res) => {
          setJobId(res.job_id)
          if (res.accepted > 0) {
            toast.success(
              `${res.accepted} archivo(s) en proceso. El avance se actualiza solo.`,
            )
          }
          if (res.rejected > 0) {
            toast.warning(`${res.rejected} archivo(s) no cumplieron el contrato.`)
          }
        },
        // LA SELECCION NO SE LIMPIA AL FALLAR. El refreshMiddleware del cliente solo
        // reintenta GET, nunca un POST (client.ts:74-101): si el token caduca durante la
        // subida de un lote grande, el POST muere sin reintento. Conservar los archivos
        // deja al usuario reintentar sin volver a elegirlos uno por uno.
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : 'No se pudo crear el lote.')
        },
      },
    )
  }

  const onClose = (next: boolean) => {
    if (!next) {
      // El polling vive con el dialogo. Al cerrar se avisa al padre para que invalide el
      // arbol: las sesiones ya creadas tienen que aparecer ahi aunque el lote siga.
      if (jobId) onFinished?.()
      setFiles([])
      setJobId(null)
      createMut.reset()
    }
    onOpenChange(next)
  }

  const resumen = job?.summary

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Cargar lote de sesiones</DialogTitle>
          <DialogDescription>
            Se crea una sesion por archivo, con sus puntos ya importados. Las fechas y el
            nombre de cada sesion salen del propio archivo.
            {plotCode && <> Parcela: <strong>{plotCode}</strong>.</>}
          </DialogDescription>
        </DialogHeader>

        {!enviado && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="batch-activity">Tipo de actividad</Label>
              <Select
                value={activityType}
                onValueChange={(v) => setActivityType(v as BatchActivityType)}
              >
                <SelectTrigger id="batch-activity">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACTIVITY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted">
                Todo el lote debe ser del mismo tipo. Para cargar otro tipo, haz un lote aparte.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="batch-files">Archivos CSV</Label>
              <Input
                id="batch-files"
                type="file"
                accept=".csv,.txt"
                multiple
                onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
              />
              <p className="text-xs text-muted">
                Hasta {MAX_FILES_PER_BATCH} archivos, {MAX_FILE_SIZE_MB} MB cada uno.
              </p>
              {files.length > 0 && !errorSeleccion && (
                <p className="text-xs text-secondary">
                  {files.length} archivo(s) seleccionado(s).
                </p>
              )}
              {errorSeleccion && <p className="text-xs text-danger">{errorSeleccion}</p>}
            </div>
          </div>
        )}

        {enviado && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              {job && <Badge variant={jobStatusVariant(job.status)}>{jobStatusLabel(job.status)}</Badge>}
              {resumen && (
                <span className="text-sm text-secondary">
                  {resumen.done} de {resumen.total} listas
                  {resumen.rejected > 0 && ` · ${resumen.rejected} rechazadas`}
                  {resumen.error > 0 && ` · ${resumen.error} con error`}
                </span>
              )}
            </div>

            <div className="max-h-80 space-y-2 overflow-y-auto">
              {(job?.items ?? []).map((item) => (
                <div key={item.id} className="rounded border border-default p-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{item.filename}</p>
                      {item.session_name && (
                        <p className="truncate text-xs text-muted">{item.session_name}</p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {item.points_count !== null && (
                        <span className="text-xs text-muted">
                          {item.points_count.toLocaleString('es-MX')} puntos
                        </span>
                      )}
                      <BatchItemStatusBadge item={item} />
                    </div>
                  </div>
                  <BatchItemMessages item={item} />
                </div>
              ))}
            </div>
          </div>
        )}

        <DialogFooter>
          {!enviado ? (
            <>
              <Button variant="outline" onClick={() => onClose(false)}>
                Cancelar
              </Button>
              <Button
                onClick={onSubmit}
                disabled={files.length === 0 || !!errorSeleccion || createMut.isPending}
              >
                {createMut.isPending ? 'Enviando...' : 'Cargar lote'}
              </Button>
            </>
          ) : (
            <Button onClick={() => onClose(false)}>Cerrar</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
