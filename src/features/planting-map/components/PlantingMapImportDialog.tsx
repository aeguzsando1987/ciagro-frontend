import { useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { LoadingState } from '@/components/ui/loading-state'
import { PlantingApiError } from '../api'
import {
  useImportPlantingData,
  usePreviewPlantingColumns,
} from '../hooks/usePlantingMapImport'
import type { PlantingPreviewResult } from '../types'
import { PLANTING_LAYER_BY_KEY } from '../lib/plantingMapLayers'

interface Props {
  headerId: string
  hasPoints: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function PlantingMapImportDialog({
  headerId,
  hasPoints,
  open,
  onOpenChange,
}: Props) {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<PlantingPreviewResult | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const requestId = useRef(0)
  const previewMutation = usePreviewPlantingColumns()
  const importMutation = useImportPlantingData()

  function reset() {
    requestId.current += 1
    setFile(null)
    setPreview(null)
    setPreviewError(null)
  }

  function close() {
    reset()
    onOpenChange(false)
  }

  async function analyze(selected: File | null) {
    const id = ++requestId.current
    setPreview(null)
    setPreviewError(null)
    if (!selected) return

    try {
      const result = await previewMutation.mutateAsync({ headerId, file: selected })
      if (id !== requestId.current) return
      setPreview(result)
      if (!result.valid) setPreviewError(result.detail)
    } catch (error) {
      if (id !== requestId.current) return
      const message =
        error instanceof PlantingApiError
          ? error.message
          : 'No se pudo validar el archivo de siembra.'
      setPreviewError(message)
      toast.error(message)
    }
  }

  async function handleImport() {
    if (!file || !preview?.valid) return
    try {
      const result = await importMutation.mutateAsync({
        headerId,
        file,
        replace: hasPoints,
      })
      toast.success(
        `Siembra importada: ${result.imported_rows.toLocaleString('es-MX')} puntos.`,
      )
      close()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'No se pudo importar el CSV de siembra.',
      )
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{hasPoints ? 'Reimportar mapa de siembra' : 'Importar mapa de siembra'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-md border border-emerald-200 bg-emerald-50/70 p-3 text-xs text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100">
            El archivo debe incluir Longitude y Latitude, además de por lo menos una señal real
            de siembra. No se exige un número fijo de columnas; las adicionales se conservan.
          </div>

          {hasPoints && (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
              Esta sesión ya tiene lecturas. Al confirmar se reemplazarán por el contenido del
              nuevo CSV para evitar duplicados.
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="planting-map-file">Archivo CSV del monitor de siembra</Label>
            <Input
              id="planting-map-file"
              type="file"
              accept=".csv,.txt"
              onChange={(event) => {
                const selected = event.target.files?.[0] ?? null
                setFile(selected)
                void analyze(selected)
              }}
            />
          </div>

          {previewMutation.isPending && (
            <LoadingState compact label="Validando estructura del CSV…" />
          )}

          {previewError && (
            <p role="alert" className="rounded-md bg-destructive/5 p-2 text-xs text-destructive">
              {previewError}
            </p>
          )}

          {preview?.valid && (
            <div className="space-y-3 rounded-lg border p-3">
              <div>
                <p className="text-xs font-semibold text-emerald-700">
                  CSV válido para Siembra · {preview.row_count.toLocaleString('es-MX')} filas
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Perfil detectado:{' '}
                  {preview.planting_mode === 'mass'
                    ? 'Siembra por masa (kg/ha)'
                    : preview.planting_mode === 'count'
                      ? 'Siembra por conteo de semillas'
                      : 'Telemetría de siembra'}
                </p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {preview.available_layers.map((key) => (
                    <Badge key={key} variant="secondary" className="text-[10px]">
                      {PLANTING_LAYER_BY_KEY[key]?.label ?? key}
                    </Badge>
                  ))}
                </div>
              </div>

              <p className="text-[11px] text-muted-foreground">
                {preview.raw_columns.length} columnas · {preview.recognized_columns.length} reconocidas
                {preview.unknown_columns.length
                  ? ` · ${preview.unknown_columns.length} adicionales preservadas`
                  : ''}
              </p>

              {preview.duplicate_columns.length > 0 && (
                <p className="text-[11px] text-muted-foreground">
                  Duplicadas detectadas:{' '}
                  {preview.duplicate_columns
                    .map((item) => `${item.name} ×${item.count}`)
                    .join(', ')}
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={close}>Cancelar</Button>
          <Button
            onClick={() => void handleImport()}
            disabled={!file || !preview?.valid || previewMutation.isPending || importMutation.isPending}
          >
            {importMutation.isPending
              ? 'Importando…'
              : hasPoints
                ? 'Reemplazar datos'
                : 'Importar siembra'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
