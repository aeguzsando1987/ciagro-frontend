import { useEffect, useMemo, useState } from 'react'
import { useIsFetching } from '@tanstack/react-query'
import {
  Bug,
  ChevronDown,
  ChevronUp,
  Droplets,
  Layers3,
  Leaf,
  Pause,
  Play,
  Sprout,
  Wheat,
} from 'lucide-react'

import { GpaLoader } from '@/components/ui/gpa-loader'
import { useNdviTimeline, type NdviTimelineItem } from '../hooks/useNdviTimeline'
import { usePlotSessionTree } from '../hooks/usePlotSessionTree'
import {
  classifyNdviPerformance,
  expectedNdviAtDate,
  ndviStageAtDate,
  type NdviPerformance,
} from '../lib/ndviExpected'
import type { TreeSession } from '../lib/plotSessionTree'
import type { SessionKind, VisorSession } from '../types'

interface PlotUnifiedTimelineProps {
  plotId: string
  selectedSession?: VisorSession | null
  onSelectSession: (session: VisorSession) => void
  defaultCollapsed?: boolean
}

type TimelineKind = SessionKind

const KIND_ORDER: TimelineKind[] = [
  'ndvi',
  'phyto',
  'soil_map',
  'aspersion',
  'yield_map',
  'planting_map',
]

const KIND_META: Record<TimelineKind, {
  label: string
  shortLabel: string
  color: string
  soft: string
  icon: React.ReactNode
}> = {
  ndvi: {
    label: 'NDVI',
    shortLabel: 'NDVI',
    color: '#16813a',
    soft: '#edf8f0',
    icon: <Leaf className="h-3.5 w-3.5" />,
  },
  phyto: {
    label: 'Fitosanitario',
    shortLabel: 'Fitosanitario',
    color: '#ef4444',
    soft: '#fff1f2',
    icon: <Bug className="h-3.5 w-3.5" />,
  },
  soil_map: {
    label: 'Mapeo de suelo',
    shortLabel: 'Mapeo de suelo',
    color: '#f97316',
    soft: '#fff7ed',
    icon: <Layers3 className="h-3.5 w-3.5" />,
  },
  aspersion: {
    label: 'Aspersión',
    shortLabel: 'Aspersión',
    color: '#2563eb',
    soft: '#eff6ff',
    icon: <Droplets className="h-3.5 w-3.5" />,
  },
  yield_map: {
    label: 'Rendimiento',
    shortLabel: 'Rendimiento',
    color: '#9333ea',
    soft: '#faf5ff',
    icon: <Wheat className="h-3.5 w-3.5" />,
  },
  planting_map: {
    label: 'Siembra',
    shortLabel: 'Siembra',
    color: '#8b5a2b',
    soft: '#fdf8f2',
    icon: <Sprout className="h-3.5 w-3.5" />,
  },
}

const PERFORMANCE_META: Record<NdviPerformance, { label: string; color: string }> = {
  good: { label: 'Bien', color: '#16a34a' },
  regular: { label: 'Regular', color: '#f59e0b' },
  bad: { label: 'Bajo', color: '#ef4444' },
  missing: { label: 'Sin NDVI', color: '#a1a1aa' },
  unconfigured: { label: 'Sin referencia', color: '#64748b' },
}

const DAY_MS = 86_400_000

function dateMs(value: string | null | undefined): number | null {
  if (!value) return null
  const parsed = Date.parse(`${value}T12:00:00Z`)
  return Number.isFinite(parsed) ? parsed : null
}

function isoFromMs(value: number): string {
  return new Date(value).toISOString().slice(0, 10)
}

function shortDate(value: string | null): string {
  if (!value) return 'Sin fecha'
  const date = new Date(`${value}T12:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('es-MX', {
    day: '2-digit',
    month: 'short',
  }).format(date).replace('.', '')
}

function longDate(value: string | null | undefined): string {
  if (!value) return 'Sin fecha'
  const date = new Date(`${value}T12:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date).replace('.', '')
}

