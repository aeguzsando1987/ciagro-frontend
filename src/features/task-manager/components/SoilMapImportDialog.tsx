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
import { GpaLoader } from '@/components/ui/gpa-loader'
import { LoadingState } from '@/components/ui/loading-state'
import {
  useImportSoilMapData,
  usePreviewSoilMapColumns,
  type SoilMapPreviewResult,
} from '../hooks/useSoilMapImport'

interface SoilMapImportDialogProps {
  headerId: string
  importStatus?: string
  importErrors?: unknown
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SoilMapImportDialog({
  headerId,
  importStatus,
  importErrors,
  open,
  onOpenChange,
}: SoilMapImportDialogProps) {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<SoilMapPreviewResult | null>(null)
  const [elevationUnit, setElevationUnit] = useState<'' | 'ft' | 'm'>('')
  const [previewError, setPreviewError] = useState<string | null>(null)
  const previewRequest = useRef(0)
  const previewMutation = usePreviewSoilMapColumns()
  const importMutation = useImportSoilMapData()
  const isProcessing = importStatus === 'processing'

  function resetState() {
    setFile(null)
    setPreview(null)
    setElevationUnit('')
    setPreviewError(null)
    previewRequest.current += 1
  }

  function handleClose() {
    resetState()
    onOpenChange(false)
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.target.files?.[0] ?? null
    setFile(selectedFile)
    await updatePreview(selectedFile, elevationUnit)
  }

  async function updatePreview(selectedFile: File | null, unit: '' | 'ft' | 'm') {
    const requestId = ++previewRequest.current
    setPreview(null)
    setPreviewError(null)
    if (!selectedFile) return

    try {
      const result = await previewMutation.mutateAsync({
        headerId,
        file: selectedFile,
        ...(unit ? { elevationUnit: unit } : {}),
      })
      if (requestId === previewRequest.current) setPreview(result)
    } catch (error) {
      if (requestId !== previewRequest.current) return
      const message =
        error && typeof error === 'object' && 'detail' in error
          ? String(error.detail)
          : 'No se pudo leer el CSV. Revisa sus columnas y la unidad de elevación.'
      setPreviewError(message)
      toast.error(message)
    }
  }

  async function handleImport() {
    if (!file || !preview) return

    try {
      await importMutation.mutateAsync({
        headerId,
        file,
        ...(elevationUnit ? { elevationUnit } : {}),
      })
      toast.success('Importación encolada. El estado se actualizará automáticamente.')
      handleClose()
    } catch {
      toast.error('No se pudo iniciar la importación.')
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => (nextOpen ? onOpenChange(true) : handleClose())}
    >
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Importar datos de mapeo de suelo</DialogTitle>
        </DialogHeader>

        {isProcessing ? (
          <div className="space-y-2 py-4 text-sm">
            <LoadingState
              compact
              label="Importación en curso: procesando datos de suelo…"
              className="justify-start rounded-lg border border-info/20 bg-info-soft text-info-foreground"
            />
            <div className="flex flex-wrap items-center gap-1 text-muted-foreground">
              El estado actual es <Badge variant="outline">{importStatus}</Badge>. Puedes cerrar
              esta ventana; el detalle se actualizará automáticamente.
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {importStatus === 'error' && (
              <div className="rounded border border-destructive/40 bg-destructive/5 p-2 text-xs text-destructive">
                <p className="font-medium">La última importación falló.</p>
                {!!importErrors && (
                  <pre className="mt-1 max-h-24 overflow-auto whitespace-pre-wrap">
                    {JSON.stringify(importErrors, null, 2)}
                  </pre>
                )}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="soil-map-file">Archivo CSV</Label>
              <Input
                id="soil-map-file"
                type="file"
                accept=".csv,.txt"
                onChange={handleFileChange}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="soil-elevation-unit">Unidad de elevación del CSV</Label>
              <select
                id="soil-elevation-unit"
                value={elevationUnit}
                className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                onChange={(event) => {
                  const unit = event.target.value as '' | 'ft' | 'm'
                  setElevationUnit(unit)
                  void updatePreview(file, unit)
                }}
              >
                <option value="">Según encabezado (sin unidad: pies)</option>
                <option value="ft">Pies (ft)</option>
                <option value="m">Metros (m)</option>
              </select>
              <p className="text-[11px] text-muted-foreground">
                La elevación se guardará y mostrará en metros. Los datos en pies se convierten al
                importar.
              </p>
              {preview?.elevation_source_unit && (
                <p className="text-xs">
                  Elevación detectada:{' '}
                  {preview.elevation_source_unit === 'ft'
                    ? 'pies (ft) → metros (m)'
                    : 'metros (m), sin conversión'}
                  .
                </p>
              )}
              {previewError && (
                <p role="alert" className="text-xs text-destructive">
                  {previewError}
                </p>
              )}
            </div>

            {previewMutation.isPending && (
              <LoadingState
                compact
                label="Analizando columnas…"
                className="justify-start rounded-lg bg-surface-secondary"
              />
            )}

            {preview && (
              <div className="space-y-3">
                <div>
                  <p className="mb-1 text-xs font-medium text-green-700">
                    Columnas reconocidas ({preview.matched.length})
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {preview.matched.length === 0 ? (
                      <span className="text-xs text-muted-foreground">Ninguna</span>
                    ) : (
                      preview.matched.map((field) => (
                        <Badge key={field} variant="secondary" className="text-[10px]">
                          {field} ← {preview.col_map[field]}
                        </Badge>
                      ))
                    )}
                  </div>
                </div>

                {preview.unmatched.length > 0 && (
                  <div>
                    <p className="mb-1 text-xs font-medium text-amber-700">
                      Columnas no reconocidas ({preview.unmatched.length})
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {preview.unmatched.map((header) => (
                        <Badge key={header} variant="outline" className="text-[10px]">
                          {header}
                        </Badge>
                      ))}
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Estas columnas se ignorarán durante la importación.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            {isProcessing ? 'Cerrar' : 'Cancelar'}
          </Button>
          {!isProcessing && (
            <Button
              onClick={handleImport}
              disabled={!file || !preview || previewMutation.isPending || importMutation.isPending}
            >
              {importMutation.isPending && <GpaLoader size="xs" />}
              {importMutation.isPending ? 'Importando…' : 'Importar'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
