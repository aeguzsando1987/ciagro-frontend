import { useState, useRef } from 'react'
import { toast } from 'sonner'
import { Plus, Trash2, Upload, X, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useImportPlotVertices } from '../hooks/usePlots'
import type { PlotVertexInput } from '../types'

// ── Homologador de columnas ────────────────────────────────────────────────────
// Mapea variantes de nombres (español / inglés / abreviaturas) a nombre canónico.
const COL_ALIASES: Record<string, 'latitude' | 'longitude' | 'level'> = {
  // latitud
  lat: 'latitude', latitud: 'latitude', latitude: 'latitude',
  // longitud
  lon: 'longitude', lng: 'longitude', longitud: 'longitude', longitude: 'longitude',
  // orden / nivel (opcional)
  level: 'level', nivel: 'level', orden: 'level', order: 'level', seq: 'level',
}

function detectDelimiter(line: string): string {
  const counts: Record<string, number> = { ',': 0, ';': 0, '\t': 0 }
  for (const ch of line) if (ch in counts) counts[ch] = (counts[ch] ?? 0) + 1
  // Si hay empate, preferir coma
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? ','
}

/** Normaliza un encabezado: elimina BOM, espacios y pasa a minúsculas. */
function cleanHeader(h: string): string {
  return h.replace(/^﻿/, '').trim().toLowerCase()
}

/** Normaliza un valor decimal: admite coma como separador (p.ej. exportaciones Excel ES). */
function parseCoord(raw: string | undefined): number {
  return parseFloat((raw ?? '').trim().replace(',', '.'))
}

type ParseOk = { ok: true; rows: PlotVertexInput[]; detected: string[] }
type ParseErr = { ok: false; error: string; detected: string[] }
type ParseResult = ParseOk | ParseErr

function parseCSV(text: string): ParseResult {
  const lines = text.replace(/\r/g, '').split('\n').filter((l) => l.trim())
  if (lines.length < 2) {
    return { ok: false, error: 'El archivo está vacío o solo tiene encabezados.', detected: [] }
  }

  const firstLine = lines[0] ?? ''
  const delim = detectDelimiter(firstLine)
  const rawHeaders = firstLine.split(delim)
  const detected = rawHeaders.map((h) => h.trim().replace(/^﻿/, ''))

  // Construir mapa: nombre canónico → índice de columna
  const colMap: Partial<Record<'latitude' | 'longitude' | 'level', number>> = {}
  rawHeaders.forEach((h, i) => {
    const canonical = COL_ALIASES[cleanHeader(h)]
    if (canonical && colMap[canonical] === undefined) colMap[canonical] = i
  })

  if (colMap.latitude === undefined) {
    return {
      ok: false,
      detected,
      error:
        `Columna de latitud no encontrada.\n` +
        `Columnas detectadas: ${detected.join(', ')}\n` +
        `Renombra la columna a: lat  o  latitude  o  latitud`,
    }
  }
  if (colMap.longitude === undefined) {
    return {
      ok: false,
      detected,
      error:
        `Columna de longitud no encontrada.\n` +
        `Columnas detectadas: ${detected.join(', ')}\n` +
        `Renombra la columna a: lon  o  longitude  o  longitud`,
    }
  }

  const rows: PlotVertexInput[] = []
  const errors: string[] = []

  lines.slice(1).forEach((line, i) => {
    const cells = line.split(delim)
    const lat = parseCoord(cells[colMap.latitude!])
    const lon = parseCoord(cells[colMap.longitude!])
    const levelRaw = colMap.level !== undefined ? cells[colMap.level]?.trim() : ''

    if (isNaN(lat) || isNaN(lon)) {
      errors.push(`Fila ${i + 2}: lat="${cells[colMap.latitude!]?.trim()}", lon="${cells[colMap.longitude!]?.trim()}"`)
      return
    }
    rows.push({ latitude: lat, longitude: lon, level: levelRaw ? parseInt(levelRaw, 10) || i : i })
  })

  if (errors.length > 0) {
    const sample = errors.slice(0, 3).join('\n')
    const extra = errors.length > 3 ? `\n…y ${errors.length - 3} filas más` : ''
    return { ok: false, detected, error: `Filas con datos inválidos:\n${sample}${extra}` }
  }

  if (rows.length < 3) {
    return {
      ok: false,
      detected,
      error: `Se necesitan al menos 3 vértices. El archivo tiene ${rows.length}.`,
    }
  }

  return { ok: true, rows, detected }
}

// ── Componente ─────────────────────────────────────────────────────────────────

interface VertexRow extends PlotVertexInput {
  _key: number
}

interface Props {
  plotId: string
  onSuccess?: () => void
}

let _keyCounter = 0
function makeRow(lat = '', lon = ''): VertexRow {
  return { _key: ++_keyCounter, latitude: Number(lat) || 0, longitude: Number(lon) || 0 }
}

type CsvPreview = { rows: PlotVertexInput[]; detected: string[] }