function cycleLabel(value: string | null): string {
  if (!value) return 'Fuera de ciclo'
  return `Ciclo ${value.replace(/-(\d{4})$/, ' $1')}`
}

function sessionTitle(session: TreeSession, ndviById: Map<string, NdviTimelineItem>): string {
  if (session.kind === 'ndvi') {
    const ndvi = ndviById.get(session.id)
    if (typeof ndvi?.mean === 'number') return `NDVI ${ndvi.mean.toFixed(2)}`
  }
  return KIND_META[session.kind].label
}

function rangeForSessions(
  sessions: TreeSession[],
  ndviItems: NdviTimelineItem[]
): { start: number; end: number } | null {
  const dates = sessions
    .map((session) => dateMs(session.date))
    .filter((value): value is number => value !== null)

  for (const item of ndviItems) {
    const start = dateMs(item.reference_start)
    const end = dateMs(item.reference_end)
    if (start !== null) dates.push(start)
    if (end !== null) dates.push(end)
  }

  if (dates.length === 0) return null
  const min = Math.min(...dates)
  const max = Math.max(...dates)
  if (min === max) return { start: min - 7 * DAY_MS, end: max + 7 * DAY_MS }
  return { start: min, end: max }
}

function xPercent(date: string | null, range: { start: number; end: number }): number | null {
  const value = dateMs(date)
  if (value === null) return null
  const span = Math.max(DAY_MS, range.end - range.start)
  return Math.max(0, Math.min(100, ((value - range.start) / span) * 100))
}

function chartXPercent(date: string | null, range: { start: number; end: number }, padPercent: number): number | null {
  const raw = xPercent(date, range)
  if (raw === null) return null
  return padPercent + (raw / 100) * (100 - padPercent * 2)
}

