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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ASPERSION_FIELDS } from '../lib/aspersionFields'
import {
  usePreviewColumns,
  useImportAspersionData,
  useAspersionTemplates,
  useCreateAspersionTemplate,
  type PreviewResult,
  type ColumnMapping,
} from '../hooks/useAspersionImport'

interface Props {
  headerId: string
  /** import_status del header (proviene del detalle con polling en el padre). */
  importStatus?: string
  importErrors?: unknown
  open: boolean
  onOpenChange: (open: boolean) => void
}

const NONE = '__none__'

export function AspersionImportDialog({
  headerId,
  importStatus,
  importErrors,
  open,
  onOpenChange,
}: Props) {
  const [file, setFile] = useState<File | null>(null)
  const [templateId, setTemplateId] = useState<string | undefined>(undefined)
  const [preview, setPreview] = useState<PreviewResult | null>(null)
  // Remapeos manuales: encabezado CSV no reconocido → campo del modelo.
  const [remap, setRemap] = useState<Record<string, string>>({})
  const [saveAsTemplate, setSaveAsTemplate] = useState(false)
  const [tmplName, setTmplName] = useState('')
  const [tmplCode, setTmplCode] = useState('')

  const { data: templates = [] } = useAspersionTemplates()
  const previewMut = usePreviewColumns()
  const importMut = useImportAspersionData()
  const createTmpl = useCreateAspersionTemplate()

  // 'pending' es el estado inicial "Sin importar" (idle), no una importación en curso.
  // Solo 'processing' significa que el worker está procesando el archivo.
  const isProcessing = importStatus === 'processing'

  function resetState() {
    setFile(null)
    setTemplateId(undefined)
    setPreview(null)
    setRemap({})
    setSaveAsTemplate(false)
    setTmplName('')
    setTmplCode('')
  }

  function handleClose() {
    resetState()
    onOpenChange(false)
  }

  async function runPreview(selectedFile: File, tmpl?: string) {
    try {
      const result = await previewMut.mutateAsync({ headerId, file: selectedFile, templateId: tmpl })
      setPreview(result)
      setRemap({})
    } catch {
      toast.error('No se pudo leer el archivo. Verifica que sea un CSV válido.')
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null
    setFile(f)
    setPreview(null)
    if (f) void runPreview(f, templateId)
  }

  function handleTemplateChange(value: string) {
    const id = value === NONE ? undefined : value
    setTemplateId(id)
    if (file) void runPreview(file, id)
  }

  /** Construye column_mapping {campo: [encabezado_lower]} desde los remapeos manuales. */
  function buildColumnMapping(): ColumnMapping {
    const mapping: ColumnMapping = {}
    for (const [header, field] of Object.entries(remap)) {
      if (!field) continue
      mapping[field] = [header.trim().toLowerCase()]
    }
    return mapping
  }

  const hasManualRemap = Object.values(remap).some(Boolean)

  async function handleImport() {
    if (!file) return
    let effectiveTemplateId = templateId

    // Si hay remapeos manuales, deben persistirse como plantilla (el import solo
    // acepta template_id, no un mapeo ad-hoc).
    if (hasManualRemap) {
      if (!saveAsTemplate) {
        toast.error('Marcaste columnas para remapear: activa "Guardar como plantilla" para aplicarlas.')
        return
      }
      if (!tmplName.trim() || !tmplCode.trim()) {
        toast.error('Indica nombre y código de la plantilla.')
        return
      }
      try {
        const created = await createTmpl.mutateAsync({
          code: tmplCode.trim(),
          name: tmplName.trim(),
          column_mapping: buildColumnMapping(),
        })
        effectiveTemplateId = created.id
      } catch {
        toast.error('No se pudo guardar la plantilla.')
        return
      }
    }

    try {
      await importMut.mutateAsync({ headerId, file, templateId: effectiveTemplateId })
      toast.success('Importación encolada. El estado se actualizará automáticamente.')
      handleClose()
    } catch {
      toast.error('No se pudo iniciar la importación.')
    }
  }

  const usedFields = new Set(Object.values(remap).filter(Boolean))

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : handleClose())}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar datos de aspersión</DialogTitle>
        </DialogHeader>

        {isProcessing ? (
          <div className="space-y-2 py-4 text-sm">
            <p className="font-medium">Importación en curso…</p>
            <p className="text-muted-foreground">
              El estado actual es{' '}
              <Badge variant="outline">{importStatus}</Badge>. Esta ventana puede cerrarse;
              el avance se refleja en el detalle de la sesión.
            </p>
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

            {/* Archivo + plantilla */}
            <div className="space-y-1.5">
              <Label htmlFor="asp-file">Archivo CSV</Label>
              <Input id="asp-file" type="file" accept=".csv,.txt" onChange={handleFileChange} />
            </div>

            <div className="space-y-1.5">
              <Label>Plantilla (opcional)</Label>
              <Select value={templateId ?? NONE} onValueChange={handleTemplateChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Sin plantilla" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Sin plantilla</SelectItem>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {previewMut.isPending && (
              <p className="text-sm text-muted-foreground">Analizando columnas…</p>
            )}

            {/* Preview */}
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
                      preview.matched.map((f) => (
                        <Badge key={f} variant="secondary" className="text-[10px]">
                          {f} ← {preview.col_map[f]}
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
                    <p className="mb-2 text-[11px] text-muted-foreground">
                      Asigna manualmente las que quieras importar; las que dejes en blanco se ignoran.
                    </p>
                    <div className="space-y-1.5">
                      {preview.unmatched.map((header) => (
                        <div key={header} className="flex items-center gap-2">
                          <span className="min-w-0 flex-1 truncate text-xs" title={header}>
                            {header}
                          </span>
                          <span className="text-muted-foreground">→</span>
                          <Select
                            value={remap[header] ?? NONE}
                            onValueChange={(v) =>
                              setRemap((prev) => ({ ...prev, [header]: v === NONE ? '' : v }))
                            }
                          >
                            <SelectTrigger className="h-8 w-48 text-xs">
                              <SelectValue placeholder="Ignorar" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={NONE}>Ignorar</SelectItem>
                              {ASPERSION_FIELDS.filter(
                                (af) => !usedFields.has(af.field) || remap[header] === af.field,
                              ).map((af) => (
                                <SelectItem key={af.field} value={af.field}>
                                  {af.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Guardar plantilla (requerido si hay remapeo manual) */}
                {hasManualRemap && (
                  <div className="space-y-2 rounded border bg-muted/30 p-2">
                    <label className="flex items-center gap-2 text-xs font-medium">
                      <input
                        type="checkbox"
                        checked={saveAsTemplate}
                        onChange={(e) => setSaveAsTemplate(e.target.checked)}
                      />
                      Guardar como plantilla reutilizable
                    </label>
                    {saveAsTemplate && (
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          placeholder="Nombre"
                          value={tmplName}
                          onChange={(e) => setTmplName(e.target.value)}
                        />
                        <Input
                          placeholder="Código"
                          value={tmplCode}
                          onChange={(e) => setTmplCode(e.target.value)}
                        />
                      </div>
                    )}
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
              disabled={!file || importMut.isPending || createTmpl.isPending}
            >
              {importMut.isPending || createTmpl.isPending ? 'Importando…' : 'Importar'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
