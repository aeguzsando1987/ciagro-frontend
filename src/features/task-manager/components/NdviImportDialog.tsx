import { useState } from 'react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { GpaLoader } from '@/components/ui/gpa-loader'
import { LoadingState } from '@/components/ui/loading-state'
import {
  usePreviewNdviColumns,
  useImportNdviData,
  type NdviPreviewResult,
} from '../hooks/useNdviImport'

interface Props {
  headerId: string
  importStatus?: string
  importErrors?: unknown
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Importa el CSV de una sesión NDVI. El mapeo de columnas es AUTOMÁTICO en el backend
 * (reconoce nombres con acentos), así que no hay plantillas ni mapeo manual: solo se elige
 * el archivo, opcionalmente se previsualizan las columnas reconocidas, y se importa.
 */
export function NdviImportDialog({
  headerId,
  importStatus,
  importErrors,
  open,
  onOpenChange,
}: Props) {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<NdviPreviewResult | null>(null)

  const previewMut = usePreviewNdviColumns()
  const importMut = useImportNdviData()

  const processing = importStatus === 'processing'

  const onPreview = () => {
    if (!file) return
    previewMut.mutate(
      { headerId, file },
      {
        onSuccess: (res) => setPreview(res),
        onError: () => toast.error('No se pudo previsualizar el CSV.'),
      }
    )
  }

  const onImport = () => {
    if (!file) return
    importMut.mutate(
      { headerId, file },
      {
        onSuccess: () => {
          toast.success('Importación encolada. Los puntos y contornos se generarán en breve.')
          onOpenChange(false)
        },
        onError: () => toast.error('No se pudo importar el CSV.'),
      }
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Importar CSV de NDVI</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="ndvi-csv">Archivo CSV</Label>
            <Input
              id="ndvi-csv"
              type="file"
              accept=".csv,.txt"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null)
                setPreview(null)
              }}
            />
            <p className="text-xs text-muted-foreground">
              El mapeo de columnas es automático (reconoce nombres con acentos como &quot;Índice de
              suelo desnudo&quot;). Solo Longitude y Latitude son obligatorias.
            </p>
          </div>

          {preview && (
            <div className="rounded border p-2 text-xs">
              <p className="mb-1 font-medium">Columnas reconocidas: {preview.matched.length}</p>
              {preview.unmatched.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  <span className="text-muted-foreground">Sin reconocer:</span>
                  {preview.unmatched.map((c) => (
                    <Badge key={c} variant="outline">
                      {c}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-green-600">Todas las columnas fueron reconocidas.</p>
              )}
            </div>
          )}

          {importStatus === 'pending_mapping' && (
            <p className="rounded bg-amber-50 px-3 py-2 text-xs text-amber-800">
              La última importación quedó pendiente de mapeo: faltan columnas obligatorias
              (Longitude / Latitude). Revisa el archivo.
            </p>
          )}
          {importStatus === 'error' && (
            <p className="rounded bg-destructive/10 px-3 py-2 text-xs text-destructive">
              La última importación falló. {typeof importErrors === 'string' ? importErrors : ''}
            </p>
          )}
          {processing && (
            <LoadingState
              compact
              label="Importación en curso: procesando datos NDVI…"
              className="justify-start rounded-lg border border-info/20 bg-info-soft text-info-foreground"
            />
          )}
          {previewMut.isPending && (
            <LoadingState
              compact
              label="Previsualizando columnas…"
              className="justify-start rounded-lg bg-surface-secondary"
            />
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onPreview}
            disabled={!file || previewMut.isPending}
          >
            {previewMut.isPending && <GpaLoader size="xs" />}
            {previewMut.isPending ? 'Previsualizando…' : 'Previsualizar'}
          </Button>
          <Button
            type="button"
            onClick={onImport}
            disabled={!file || importMut.isPending || processing}
          >
            {importMut.isPending && <GpaLoader size="xs" />}
            {importMut.isPending ? 'Importando…' : 'Importar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