function curvePath(
  points: Array<{ date: string; value: number }>,
  range: { start: number; end: number },
  width: number,
  height: number,
  padX: number,
  padY: number
): string {
  if (points.length === 0) return ''
  const span = Math.max(DAY_MS, range.end - range.start)
  const chartW = width - padX * 2
  const chartH = height - padY * 2
  return points.map((point, index) => {
    const ms = dateMs(point.date) ?? range.start
    const x = padX + ((ms - range.start) / span) * chartW
    const y = padY + (1 - Math.max(0, Math.min(1, point.value))) * chartH
    return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`
  }).join(' ')
}

function formatNumber(value: number | null | undefined): string {
  return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(2) : '—'
}

export function PlotUnifiedTimeline({
  plotId,
  selectedSession = null,
  onSelectSession,
}: PlotUnifiedTimelineProps) {
  const plotTree = usePlotSessionTree(plotId)
  const ndviQuery = useNdviTimeline(plotId)
  const [activeKinds, setActiveKinds] = useState<Set<TimelineKind>>(() => new Set(KIND_ORDER))
  const [selectedCycle, setSelectedCycle] = useState<string>('all')
  const [isPlaying, setIsPlaying] = useState(false)
  const [playCursor, setPlayCursor] = useState<number | null>(null)
  // La línea de tiempo siempre inicia expandida, incluso al entrar directo a una sesión.
  // El usuario puede contraerla manualmente con el botón, pero nunca arranca cerrada.
  const [isCollapsed, setIsCollapsed] = useState(false)

  const sessions = plotTree.sessions
  const ndviItems = useMemo(() => (ndviQuery.data ?? []).slice().sort((a, b) =>
    (a.session_date ?? '').localeCompare(b.session_date ?? '')
  ), [ndviQuery.data])

  const ndviById = useMemo(
    () => new Map(ndviItems.map((item) => [item.id, item])),
    [ndviItems]
  )

  const sessionById = useMemo(
    () => new Map(sessions.map((session) => [session.id, session])),
    [sessions]
  )


  const selectedSessionFetches = useIsFetching({
    predicate: (query) => {
      const id = selectedSession?.id
      if (!id) return false
      return query.queryKey.some((part) => part === id)
    },
  })

  const cycleBySessionId = useMemo(
    () => new Map(sessions.map((session) => [session.id, session.cycle?.trim() || null])),
    [sessions]
  )

  const selectedCycleWindow = useMemo(() => {
    if (selectedCycle === 'all') return null

    const candidates = ndviItems.filter((item) => {
      if (!item.reference_start || !item.reference_end) return false
      return cycleBySessionId.get(item.id) === selectedCycle
    })

    const preferred = selectedSession
      ? candidates.find((item) => item.id === selectedSession.id)
      : null
    const base = preferred ?? candidates[0] ?? null
    if (!base?.reference_start || !base.reference_end) return null

    const start = dateMs(base.reference_start)
    const end = dateMs(base.reference_end)
    if (start === null || end === null || end < start) return null

    return {
      start,
      end,
      startDate: base.reference_start,
      endDate: base.reference_end,
    }
  }, [cycleBySessionId, ndviItems, selectedCycle, selectedSession])

  const isInsideSelectedCycle = (date: string | null | undefined) => {
    if (!selectedCycleWindow) return false
    const ms = dateMs(date)
    return ms !== null && ms >= selectedCycleWindow.start && ms <= selectedCycleWindow.end
  }

  const cycles = useMemo(() => {
    const latest = new Map<string, string>()
    for (const session of sessions) {
      const cycle = session.cycle?.trim()
      if (!cycle || session.kind === 'soil_map') continue
      const current = latest.get(cycle)
      if (session.date && (!current || session.date > current)) latest.set(cycle, session.date)
      else if (!latest.has(cycle)) latest.set(cycle, '')
    }
    return [...latest.entries()]
      .sort((a, b) => b[1].localeCompare(a[1]) || b[0].localeCompare(a[0]))
      .map(([cycle]) => cycle)
  }, [sessions])

  useEffect(() => {
    if (selectedCycle !== 'all' || cycles.length === 0) return
    const selectedCycleValue = selectedSession ? cycleBySessionId.get(selectedSession.id) : null
    setSelectedCycle(selectedCycleValue || cycles[0] || 'all')
  }, [cycleBySessionId, cycles, selectedCycle, selectedSession])

  useEffect(() => {
    if (!selectedSession || selectedSession.kind === 'soil_map') return
    const cycle = cycleBySessionId.get(selectedSession.id)
    if (cycle) setSelectedCycle(cycle)
  }, [cycleBySessionId, selectedSession])


  useEffect(() => {
    // Al cambiar de parcela la línea vuelve a mostrarse expandida.
    // Entrar directo a una sesión también queda abierto porque el estado inicial es false.
    setIsCollapsed(false)
  }, [plotId])

  const cycleSessions = useMemo(
    () => sessions.filter((session) => {
      if (selectedCycle === 'all') return true

      // La etiqueta program_cycle de headers viejos puede venir vacía o desfasada.
      // El Programa hijo ya define una ventana real (reference_start/end), así que
      // cualquier sesión fechada dentro de esa ventana pertenece visualmente al ciclo.
      if ((session.cycle?.trim() || null) === selectedCycle) return true
      if (isInsideSelectedCycle(session.date)) return true

      // Suelo no pertenece al ciclo como entidad, pero sólo se dibuja si su fecha cae
      // dentro del eje del ciclo seleccionado; nunca debe estirar el rango a otro año.
      return false
    }),
    [selectedCycle, selectedCycleWindow, sessions]
  )

  const ndviForCycle = useMemo(
    () => ndviItems.filter((item) => {
      if (selectedCycle === 'all') return true
      if (cycleBySessionId.get(item.id) === selectedCycle) return true
      return isInsideSelectedCycle(item.session_date)
    }),
    [cycleBySessionId, ndviItems, selectedCycle, selectedCycleWindow]
  )

  // Importante: aquí NO hay agrupación semanal. Cada sesión NDVI del endpoint
  // permanece como un punto independiente, aunque existan 2 o 3 en la misma semana.
  const realNdvi = useMemo(
    () => ndviForCycle
      .filter((item): item is NdviTimelineItem & { session_date: string; mean: number } =>
        Boolean(item.session_date) && item.has_ndvi && typeof item.mean === 'number'
      )
      .map((item) => ({ date: item.session_date, value: item.mean, item })),
    [ndviForCycle]
  )

  const range = useMemo(() => {
    // Para un ciclo concreto el eje SIEMPRE respeta Inicio/Fin del Programa hijo.
    // Esto evita que una sesión de suelo fuera del ciclo comprima los NDVI de enero-abril.
    if (selectedCycle !== 'all' && selectedCycleWindow) {
      return { start: selectedCycleWindow.start, end: selectedCycleWindow.end }
    }
    return rangeForSessions(cycleSessions, ndviForCycle)
  }, [cycleSessions, ndviForCycle, selectedCycle, selectedCycleWindow])

  const referenceItem = ndviForCycle.find(
    (item) => item.ndvi_reference && item.reference_start && item.reference_end
  ) ?? null

  const expectedPoints = useMemo(() => {
    if (!referenceItem?.ndvi_reference || !referenceItem.reference_start || !referenceItem.reference_end) return []
    const start = dateMs(referenceItem.reference_start)
    const end = dateMs(referenceItem.reference_end)
    if (start === null || end === null || end < start) return []
    const samples = 40
    return Array.from({ length: samples }, (_, index) => {
      const ms = start + ((end - start) * index) / (samples - 1)
      const date = isoFromMs(ms)
      const value = expectedNdviAtDate(
        date,
        referenceItem.reference_start,
        referenceItem.reference_end,
        referenceItem.ndvi_reference
      )
      return value === null ? null : { date, value }
    }).filter((point): point is { date: string; value: number } => point !== null)
  }, [referenceItem])

  // Fuente canónica de eventos de la línea de tiempo:
  // - NDVI sale directamente de useNdviTimeline para no perder headers/sesiones
  //   que el árbol histórico todavía no exponga.
  // - El resto de tipos viene del árbol normalizado.
  // Así, cada punto real de la gráfica NDVI siempre tiene un icono debajo.
  const cycleEvents = useMemo<TreeSession[]>(() => {
    const nonNdvi = cycleSessions.filter((session) => session.kind !== 'ndvi')
    const ndvi = ndviForCycle
      .filter((item) => Boolean(item.session_date))
      .map((item) => {
        const fromTree = sessionById.get(item.id)
        return {
          id: item.id,
          kind: 'ndvi' as const,
          date: item.session_date ?? null,
          points_count: fromTree?.points_count ?? 0,
          cycle: fromTree?.cycle ?? cycleBySessionId.get(item.id) ?? (selectedCycle === 'all' ? null : selectedCycle),
        }
      })

    const merged = [...nonNdvi, ...ndvi]
    const unique = new Map<string, TreeSession>()
    for (const session of merged) unique.set(`${session.kind}:${session.id}`, session)
    return [...unique.values()]
  }, [cycleBySessionId, cycleSessions, ndviForCycle, selectedCycle, sessionById])

  const sessionCounts = useMemo(() => {
    const counts = Object.fromEntries(
      KIND_ORDER.map((kind) => [kind, 0])
    ) as Record<TimelineKind, number>

    for (const session of cycleEvents) {
      counts[session.kind] += 1
    }

    return counts
  }, [cycleEvents])
  const visibleSessions = useMemo(
    () => cycleEvents.filter((session) => activeKinds.has(session.kind)),
    [activeKinds, cycleEvents]
  )

  const playable = useMemo(
    () => visibleSessions
      .filter((session): session is TreeSession & { date: string } => Boolean(session.date))
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date) || KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) || a.id.localeCompare(b.id)),
    [visibleSessions]
  )

  useEffect(() => {
    if (!isPlaying) return
    if (playable.length === 0 || playCursor === null || playCursor >= playable.length) {
      setIsPlaying(false)
      setPlayCursor(null)
    }
  }, [isPlaying, playCursor, playable.length])

  useEffect(() => {
    if (!isPlaying || playCursor === null) return
    const current = playable[playCursor]
    if (!current) return

    const selectedMatches =
      selectedSession?.id === current.id && selectedSession?.kind === current.kind
    if (!selectedMatches) return

    // No avanzamos mientras cualquier query de la sesión seleccionada siga cargando.
    if (selectedSessionFetches > 0) return

    // Una vez lista, la dejamos visible al menos medio segundo antes de avanzar.
    const timer = window.setTimeout(() => {
      const nextIndex = playCursor + 1 >= playable.length ? 0 : playCursor + 1

      const next = playable[nextIndex]
      if (!next) return

      setPlayCursor(nextIndex)
      onSelectSession({ id: next.id, date: next.date, kind: next.kind })
    }, 1000)

    return () => window.clearTimeout(timer)
  }, [
    isPlaying,
    onSelectSession,
    playCursor,
    playable,
    selectedSession?.id,
    selectedSession?.kind,
    selectedSessionFetches,
  ])

  const stopPlay = () => {
    // Solo pausa. NO borramos playCursor para poder continuar
    // exactamente desde la sesión donde se detuvo.
    setIsPlaying(false)
  }

  const startPlay = () => {
    if (isPlaying) {
      stopPlay()
      return
    }

    if (playable.length === 0) return

    // Si el usuario seleccionó manualmente una sesión,
    // Play debe continuar desde esa sesión.
    const selectedIndex = selectedSession
      ? playable.findIndex(
          (session) =>
            session.id === selectedSession.id &&
            session.kind === selectedSession.kind
        )
      : -1

    // Solo cuando no hay sesión seleccionada ni una pausa previa
    // empezamos desde el primer punto de la izquierda.
    let startIndex = 0

    if (selectedIndex >= 0) {
      startIndex = selectedIndex
    } else if (
      playCursor !== null &&
      playCursor >= 0 &&
      playCursor < playable.length
    ) {
      startIndex = playCursor
    }

    const current = playable[startIndex]
    if (!current) return

    setPlayCursor(startIndex)
    setIsPlaying(true)

    const alreadySelected =
      selectedSession?.id === current.id &&
      selectedSession?.kind === current.kind

    if (!alreadySelected) {
      onSelectSession({
        id: current.id,
        date: current.date,
        kind: current.kind,
      })
    }
  }


  if (plotTree.isLoading || ndviQuery.isLoading) {
    return (
      <div className="flex h-40 items-center justify-center gap-2 rounded-xl border bg-background text-xs text-muted-foreground">
        <GpaLoader size="xs" /> Cargando línea de tiempo de la parcela…
      </div>
    )
  }

  if (plotTree.isError) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-xs text-destructive">
        No se pudieron cargar todas las sesiones de la parcela.
      </div>
    )
  }

  const toggleKind = (kind: TimelineKind) => {
    stopPlay()
    setActiveKinds((current) => {
      const next = new Set(current)
      if (next.has(kind)) next.delete(kind)
      else next.add(kind)
      return next
    })
  }

  const chartWidth = 1200
  const chartHeight = 100
  const padX = 48
  const padY = 10
  const padPercent = (padX / chartWidth) * 100
  const ndviCurveVisible = activeKinds.has('ndvi')
  const realPath = range && ndviCurveVisible
    ? curvePath(realNdvi, range, chartWidth, chartHeight, padX, padY)
    : ''
  const expectedPath = range && ndviCurveVisible
    ? curvePath(expectedPoints, range, chartWidth, chartHeight, padX, padY)
    : ''

  const axisLabels = range
    ? Array.from({ length: 7 }, (_, index) => {
        const ms = range.start + ((range.end - range.start) * index) / 6
        const rawPercent = (index / 6) * 100
        return {
          left: `${padPercent + (rawPercent / 100) * (100 - padPercent * 2)}%`,
          label: shortDate(isoFromMs(ms)),
        }
      })
    : []

  const selectedTreeSession = selectedSession ? sessionById.get(selectedSession.id) ?? null : null
  const defaultNdvi = realNdvi[0]?.item ?? null
  const selectedNdvi = selectedSession?.kind === 'ndvi'
    ? ndviById.get(selectedSession.id) ?? defaultNdvi
    : defaultNdvi

  const selectedExpected = selectedNdvi?.session_date
    ? expectedNdviAtDate(
        selectedNdvi.session_date,
        selectedNdvi.reference_start,
        selectedNdvi.reference_end,
        selectedNdvi.ndvi_reference
      )
    : null
  const selectedStage = selectedNdvi?.session_date
    ? ndviStageAtDate(
        selectedNdvi.session_date,
        selectedNdvi.reference_start,
        selectedNdvi.reference_end,
        selectedNdvi.ndvi_reference
      )
    : null
  const selectedPerformance = classifyNdviPerformance(
    selectedNdvi?.mean ?? null,
    selectedExpected,
    selectedNdvi?.ndvi_reference
  )
  const performanceMeta = PERFORMANCE_META[selectedPerformance]
  const selectedDifference = selectedNdvi?.mean !== null && selectedNdvi?.mean !== undefined && selectedExpected !== null
    ? selectedNdvi.mean - selectedExpected
    : null

  const eventDatesSeen = new Map<string, number>()
  const visibleEvents = visibleSessions
    .filter((session) => Boolean(session.date))
    .slice()
    .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? '') || a.kind.localeCompare(b.kind))
    .map((session) => {
      const key = session.date ?? ''
      const stackIndex = eventDatesSeen.get(key) ?? 0
      eventDatesSeen.set(key, stackIndex + 1)
      return { session, stackIndex }
    })

  const ndviDateCounts = new Map<string, number>()
  for (const point of realNdvi) ndviDateCounts.set(point.date, (ndviDateCounts.get(point.date) ?? 0) + 1)
  const ndviDateIndex = new Map<string, number>()

  return (
    <section className="shrink-0 overflow-hidden rounded-xl border bg-background shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2 px-3 pb-1.5 pt-2">
        <div>
          <h3 className="text-sm font-semibold">
            Línea de tiempo de índice vegetativo
            {referenceItem?.crop_name ? ` · ${referenceItem.crop_name}` : ''}
          </h3>
          <p className="text-[10px] text-muted-foreground">
            Todos los eventos comparten el mismo eje de fechas; cada marcador abre su mapa.
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <select
            value={selectedCycle}
            onChange={(event) => { stopPlay(); setSelectedCycle(event.target.value) }}
            className="h-8 max-w-[260px] rounded-md border bg-background px-2 text-[10px] font-medium"
            aria-label="Ciclo productivo"
          >
            <option value="all">Todos los ciclos</option>
            {cycles.map((cycle) => <option key={cycle} value={cycle}>{cycleLabel(cycle)}</option>)}
          </select>
          <button
            type="button"
            disabled={playable.length === 0}
            onClick={startPlay}
            className="inline-flex h-8 items-center gap-1 rounded-md border px-2 text-[10px] font-semibold hover:bg-accent disabled:opacity-40"
          >
            {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            {isPlaying ? 'Pausa' : 'Play'}
          </button>
          <button
            type="button"
            onClick={() => setIsCollapsed((value) => !value)}
            className="inline-flex h-8 items-center gap-1 rounded-md border px-2 text-[10px] font-medium hover:bg-accent"
            aria-expanded={!isCollapsed}
          >
            {isCollapsed ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
            {isCollapsed ? 'Mostrar línea de tiempo' : 'Ocultar línea de tiempo'}
          </button>
        </div>
      </div>


      {!isCollapsed && (<>

      <div className="mx-3 mb-1 flex min-h-9 flex-wrap items-center gap-x-4 gap-y-1.5 rounded-md border bg-muted/20 px-3 py-1.5 text-[11px]">
        {selectedSession && selectedSession.kind !== 'ndvi' && selectedTreeSession ? (
          <>
            <span className="font-semibold">Sesión seleccionada:</span>
            <span
              className="inline-flex items-center gap-1 font-semibold"
              style={{ color: KIND_META[selectedTreeSession.kind].color }}
            >
              {KIND_META[selectedTreeSession.kind].icon}
              {KIND_META[selectedTreeSession.kind].label}
            </span>
            <span>Fecha: <strong>{longDate(selectedTreeSession.date)}</strong></span>
            <span>Puntos: <strong>{selectedTreeSession.points_count}</strong></span>
          </>
        ) : selectedNdvi ? (
          <>
            <span>Fecha: <strong>{longDate(selectedNdvi.session_date)}</strong></span>
            <span>Esperado: <strong className="text-blue-600">{formatNumber(selectedExpected)}</strong></span>
            <span>Real: <strong style={{ color: performanceMeta.color }}>{formatNumber(selectedNdvi.mean)}</strong></span>
            <span>Diferencia: <strong style={{ color: selectedDifference !== null && selectedDifference < 0 ? '#ef4444' : '#16a34a' }}>{selectedDifference === null ? '—' : `${selectedDifference >= 0 ? '+' : ''}${selectedDifference.toFixed(2)}`}</strong></span>
            <span>Etapa: <strong>{selectedStage?.label ?? '—'}</strong>{selectedStage?.description ? ` · ${selectedStage.description}` : ''}</span>
            <span className="inline-flex items-center gap-1 font-semibold" style={{ color: performanceMeta.color }}>
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: performanceMeta.color }} />
              {performanceMeta.label}
            </span>
          </>
        ) : (
          <span className="text-muted-foreground">Sin sesiones NDVI para este ciclo.</span>
        )}
      </div>

      <div className="border-t bg-muted/[0.08] px-3 pb-1.5 pt-1.5">
        <div className="mb-0.5 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3 text-[9px]">
            <strong>Índice de vegetación (NDVI)</strong>
            <span className="inline-flex items-center gap-1 text-blue-600"><span className="w-5 border-t-2 border-dashed border-blue-500" />Esperado</span>
            <span className="inline-flex items-center gap-1 text-green-700"><span className="w-5 border-t-2 border-green-700" />Real</span>
            <span className="text-muted-foreground">{realNdvi.length} sesiones</span>
          </div>
          {!referenceItem && <span className="text-[9px] text-muted-foreground">Sin referencia NDVI configurada para este ciclo.</span>}
        </div>

        {range ? (
          <>
            <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="block w-full" role="img" aria-label="Evolución NDVI real y esperada">
              {[0, 0.25, 0.5, 0.75, 1].map((value) => {
                const y = padY + (1 - value) * (chartHeight - padY * 2)
                return (
                  <g key={value}>
                    <line x1={padX} y1={y} x2={chartWidth - padX} y2={y} stroke="#e4e4e7" strokeDasharray="4 5" />
                    <text x={4} y={y + 3} fontSize="8" fill="#71717a">{value.toFixed(2)}</text>
                  </g>
                )
              })}
              {expectedPath && <path d={expectedPath} fill="none" stroke="#3b82f6" strokeWidth="2" strokeDasharray="6 5" />}
              {realPath && <path d={realPath} fill="none" stroke="#16813a" strokeWidth="2" />}
              {ndviCurveVisible && realNdvi.map((point) => {
                const ms = dateMs(point.date) ?? range.start
                const baseX = padX + ((ms - range.start) / Math.max(DAY_MS, range.end - range.start)) * (chartWidth - padX * 2)
                const duplicateCount = ndviDateCounts.get(point.date) ?? 1
                const duplicateIndex = ndviDateIndex.get(point.date) ?? 0
                ndviDateIndex.set(point.date, duplicateIndex + 1)
                const jitter = duplicateCount > 1 ? (duplicateIndex - (duplicateCount - 1) / 2) * 6 : 0
                const x = baseX + jitter
                const y = padY + (1 - Math.max(0, Math.min(1, point.value))) * (chartHeight - padY * 2)
                const selected = selectedSession?.id === point.item.id
                return (
                  <g key={point.item.id} className="cursor-pointer" onClick={() => { stopPlay(); onSelectSession({ id: point.item.id, date: point.item.session_date, kind: 'ndvi' }) }}>
                    {selected && <circle cx={x} cy={y} r="7" fill="none" stroke="#14532d" strokeWidth="1.5" />}
                    <circle cx={x} cy={y} r="4.2" fill="#16813a" stroke="white" strokeWidth="1.5">
                      <title>{`${shortDate(point.date)} · NDVI ${point.value.toFixed(2)}`}</title>
                    </circle>
                  </g>
                )
              })}
            </svg>

            <div className="relative h-11 border-t" aria-label="Eventos de la parcela en la línea de tiempo">
              {axisLabels.map((item) => (
                <span
                  key={item.left}
                  className="absolute top-[25px] -translate-x-1/2 whitespace-nowrap text-[8px] text-muted-foreground"
                  style={{ left: item.left }}
                >
                  {item.label}
                </span>
              ))}

              {visibleEvents.map(({ session, stackIndex }) => {
                const left = chartXPercent(session.date, range, padPercent)
                if (left === null) return null
                const meta = KIND_META[session.kind]
                const selected = selectedSession?.id === session.id
                // Nunca ocultamos eventos que comparten fecha. Los repartimos en dos
                // alturas y aplicamos un pequeño desplazamiento horizontal a partir del
                // tercer elemento para que todos sigan siendo visibles/clicables.
                const row = stackIndex % 2
                const pair = Math.floor(stackIndex / 2)
                const horizontalOffset = pair === 0 ? 0 : (pair % 2 === 1 ? -1 : 1) * Math.ceil(pair / 2) * 10
                const top = row * 13 + 2
                return (
                  <button
                    key={`${session.kind}:${session.id}`}
                    type="button"
                    onClick={() => { stopPlay(); onSelectSession({ id: session.id, date: session.date, kind: session.kind }) }}
                    className="absolute z-10 flex h-[18px] w-[18px] -translate-x-1/2 items-center justify-center rounded-full border bg-white shadow-sm transition hover:scale-125 focus:outline-none focus:ring-2 focus:ring-offset-1"
                    style={{
                      left: `${left}%`,
                      top,
                      marginLeft: horizontalOffset,
                      color: meta.color,
                      borderColor: selected ? '#111827' : meta.color,
                      boxShadow: selected ? `0 0 0 2px ${meta.color}` : '0 1px 2px rgba(0,0,0,.12)',
                    }}
                    title={`${longDate(session.date)} · ${sessionTitle(session, ndviById)} · ${session.points_count} puntos`}
                    aria-label={`${meta.label}, ${longDate(session.date)}`}
                  >
                    <span className="[&>svg]:h-3 [&>svg]:w-3">{meta.icon}</span>
                  </button>
                )
              })}
            </div>
          </>
        ) : (
          <div className="flex h-[100px] items-center justify-center text-[10px] text-muted-foreground">Sin sesiones fechadas para este filtro.</div>
        )}

        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 pt-2 text-[10px]">
          {KIND_ORDER.map((kind) => {
            const meta = KIND_META[kind]
            const active = activeKinds.has(kind)
            return (
              <button
                key={kind}
                type="button"
                aria-pressed={active}
                onClick={() => toggleKind(kind)}
                className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 font-medium transition hover:bg-accent"
                style={{ color: active ? meta.color : '#a1a1aa', opacity: active ? 1 : 0.5 }}
                title={`${active ? 'Ocultar' : 'Mostrar'} ${meta.label}`}
              >
                <span className="[&>svg]:h-3 [&>svg]:w-3">{meta.icon}</span>
                <span className={active ? '' : 'line-through'}>{meta.label} ({sessionCounts[kind]})</span>
              </button>
            )
          })}
        </div>
      </div>
      </>)}
    </section>
  )
}
