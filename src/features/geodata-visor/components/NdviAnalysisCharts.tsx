import { ChevronUp, Pause, Play } from 'lucide-react'

import type {
  NdviReferenceConfig,
  NdviTimelineItem,
} from '@/features/geodata-visor/hooks/useNdviTimeline'
import type { NdviWeekSlot } from '../lib/ndviCycleTimeline'
import type { VisorSession } from '../types'
import {
  classifyNdviPerformance,
  expectedNdviAtDate,
  ndviStageAtDate,
  type NdviPerformance,
} from '../lib/ndviExpected'

interface NdviProgramAnalysisProps {
  slots: NdviWeekSlot[]
  selectedSessionId: string | null
  selectedSession: NdviTimelineItem | null
  subcycleName?: string
  parentProgramName?: string | null
  cropName?: string | null
  cropVarietyName?: string | null
  referenceStart: string | null
  referenceEnd: string | null
  ndviReference: NdviReferenceConfig | null
  isPlaying: boolean
  canPlay: boolean
  onTogglePlay: () => void
  onSelectSession: (session: VisorSession) => void
  onHide?: () => void
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  const date = new Date(`${value}T12:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date).replace('.', '')
}

function shortDate(value: string): string {
  const date = new Date(`${value}T12:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('es-MX', {
    day: '2-digit',
    month: 'short',
  }).format(date).replace('.', '')
}

function cycleWeekCount(
  start: string | null | undefined,
  end: string | null | undefined
): number | null {
  if (!start || !end) return null

  const startMs = Date.parse(`${start}T00:00:00Z`)
  const endMs = Date.parse(`${end}T00:00:00Z`)
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) {
    return null
  }

  const daysInclusive = Math.floor((endMs - startMs) / 86_400_000) + 1
  return Math.max(1, Math.ceil(daysInclusive / 7))
}

function performanceColor(performance: NdviPerformance): string {
  switch (performance) {
    case 'good': return '#16a34a'
    case 'regular': return '#f59e0b'
    case 'bad': return '#ef4444'
    case 'unconfigured': return '#475569'
    default: return '#a1a1aa'
  }
}

function performanceLabel(performance: NdviPerformance): string {
  switch (performance) {
    case 'good': return 'Bien'
    case 'regular': return 'Regular'
    case 'bad': return 'Bajo'
    case 'unconfigured': return 'Sin referencia'
    default: return 'Sin NDVI'
  }
}

interface AnalysisPoint {
  key: string
  index: number
  date: string
  expected: number | null
  real: number | null
  sessionId: string | null
  performance: NdviPerformance
  segmentKey: string | null
}

function buildPoints(
  slots: NdviWeekSlot[],
  referenceStart: string | null,
  referenceEnd: string | null,
  reference: NdviReferenceConfig | null
): AnalysisPoint[] {
  return slots.map((slot, index) => {
    const session = slot.session
    const date = session?.session_date ?? slot.start
    const hasReal =
      !!session &&
      slot.has_ndvi &&
      typeof session.mean === 'number' &&
      Number.isFinite(session.mean)

    const real = hasReal ? session!.mean! : null
    const expected = expectedNdviAtDate(
      date,
      referenceStart,
      referenceEnd,
      reference
    )

    return {
      key: slot.key,
      index,
      date,
      expected,
      real,
      sessionId: session?.id ?? null,
      performance: classifyNdviPerformance(real, expected, reference),
      segmentKey: expected === null ? null : 'child-program-cycle',
    }
  })
}

