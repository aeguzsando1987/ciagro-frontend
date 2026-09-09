import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { LoadingState } from '@/components/ui/loading-state'
import { GpaLoader } from '@/components/ui/gpa-loader'
import { YieldApiError } from '../api'
import {
  useImportYieldMapData,
  usePreviewYieldMapColumns,
  type YieldMapPreviewResult,
} from '../hooks/useYieldMapImport'

interface Props {
  headerId: string
  importStatus?: string
  importErrors?: unknown
  open: boolean
  onOpenChange: (open: boolean) => void
}

const QUICK_LABELS: Record<string, string> = {
  yield_t_ha: 'Rendimiento',
  moisture_pct: 'Humedad',
  speed_kmh: 'Velocidad',
  grain_flow_t_h: 'Producción / flujo',
  elevation_m: 'Elevación',
}

export function YieldMapImportDialog({ headerId, importStatus, importErrors, open, onOpenChange }: Props) {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<YieldMapPreviewResult | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const requestCounter = useRef(0)
  const previewMutation = usePreviewYieldMapColumns()
  const importMutation = useImportYieldMapData()
  const isProcessing = importStatus === 'processing'

  function reset() {
    setFile(null)
    setPreview(null)
    setPreviewError(null)
    requestCounter.current += 1
  }

  function close() {
    reset()
    onOpenChange(false)
  }

  async function analyze(selected: File | null) {
    const requestId = ++requestCounter.current
    setPreview(null)
    setPreviewError(null)
    if (!selected) return
    try {
      const result = await previewMutation.mutateAsync({ headerId, file: selected })
      if (requestId === requestCounter.current) setPreview(result)
    } catch (error) {
      if (requestId !== requestCounter.current) return
      const message = error instanceof YieldApiError
        ? error.message
        : 'No se pudo validar el archivo de rendimiento.'
      setPreviewError(message)
      toast.error(message)
    }
  }

  async function handleImport() {
    if (!file || !preview) return
    try {
      await importMutation.mutateAsync({ headerId, file })
      toast.success('CSV de rendimiento encolado. El estado se actualizará automáticamente.')
      close()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo iniciar la importación.')
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Importar mapa de rendimiento</DialogTitle>
        </DialogHeader>

        {isProcessing ? (
          <LoadingState compact label="Procesando lecturas de cosecha…" className="justify-start rounded-lg border bg-muted/30" />
        ) : (
          <div className="space-y-4">
            <div className="rounded-md border border-emerald-200 bg-emerald-50/70 p-3 text-xs text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100">
              El archivo debe contener coordenadas y masa de rendimiento seca o húmeda (t/ha). Un CSV de aplicación sin rendimiento será rechazado antes de importarlo.
            </div>

            {importStatus === 'error' && !!importErrors && (
              <div className="rounded border border-destructive/40 bg-destructive/5 p-2 text-xs text-destructive">
                <p className="font-medium">La última importación falló.</p>
                <pre className="mt-1 max-h-24 overflow-auto whitespace-pre-wrap">{JSON.stringify(importErrors, null, 2)}</pre>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="yield-map-file">Archivo CSV del monitor de cosecha</Label>
              <Input
                id="yield-map-file"
                type="file"
                accept=".csv,.txt"
                onChange={(event) => {
                  const selected = event.target.files?.[0] ?? null
                  setFile(selected)
                  void analyze(selected)
                }}
              />
            </div>

            {previewMutation.isPending && <LoadingState compact label="Validando columnas de rendimiento…" />}
            {previewError && <p role="alert" className="text-xs text-destructive">{previewError}</p>}

            {preview && (
              <div className="space-y-3 rounded-lg border p-3">
                <div>
                  <p className="text-xs font-semibold text-emerald-700">Archivo válido para Rendimiento</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {preview.quick_views.map((key) => (
                      <Badge key={key} variant="secondary" className="text-[10px]">
                        {QUICK_LABELS[key] ?? key}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-1 text-xs font-medium">Columnas reconocidas ({preview.matched.length})</p>
                  <div className="flex flex-wrap gap-1">
                    {preview.matched.map((field) => (
                      <Badge key={field} variant="outline" className="text-[10px]">
                        {field} ← {preview.col_map[field]}
                      </Badge>
                    ))}
                  </div>
                </div>
                {preview.unmatched.length > 0 && (
                  <p className="text-[11px] text-muted-foreground">
                    {preview.unmatched.length} columnas adicionales se conservarán como datos de origen cuando aplique.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={close}>{isProcessing ? 'Cerrar' : 'Cancelar'}</Button>
          {!isProcessing && (
            <Button onClick={handleImport} disabled={!file || !preview || importMutation.isPending || previewMutation.isPending}>
              {importMutation.isPending && <GpaLoader size="xs" />}
              {importMutation.isPending ? 'Importando…' : 'Importar rendimiento'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