export function PlotVerticesImport({ plotId, onSuccess }: Props) {
  // ── Entrada manual ──
  const [rows, setRows] = useState<VertexRow[]>([makeRow(), makeRow(), makeRow()])

  // ── CSV ──
  const [csvPreview, setCsvPreview] = useState<CsvPreview | null>(null)
  const [csvError, setCsvError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const importMutation = useImportPlotVertices()

  // ── Handlers entrada manual ──────────────────────────────────────────────────

  function addRow() { setRows((p) => [...p, makeRow()]) }

  function removeRow(key: number) { setRows((p) => p.filter((r) => r._key !== key)) }

  function updateRow(key: number, field: 'latitude' | 'longitude', value: string) {
    setRows((p) =>
      p.map((r) => (r._key === key ? { ...r, [field]: Number(value) || 0 } : r))
    )
  }

  async function handleImportManual() {
    if (rows.length < 3) { toast.error('Se requieren al menos 3 vértices.'); return }
    const vertices: PlotVertexInput[] = rows.map((r, i) => ({
      level: i, latitude: r.latitude, longitude: r.longitude,
    }))
    try {
      await importMutation.mutateAsync({ plotId, vertices })
      toast.success('Vértices importados. Área y centroide recalculados.')
      onSuccess?.()
    } catch {
      toast.error('No se pudieron importar los vértices.')
    }
  }

  // ── Handlers CSV ─────────────────────────────────────────────────────────────

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = '' // permite re-seleccionar el mismo archivo

    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      const result = parseCSV(text)
      if (result.ok) {
        setCsvPreview({ rows: result.rows, detected: result.detected })
        setCsvError(null)
      } else {
        setCsvError(result.error)
        setCsvPreview(null)
      }
    }
    reader.readAsText(file, 'utf-8')
  }

  function cancelCsv() {
    setCsvPreview(null)
    setCsvError(null)
  }

  async function handleImportFromCsv() {
    if (!csvPreview) return
    try {
      await importMutation.mutateAsync({ plotId, vertices: csvPreview.rows })
      toast.success(`${csvPreview.rows.length} vértices importados. Área y centroide recalculados.`)
      setCsvPreview(null)
      onSuccess?.()
    } catch {
      toast.error('No se pudieron importar los vértices.')
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  // ── Estado: vista previa del CSV ──
  if (csvPreview) {
    const preview = csvPreview.rows.slice(0, 5)
    const extra = csvPreview.rows.length - preview.length
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          Vista previa — {csvPreview.rows.length} vértice{csvPreview.rows.length !== 1 ? 's' : ''} detectados
        </div>

        <div className="rounded-md border overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-3 py-1.5 text-left font-medium text-muted-foreground">#</th>
                <th className="px-3 py-1.5 text-left font-medium text-muted-foreground">Latitud</th>
                <th className="px-3 py-1.5 text-left font-medium text-muted-foreground">Longitud</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {preview.map((r, i) => (
                <tr key={i} className="hover:bg-muted/30">
                  <td className="px-3 py-1 text-muted-foreground">{i + 1}</td>
                  <td className="px-3 py-1 font-mono">{r.latitude}</td>
                  <td className="px-3 py-1 font-mono">{r.longitude}</td>
                </tr>
              ))}
              {extra > 0 && (
                <tr>
                  <td colSpan={3} className="px-3 py-1.5 text-center text-muted-foreground italic">
                    …y {extra} vértice{extra !== 1 ? 's' : ''} más
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-muted-foreground">
          Columnas leídas: <span className="font-medium">{csvPreview.detected.join(', ')}</span>
        </p>

        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={cancelCsv}>
            <X className="h-4 w-4 mr-1" />
            Cancelar
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleImportFromCsv}
            disabled={importMutation.isPending}
          >
            {importMutation.isPending ? 'Importando…' : 'Confirmar e importar'}
          </Button>
        </div>
      </div>
    )
  }

  // ── Estado: entrada manual (+ botón CSV) ──
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Ingresa los vértices manualmente o sube un archivo CSV.
          El backend calcula área y centroide automáticamente.
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0 ml-3"
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="h-4 w-4 mr-1" />
          Subir CSV
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.txt"
          className="hidden"
          onChange={handleFileSelect}
        />
      </div>

      {csvError && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive whitespace-pre-line">
          {csvError}
        </div>
      )}

      <div className="space-y-2">
        <div className="grid grid-cols-[2rem_1fr_1fr_2rem] gap-2 text-xs font-medium text-muted-foreground px-1">
          <span>#</span>
          <span>Latitud</span>
          <span>Longitud</span>
          <span />
        </div>

        {rows.map((row, idx) => (
          <div key={row._key} className="grid grid-cols-[2rem_1fr_1fr_2rem] gap-2 items-center">
            <span className="text-xs text-muted-foreground text-right">{idx + 1}</span>
            <Input
              type="number"
              step="any"
              placeholder="18.9500"
              value={row.latitude || ''}
              onChange={(e) => updateRow(row._key, 'latitude', e.target.value)}
            />
            <Input
              type="number"
              step="any"
              placeholder="-99.2000"
              value={row.longitude || ''}
              onChange={(e) => updateRow(row._key, 'longitude', e.target.value)}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => removeRow(row._key)}
              disabled={rows.length <= 3}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={addRow}>
          <Plus className="h-4 w-4 mr-1" />
          Agregar vértice
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={handleImportManual}
          disabled={importMutation.isPending}
        >
          {importMutation.isPending ? 'Importando…' : 'Importar vértices'}
        </Button>
      </div>
    </div>
  )
}