function smoothPath(coords: Array<{ x: number; y: number }>): string {
  if (coords.length === 0) return ''
  if (coords.length === 1) return `M ${coords[0]!.x} ${coords[0]!.y}`

  let path = `M ${coords[0]!.x} ${coords[0]!.y}`

  for (let index = 0; index < coords.length - 1; index += 1) {
    const p0 = coords[Math.max(0, index - 1)]!
    const p1 = coords[index]!
    const p2 = coords[index + 1]!
    const p3 = coords[Math.min(coords.length - 1, index + 2)]!

    const c1x = p1.x + (p2.x - p0.x) / 6
    const c1y = p1.y + (p2.y - p0.y) / 6
    const c2x = p2.x - (p3.x - p1.x) / 6
    const c2y = p2.y - (p3.y - p1.y) / 6

    path += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`
  }

  return path
}

function contiguousSegments<T extends { index: number; segmentKey?: string | null }>(items: T[]): T[][] {
  const segments: T[][] = []

  for (const item of items) {
    const current = segments[segments.length - 1]
    const previous = current?.[current.length - 1]

    if (
      !current ||
      !previous ||
      item.index !== previous.index + 1 ||
      item.segmentKey !== previous.segmentKey
    ) {
      segments.push([item])
    } else {
      current.push(item)
    }
  }

  return segments
}

function GaussTimelineChart({
  points,
  selectedSessionId,
  onSelectSession,
}: {
  points: AnalysisPoint[]
  selectedSessionId: string | null
  onSelectSession: (session: VisorSession) => void
}) {
  const width = 1000
  const height = 116
  const padding = { left: 38, right: 14, top: 6, bottom: 32 }
  const plotWidth = width - padding.left - padding.right
  const plotHeight = height - padding.top - padding.bottom
  const timelineY = height - 23

  if (points.length === 0) {
    return (
      <div className="flex min-h-[120px] items-center justify-center rounded-lg border border-dashed text-xs text-muted-foreground">
        No existen semanas del subciclo para mostrar.
      </div>
    )
  }

  const xFor = (index: number) => {
    if (points.length <= 1) return padding.left + plotWidth / 2
    return padding.left + (index / (points.length - 1)) * plotWidth
  }

  const yFor = (value: number) =>
    padding.top + (1 - Math.max(0, Math.min(1, value))) * plotHeight

  const expectedPoints = points.filter((point) => point.expected !== null)
  const expectedSegments = contiguousSegments(expectedPoints)
  const realPoints = points.filter((point) => point.real !== null)
  const realConnections = realPoints.slice(1).map((point, index) => ({
    from: realPoints[index]!,
    to: point,
    hasGap: point.index !== realPoints[index]!.index + 1,
  }))
  const selected = points.find((point) => point.sessionId === selectedSessionId) ?? null

  const labelStep =
    points.length > 42 ? 6 :
      points.length > 30 ? 5 :
        points.length > 20 ? 4 :
          points.length > 12 ? 3 : 2

  const selectPoint = (point: AnalysisPoint) => {
    if (!point.sessionId || point.real === null) return
    onSelectSession({ id: point.sessionId, date: point.date, kind: 'ndvi' })
  }

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-[120px] w-full"
        preserveAspectRatio="none"
        role="img"
        aria-label="Línea de tiempo de índice vegetativo con NDVI esperado y NDVI real"
      >
        {[0, 0.25, 0.5, 0.75, 1].map((tick) => (
          <g key={tick}>
            <line
              x1={padding.left}
              y1={yFor(tick)}
              x2={width - padding.right}
              y2={yFor(tick)}
              stroke="#e4e4e7"
              strokeDasharray="4 6"
            />
            <text x={padding.left - 8} y={yFor(tick) + 3} textAnchor="end" fontSize="8" fill="#71717a">
              {tick.toFixed(2)}
            </text>
          </g>
        ))}

        {expectedSegments.map((segment, segmentIndex) => {
          if (segment.length < 2) return null
          const coords = segment.map((point) => ({
            x: xFor(point.index),
            y: yFor(point.expected!),
          }))

          return (
            <path
              key={`expected-${segmentIndex}`}
              d={smoothPath(coords)}
              fill="none"
              stroke="#2563eb"
              strokeWidth="1.8"
              strokeDasharray="8 6"
              strokeLinecap="round"
            >
              <title>NDVI esperado · referencia adaptada al ciclo del Programa</title>
            </path>
          )
        })}

        {realConnections.map(({ from, to, hasGap }) => (
          <path
            key={`real-${from.key}-${to.key}`}
            d={`M ${xFor(from.index)} ${yFor(from.real!)} L ${xFor(to.index)} ${yFor(to.real!)}`}
            fill="none"
            stroke="#14532d"
            strokeWidth="1.6"
            strokeDasharray={hasGap ? '5 4' : undefined}
            strokeLinecap="round"
            opacity={hasGap ? 0.72 : 0.95}
          >
            <title>
              {hasGap
                ? 'Tendencia entre mediciones: existen semanas sin NDVI en este tramo.'
                : 'NDVI real entre semanas consecutivas.'}
            </title>
          </path>
        ))}

        {selected && (
          <line
            x1={xFor(selected.index)}
            y1={padding.top}
            x2={xFor(selected.index)}
            y2={timelineY + 8}
            stroke="#18181b"
            strokeDasharray="5 5"
            opacity="0.45"
          />
        )}

        {realPoints.map((point) => {
          const x = xFor(point.index)
          const y = yFor(point.real!)
          const isSelected = point.sessionId === selectedSessionId
          const expectedText = point.expected === null ? 'sin referencia' : point.expected.toFixed(2)

          return (
            <g key={`real-${point.key}`} className="cursor-pointer" onClick={() => selectPoint(point)}>
              <circle cx={x} cy={y} r="8" fill="transparent" />
              {isSelected && (
                <circle cx={x} cy={y} r="5.5" fill="none" stroke="#18181b" strokeWidth="1.4" opacity="0.35" />
              )}
              <circle
                cx={x}
                cy={y}
                r={isSelected ? 3.8 : 3}
                fill={performanceColor(point.performance)}
                stroke="#fff"
                strokeWidth="1.5"
              />
              <title>{`${formatDate(point.date)} · Real ${point.real!.toFixed(2)} · Esperado ${expectedText} · ${performanceLabel(point.performance)}`}</title>
            </g>
          )
        })}

        <line
          x1={padding.left}
          y1={timelineY}
          x2={width - padding.right}
          y2={timelineY}
          stroke="#52525b"
          strokeWidth="1.5"
        />

        {points.map((point) => {
          const x = xFor(point.index)
          const isSelected = point.sessionId === selectedSessionId
          const clickable = point.sessionId !== null && point.real !== null

          return (
            <g
              key={`timeline-${point.key}`}
              className={clickable ? 'cursor-pointer' : undefined}
              onClick={() => clickable && selectPoint(point)}
            >
              <line x1={x} y1={timelineY - 5} x2={x} y2={timelineY + 5} stroke="#3f3f46" strokeWidth="1" />
              <circle
                cx={x}
                cy={timelineY + 13}
                r={isSelected ? 4 : 2.8}
                fill={point.real === null ? '#d4d4d8' : performanceColor(point.performance)}
                stroke={isSelected ? '#18181b' : '#fff'}
                strokeWidth={isSelected ? 1.5 : 1}
              />

              {(point.index % labelStep === 0 || isSelected || point.index === points.length - 1) && (
                <text
                  x={x}
                  y={height - 3}
                  textAnchor="middle"
                  fontSize="7.5"
                  fill={isSelected ? '#18181b' : '#71717a'}
                  fontWeight={isSelected ? 700 : 400}
                >
                  {shortDate(point.date)}
                </text>
              )}
            </g>
          )
        })}

        {selected && (
          <g>
            <rect
              x={Math.max(padding.left, Math.min(width - padding.right - 76, xFor(selected.index) - 38))}
              y={timelineY - 21}
              width="76"
              height="15"
              rx="5"
              fill="#18181b"
            />
            <text
              x={Math.max(padding.left + 38, Math.min(width - padding.right - 38, xFor(selected.index)))}
              y={timelineY - 11}
              textAnchor="middle"
              fontSize="7"
              fontWeight="600"
              fill="#fff"
            >
              {shortDate(selected.date)}
            </text>
          </g>
        )}
      </svg>

      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-0.5 text-[8px] text-muted-foreground">
        <span className="flex items-center gap-1"><span className="inline-block h-[2px] w-5 border-t-2 border-dashed border-blue-600" />Esperado</span>
        <span className="flex items-center gap-1"><span className="inline-block h-[2px] w-5 bg-green-900" />Real</span>
        <span className="flex items-center gap-1"><span className="inline-block w-5 border-t border-dashed border-green-900 opacity-70" />Real con hueco</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-green-600" />Bien</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500" />Regular</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500" />Bajo</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-slate-500" />Sin referencia</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-zinc-300" />Sin NDVI</span>
      </div>
    </div>
  )
}

export function NdviProgramAnalysis({
  slots,
  selectedSessionId,
  selectedSession,
  subcycleName,
  parentProgramName,
  cropName,
  cropVarietyName,
  referenceStart,
  referenceEnd,
  ndviReference,
  isPlaying,
  canPlay,
  onTogglePlay,
  onSelectSession,
  onHide,
}: NdviProgramAnalysisProps) {
  const points = buildPoints(
    slots,
    referenceStart,
    referenceEnd,
    ndviReference
  )
  const selectedPoint =
    points.find((point) => point.sessionId === selectedSessionId) ??
    points.find((point) => point.real !== null) ??
    null

  const expected = selectedPoint?.expected ?? null
  const real = selectedPoint?.real ?? null
  const delta = expected !== null && real !== null ? real - expected : null
  const performance = selectedPoint?.performance ?? 'missing'
  const selectedStage = selectedPoint
    ? ndviStageAtDate(
        selectedPoint.date,
        referenceStart,
        referenceEnd,
        ndviReference
      )
    : null

  const cropLabel = cropName?.trim() || cropVarietyName?.trim() || 'Cultivo sin identificar'
  const hasWindow = !!referenceStart && !!referenceEnd
  const hasReference = hasWindow && !!ndviReference
  const weeks = cycleWeekCount(referenceStart, referenceEnd)
  const configurationMessage =
    !hasWindow
      ? 'El Programa hijo necesita fecha inicio y fecha fin para calcular el esperado.'
      : !ndviReference
        ? 'El cultivo del Programa hijo no tiene referencia NDVI configurada.'
        : null

  return (
    <section className="rounded-xl border bg-background p-1.5">
      <div className="mb-0.5 flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h3 className="text-xs font-semibold">Línea de tiempo de índice vegetativo · {cropLabel}</h3>
            <span className="text-[9px] font-medium text-muted-foreground">
              Ciclo: {subcycleName ?? 'Programa hijo'}{weeks ? ` · ${weeks} sem` : ''}
            </span>
            {parentProgramName && (
              <span
                className="text-[8px] text-muted-foreground/80"
                title="El Programa Maestro es solo contenedor y no define la curva NDVI esperada."
              >
                Padre: {parentProgramName}
              </span>
            )}
            {!hasReference && configurationMessage && (
              <span
                className="rounded bg-slate-100 px-1.5 py-0.5 text-[8px] font-medium text-slate-600"
                title={configurationMessage}
              >
                {configurationMessage}
              </span>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            disabled={!canPlay}
            onClick={onTogglePlay}
            className="flex h-7 shrink-0 items-center gap-1 rounded-md border px-2 text-[9px] font-semibold transition hover:bg-accent focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label={isPlaying ? 'Pausar recorrido NDVI' : 'Reproducir recorrido NDVI'}
          >
            {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            {isPlaying ? 'Pausa' : 'Play'}
          </button>

          {onHide && (
            <button
              type="button"
              onClick={onHide}
              className="flex h-7 shrink-0 items-center gap-1 rounded-md border px-2 text-[9px] font-medium transition hover:bg-accent focus:outline-none focus:ring-2 focus:ring-primary/30"
              aria-label="Ocultar línea de tiempo de índice vegetativo"
            >
              Ocultar línea de tiempo
              <ChevronUp className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="mb-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 rounded-md border bg-muted/20 px-2 py-0.5 text-[9px]">
        <span><span className="text-muted-foreground">Fecha:</span> <strong>{formatDate(selectedSession?.session_date)}</strong></span>
        <span><span className="text-muted-foreground">Esperado:</span> <strong className="text-blue-600">{expected === null ? '—' : expected.toFixed(2)}</strong></span>
        <span><span className="text-muted-foreground">Real:</span> <strong style={{ color: performanceColor(performance) }}>{real === null ? '—' : real.toFixed(2)}</strong></span>
        <span><span className="text-muted-foreground">Diferencia:</span> <strong style={{ color: performanceColor(performance) }}>{delta === null ? '—' : `${delta >= 0 ? '+' : ''}${delta.toFixed(2)}`}</strong></span>
        <span><span className="text-muted-foreground">Etapa:</span> <strong>{selectedStage?.label ?? '—'}</strong>{selectedStage?.description ? ` · ${selectedStage.description}` : ''}</span>
        <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: performanceColor(performance) }} /><strong>{performanceLabel(performance)}</strong></span>
      </div>

      <GaussTimelineChart
        points={points}
        selectedSessionId={selectedSessionId}
        onSelectSession={onSelectSession}
      />
    </section>
  )
}
