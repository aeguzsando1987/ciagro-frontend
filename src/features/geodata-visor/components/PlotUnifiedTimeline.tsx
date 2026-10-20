// CIAGRO_LINEA_PRO_REFINEMENT_20261020: SOLO sesiones
import { useEffect, useMemo, useRef, useState } from 'react'
import { useIsFetching } from '@tanstack/react-query'
import {
  Bug,
  ChevronDown,
  ChevronUp,
  PanelLeftClose,
  PanelLeftOpen,
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
import { incompleteSessionsNotice, type TreeSession } from '../lib/plotSessionTree'
import type { SessionKind, VisorSession } from '../types'

interface PlotUnifiedTimelineProps {
  plotId: string
  selectedSession?: VisorSession | null
  onSelectSession: (session: VisorSession) => void
  defaultCollapsed?: boolean
  mode?: 'parcel' | 'cycle'
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
  return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(2) : '\u2014'
}


function ParcelStackedTimeline({
  range,
  events,
  selectedSession,
  onSelectSession,
  compact,
}: {
  range: { start: number; end: number } | null
  events: TreeSession[]
  selectedSession: VisorSession | null
  onSelectSession: (session: VisorSession) => void
  compact: boolean
}) {
  const span = range ? Math.max(DAY_MS, range.end - range.start) : DAY_MS
  const guides = range
    ? Array.from({ length: 7 }, (_, index) => ({
        position: (index / 6) * 100,
        label: new Intl.DateTimeFormat('es-MX', {
          month: 'short',
          year: 'numeric',
        }).format(new Date(range.start + (span * index) / 6)),
      }))
    : []

  const populatedKinds = KIND_ORDER.filter((kind) =>
    events.some((event) => event.kind === kind)
  )

  if (populatedKinds.length === 0) {
    return (
      <div className="px-3 py-2 text-center text-[10px] text-muted-foreground">
        Sin sesiones con datos cargados para este filtro.
      </div>
    )
  }

  return (
    <div className="px-3 pb-1 pt-0.5" aria-label="Resumen agrícola apilado por parcela">
      <div className="flex h-5 items-center">
        <div className="w-36 shrink-0" />
        <div className="relative h-full min-w-0 flex-1">
          {guides.map((guide, index) => (
            <span
              key={index}
              className="absolute top-1 whitespace-nowrap text-[9px] text-muted-foreground"
              style={{
                left: String(guide.position) + '%',
                transform: index === 0
                  ? 'none'
                  : index === guides.length - 1
                    ? 'translateX(-100%)'
                    : 'translateX(-50%)',
              }}
            >
              {guide.label}
            </span>
          ))}
        </div>
      </div>

      {populatedKinds.map((kind) => {
        const meta = KIND_META[kind]
        const kindEvents = events.filter((event) => event.kind === kind)
        const repeats = new Map<string, number>()

        return (
          <div key={kind} className="flex h-[26px] items-center border-t border-border-light">
            <div
              className="flex w-36 shrink-0 items-center gap-1.5 truncate pr-2 text-[10px] font-medium"
              style={{ color: meta.color }}
            >
              <span className="[&>svg]:h-3.5 [&>svg]:w-3.5">{meta.icon}</span>
              <span className="truncate">{meta.label} ({kindEvents.length})</span>
            </div>

            <div className="relative h-[26px] min-w-0 flex-1 bg-muted/[0.06]">
              {guides.map((guide, index) => (
                <span
                  key={index}
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-y-0 border-l border-dashed border-border-light"
                  style={{ left: String(guide.position) + '%' }}
                />
              ))}

              {range && kindEvents.map((session) => {
                const position = xPercent(session.date, range)
                if (position === null) return null

                const date = session.date ?? ''
                const repeat = repeats.get(date) ?? 0
                repeats.set(date, repeat + 1)
                const offset = repeat === 0
                  ? 0
                  : (repeat % 2 ? 1 : -1) * Math.ceil(repeat / 2) * (compact ? 6 : 8)
                const selected =
                  selectedSession?.id === session.id &&
                  selectedSession?.kind === session.kind

                return (
                  <button
                    key={session.kind + ':' + session.id}
                    type="button"
                    className={`absolute z-10 -translate-x-1/2 rounded-full border-2 transition hover:scale-125 focus:outline-none focus:ring-2 ${compact ? 'top-[8px] h-2.5 w-2.5' : 'top-[6px] h-3.5 w-3.5'}`}
                    style={{
                      left: String(position) + '%',
                      marginLeft: offset,
                      borderColor: meta.color,
                      background: meta.color,
                      boxShadow: selected ? '0 0 0 2px #111827' : undefined,
                    }}
                    aria-label={meta.label + ', ' + longDate(session.date)}
                    title={meta.label + ' · ' + longDate(session.date)}
                    onClick={() => onSelectSession({
                      id: session.id,
                      date: session.date,
                      kind: session.kind,
                    })}
                  />
                )
              })}
            </div>
          </div>
        )
      })}

      {!range && (
        <p className="pt-2 text-center text-[10px] text-muted-foreground">
          No hay sesiones fechadas para este filtro.
        </p>
      )}
    </div>
  )
}

export function PlotUnifiedTimeline({
  plotId,
  selectedSession = null,
  onSelectSession,
  mode = 'parcel',
}: PlotUnifiedTimelineProps) {
  const plotTree = usePlotSessionTree(plotId)
  const ndviQuery = useNdviTimeline(plotId)
  const [activeKinds, setActiveKinds] = useState<Set<TimelineKind>>(() => new Set(KIND_ORDER))
  const [selectedCycle, setSelectedCycle] = useState<string>('all')
  const [cyclePickedByUser, setCyclePickedByUser] = useState(false)
  // CIAGRO_LINEAPRO_ONLY_UI_STATE_20261020: el ciclo se controla solo en memoria durante el uso de esta vista.
  const [isPlaying, setIsPlaying] = useState(false)
  const [playCursor, setPlayCursor] = useState<number | null>(null)
  const [detailRequested, setDetailRequested] = useState(false)
  const [scrubPercent, setScrubPercent] = useState<number | null>(null)
  // CIAGRO_SESSION_FOCUSED_LAYOUT_20261020: panel vertical SOLO en ciclo/sesión.
  const [sessionFiltersCollapsed, setSessionFiltersCollapsed] = useState(() => {
    try { return typeof window !== 'undefined' && window.localStorage.getItem('ciagro.timeline.session.filters.collapsed') === '1' }
    catch { return false }
  })
  const toggleSessionFilters = () => {
    setSessionFiltersCollapsed((value) => {
      try { window.localStorage.setItem('ciagro.timeline.session.filters.collapsed', value ? '0' : '1') }
      catch { /* Persistencia opcional. */ }
      return !value
    })
  }

  // CIAGRO_TIMELINE_COMPACT_LIVE_V1
  const liveSeekRef = useRef({ key: '', time: 0 })
  const displayMode = mode === 'cycle' || detailRequested ? 'cycle' : 'parcel'

  const [collapsedByMode, setCollapsedByMode] = useState<Record<'parcel' | 'cycle', boolean>>(() => {
    const stored = (key: string) => {
      try {
        return typeof window !== 'undefined' && window.localStorage.getItem(key) === '1'
      } catch {
        return false
      }
    }
    return {
      parcel: false,
      cycle: stored('ciagro.timeline.cycle.collapsed'),
    }
  })
  useEffect(() => {
    if (displayMode !== 'parcel') return
    setCollapsedByMode((previous) =>
      previous.parcel ? { ...previous, parcel: false } : previous
    )
  }, [displayMode, plotId])

  const isCollapsed = collapsedByMode[displayMode]
  const toggleCollapsed = () => {
    setCollapsedByMode((previous) => {
      const value = !previous[displayMode]
      try {
        if (displayMode === 'cycle') {
          window.localStorage.setItem('ciagro.timeline.cycle.collapsed', value ? '1' : '0')
        }
      } catch {
        // El visor sigue funcionando si el almacenamiento está bloqueado.
      }
      return { ...previous, [displayMode]: value }
    })
  }

  const sessions = plotTree.sessions
  // FASE PAG: si el backend declara mas sesiones de las que llegaron, se avisa.
  const incompleteNotice = incompleteSessionsNotice(plotTree.total, plotTree.missing)
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
    if (cyclePickedByUser || selectedCycle !== 'all' || cycles.length === 0) return
    const selectedCycleValue = selectedSession ? cycleBySessionId.get(selectedSession.id) : null
    setSelectedCycle(selectedCycleValue || cycles[0] || 'all')
  }, [cycleBySessionId, cycles, selectedCycle, selectedSession, cyclePickedByUser])

  useEffect(() => {
    if (!selectedSession || selectedSession.kind === 'soil_map') return
    // Conservar cualquier ciclo elegido manualmente.
    if (cyclePickedByUser) return
    const cycle = cycleBySessionId.get(selectedSession.id)
    if (cycle && cycle !== selectedCycle) setSelectedCycle(cycle)
  }, [cycleBySessionId, selectedSession, cyclePickedByUser, selectedCycle])


  useEffect(() => {
    setDetailRequested(false)
    setScrubPercent(null)
    setCyclePickedByUser(false)
  }, [plotId, mode])

  useEffect(() => {
    setScrubPercent(null)
  }, [selectedCycle])

  const cycleSessions = useMemo(
    () => sessions.filter((session) => {
      if (selectedCycle === 'all') return true

      // La etiqueta program_cycle de headers viejos puede venir vacía o desfasada.
      // El Programa hijo ya define una ventana real (reference_start/end), así que
      // cualquier sesión fechada dentro de esa ventana pertenece visualmente al ciclo.
      if ((session.cycle?.trim() || null) === selectedCycle) return true
      if (isInsideSelectedCycle(session.date)) return true

      // Suelo no pertenece al ciclo como entidad, pero sólo se dibuja si su fecha cae
      // dentro del eje del ciclo seleccionado; nunca debe estirar el rango a otro aÁ±o.
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

  const expectedCurves = useMemo(() => {
    const references = new Map<string, {
      item: NdviTimelineItem
      start: number
      end: number
    }>()

    for (const item of ndviForCycle) {
      if (
        !item.ndvi_reference ||
        item.ndvi_reference.values.length < 2 ||
        !item.reference_start ||
        !item.reference_end
      ) continue

      const start = dateMs(item.reference_start)
      const end = dateMs(item.reference_end)

      if (start === null || end === null || end < start) continue

      const cycleKey =
        item.productive_cycle_id ||
        cycleBySessionId.get(item.id) ||
        item.reference_start + ':' + item.reference_end

      const key =
        cycleKey + '|' + item.reference_start + '|' + item.reference_end

      if (!references.has(key)) {
        references.set(key, { item, start, end })
      }
    }

    return [...references.entries()]
      .map(([key, { item, start, end }]) => {
        const points = Array.from({ length: 40 }, (_, index) => {
          const date = isoFromMs(
            start + ((end - start) * index) / 39
          )

          const value = expectedNdviAtDate(
            date,
            item.reference_start,
            item.reference_end,
            item.ndvi_reference
          )

          return value === null ? null : { date, value }
        }).filter(
          (point): point is { date: string; value: number } =>
            point !== null
        )

        return { key, points }
      })
      .filter(({ points }) => points.length >= 2)
  }, [ndviForCycle, cycleBySessionId])

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

  // Ocultamos sólo en la línea de tiempo: nunca borramos headers ni registros.
  // NDVI puede tener points_count=0 y valores NDVI válidos (incluso valor 0.00).
  const sessionsWithData = useMemo(
    () => cycleEvents.filter((session) => {
      if (session.kind === 'ndvi') {
        return ndviById.get(session.id)?.has_ndvi === true
      }
      return Number.isFinite(session.points_count) && session.points_count > 0
    }),
    [cycleEvents, ndviById]
  )

  const sessionCounts = useMemo(() => {
    const counts = Object.fromEntries(
      KIND_ORDER.map((kind) => [kind, 0])
    ) as Record<TimelineKind, number>

    for (const session of sessionsWithData) {
      counts[session.kind] += 1
    }

    return counts
  }, [sessionsWithData])
  const visibleSessions = useMemo(
    () => sessionsWithData.filter((session) => activeKinds.has(session.kind)),
    [activeKinds, sessionsWithData]
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




  const selectedPlayableIndex = selectedSession
    ? playable.findIndex(
        (item) => item.id === selectedSession.id &&
                  item.kind === selectedSession.kind
      )
    : -1

  const currentIndex = selectedPlayableIndex >= 0
    ? selectedPlayableIndex
    : Math.max(0, Math.min(playCursor ?? 0, playable.length - 1))

  const relativePercent = (date: string | null | undefined): number => {
    if (!range) return 0
    const ms = dateMs(date)
    if (ms === null) return 0
    return Math.max(0, Math.min(100,
      ((ms - range.start) /
       Math.max(DAY_MS, range.end - range.start)) * 100
    ))
  }

  const progressPct = scrubPercent ??
    relativePercent(
      selectedSession?.date ?? playable[currentIndex]?.date ?? null
    )

  const seekTo = (index: number) => {
    const safe = Math.max(0, Math.min(playable.length - 1, index))
    const session = playable[safe]
    if (!session) return
    stopPlay()
    setPlayCursor(safe)
    onSelectSession({
      id: session.id,
      date: session.date,
      kind: session.kind,
    })
  }

  const commitSeek = (percent: number) => {
    if (!range || playable.length === 0) return

    const target = range.start +
      (percent / 100) * Math.max(DAY_MS, range.end - range.start)

    let nearest = 0
    let bestDistance = Number.POSITIVE_INFINITY

    playable.forEach((session, index) => {
      const ms = dateMs(session.date)
      if (ms === null) return
      const distance = Math.abs(ms - target)
      if (distance < bestDistance) {
        bestDistance = distance
        nearest = index
      }
    })

    seekTo(nearest)
    setScrubPercent(null)
  }


  const previewSeekAtPercent = (percent: number) => {
    if (!range || playable.length === 0) return;

    const target =
      range.start +
      (percent / 100) *
      Math.max(DAY_MS, range.end - range.start);

    let nearest = -1;
    let distance = Number.POSITIVE_INFINITY;

    playable.forEach((session, index) => {
      const ms = dateMs(session.date);
      if (ms === null) return;

      const delta = Math.abs(ms - target);
      if (delta < distance) {
        nearest = index;
        distance = delta;
      }
    });

    if (nearest < 0) return;

    const session = playable[nearest];
    if (!session) return;

    const key = session.kind + ':' + session.id;

    // Evita solicitar dos veces seguidas la misma sesion.
    if (liveSeekRef.current.key === key) return;

    // Reduce la cantidad de consultas durante movimientos
    // rapidos del mouse. Maximo aprox. 7 cambios por segundo.
    const now = Date.now();

    if (now - liveSeekRef.current.time < 140) {
      return;
    }

    liveSeekRef.current = {
      key,
      time: now,
    };

    // Actualiza el reproductor y solicita el nuevo mapa
    // mientras el usuario sigue arrastrando.
    seekTo(nearest);
  };

  if (plotTree.isLoading || ndviQuery.isLoading) {
    return (
      <div className="flex h-40 items-center justify-center gap-2 rounded-xl border bg-background text-xs text-muted-foreground">
        <GpaLoader size="xs" /> Cargando línea de tiempo de la parcela...
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
  const chartHeight = mode === 'cycle' ? 73 : 100
  const padX = 48
  const padY = 10
  const padPercent = (padX / chartWidth) * 100

  // CIAGRO_TIMELINE_FINAL_V1
  const selectedGuide = (() => {
    if (!range || selectedSession?.kind !== 'ndvi' ||
        !activeKinds.has('ndvi')) return null

    const item = ndviById.get(selectedSession.id)
    const ms = dateMs(item?.session_date)

    if (!item || typeof item.mean !== 'number' ||
        !Number.isFinite(item.mean) || ms === null ||
        ms < range.start || ms > range.end) return null

    const x = chartXPercent(item.session_date, range, padPercent)
    if (x === null) return null

    const y = padY +
      (1 - Math.max(0, Math.min(1, item.mean))) *
      (chartHeight - padY * 2)

    return {
      x,
      top: (y / chartWidth) * 100,
    }
  })()
  const ndviCurveVisible = activeKinds.has('ndvi')
  const realPath = range && ndviCurveVisible
    ? curvePath(realNdvi, range, chartWidth, chartHeight, padX, padY)
    : ''
  const expectedPaths = range && ndviCurveVisible
    ? expectedCurves.map(({ key, points }) => ({
        key,
        path: curvePath(points, range, chartWidth, chartHeight, padX, padY),
      }))
    : []

  const axisLabels = range
    ? Array.from({ length: 7 }, (_, index) => {
        const ms = range.start + ((range.end - range.start) * index) / 6
        const rawPercent = (index / 6) * 100
        return {
          left: `${padPercent + (rawPercent / 100) * (100 - padPercent * 2)}%`,
          label: shortDate(isoFromMs(ms)),
          month: new Date(ms).toLocaleDateString('es-MX', {
            month: 'long',
            timeZone: 'UTC',
          }),
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

  const chooseCycle = (cycle: string) => {
    stopPlay()
    setScrubPercent(null)
    setCyclePickedByUser(true)
    setSelectedCycle(cycle)
    setPlayCursor(null)
    if (cycle === 'all') {
      // El usuario eligió explícitamente mostrar todos los ciclos.
      return
    }
    // CIAGRO_FIX_PARCEL_CYCLES_MULTI_EXPECTED_20261015
    // En Parcela, el selector solo filtra la linea apilada.
    if (mode === 'parcel' && !detailRequested) return
    // Se prioriza la primera sesión CON DATOS de ese ciclo.
    const candidates = [
      ...sessions.filter((s) => s.cycle?.trim() === cycle && s.date && s.kind !== 'ndvi' && s.points_count > 0)
        .map((s) => ({ id: s.id, kind: s.kind, date: s.date })),
      ...ndviItems.filter((s) => cycleBySessionId.get(s.id) === cycle && s.session_date && s.has_ndvi)
        .map((s) => ({ id: s.id, kind: 'ndvi' as const, date: s.session_date })),
    ].filter((s): s is { id: string; kind: TimelineKind; date: string } => !!s.date)
      .sort((a, b) => a.date.localeCompare(b.date) || KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind))
    if (candidates[0]) onSelectSession(candidates[0])
  }

  return (
    <section
      className="flex min-h-0 shrink-0 flex-col overflow-hidden rounded-xl border bg-background shadow-sm"

    >
      <div className={mode === 'cycle' ? 'flex flex-wrap items-center justify-between gap-1 px-2 py-1' : 'flex flex-wrap items-start justify-between gap-2 px-3 pb-1.5 pt-2'}>
        <div>
          <h3 className={mode === 'cycle' ? 'text-xs font-semibold' : 'text-sm font-semibold'}>
            {displayMode === 'parcel'
              ? 'Línea de tiempo agrícola · Parcela'
              : 'Línea de tiempo de índice vegetativo'}
            {displayMode === 'cycle' && referenceItem?.crop_name
              ? ' · ' + referenceItem.crop_name
              : ''}
          </h3>
          {mode !== 'cycle' && <p className="text-[10px] text-muted-foreground">
            {displayMode === 'parcel'
              ? 'Resumen por tipo de sesión. Todas las filas comparten el mismo eje de fechas.'
              : 'Todos los eventos comparten el mismo eje de fechas; cada marcador abre su mapa.'}
          </p>}
          {incompleteNotice && (
            <p role="status" className="text-[10px] font-medium text-warning-foreground">
              {incompleteNotice}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <select
            value={selectedCycle}
            onChange={(event) => chooseCycle(event.target.value)}
            className="h-8 max-w-[260px] rounded-md border bg-background px-2 text-[10px] font-medium"
            aria-label="Ciclo productivo"
          >
            <option value="all">Todos los ciclos</option>
            {cycles.map((cycle) => <option key={cycle} value={cycle}>{cycleLabel(cycle)}</option>)}
          </select>
          {mode === 'parcel' && (
            <button
              type="button"
              onClick={() => { stopPlay(); setDetailRequested((value) => !value) }}
              className="h-8 rounded-md border px-2 text-[10px] font-medium hover:bg-accent"
            >
              {detailRequested ? 'Vista parcela' : 'Ver ciclo'}
            </button>
          )}
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
            onClick={toggleCollapsed}
            className="inline-flex h-8 items-center gap-1 rounded-md border px-2 text-[10px] font-medium hover:bg-accent"
            aria-expanded={!isCollapsed}
          >
            {isCollapsed ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
            {isCollapsed ? 'Mostrar línea de tiempo' : 'Ocultar línea de tiempo'}
          </button>
        </div>
      </div>


      <div className="min-w-0">
      {!isCollapsed && (displayMode === 'parcel' ? (
        <ParcelStackedTimeline
          range={range}
          events={sessionsWithData}
          compact={selectedCycle === 'all'}
          selectedSession={selectedSession}
          onSelectSession={(session) => {
            stopPlay()
            onSelectSession(session)
          }}
        />
      ) : (<>
      <div className={mode === 'cycle' ? 'flex min-w-0 flex-col gap-2 px-2 pb-2 sm:flex-row' : ''}>
        {mode === 'cycle' && (
          <aside
            aria-label="Filtros de eventos del lote"
            className={`flex shrink-0 flex-col rounded-lg border border-default bg-background transition-[width] duration-150 ${sessionFiltersCollapsed ? 'sm:w-9' : 'sm:w-40'}`}
          >
            <button
              type="button"
              onClick={toggleSessionFilters}
              aria-expanded={!sessionFiltersCollapsed}
              aria-label={sessionFiltersCollapsed ? 'Mostrar filtros de eventos' : 'Ocultar filtros de eventos'}
              className="flex h-7 w-full items-center justify-between gap-1 rounded-md px-1.5 text-[10px] font-semibold hover:bg-accent"
            >
              {sessionFiltersCollapsed
                ? <PanelLeftOpen className="h-4 w-4 shrink-0" />
                : <><span>Eventos del lote</span><PanelLeftClose className="h-4 w-4 shrink-0" /></>}
            </button>
            {!sessionFiltersCollapsed && (
              <div className="grid grid-cols-2 gap-0.5 border-t border-border-light p-1 sm:grid-cols-1">
                {KIND_ORDER.map((kind) => {
                  const meta = KIND_META[kind]
                  const count = sessionCounts[kind]
                  const active = activeKinds.has(kind)
                  return (
                    <button
                      key={kind}
                      type="button"
                      disabled={count === 0}
                      aria-pressed={active && count > 0}
                      onClick={() => toggleKind(kind)}
                      title={`${active ? 'Ocultar' : 'Mostrar'} ${meta.label}`}
                      className="flex min-w-0 items-center gap-1 rounded-md px-1 py-1 text-left text-[10px] hover:bg-accent disabled:cursor-default disabled:opacity-45"
                      style={{ color: meta.color }}
                    >
                      <span className="shrink-0">{meta.icon}</span>
                      <span className={`min-w-0 flex-1 truncate ${active ? '' : 'line-through'}`}>{meta.label} ({count})</span>
                      <span aria-hidden="true" className={`flex h-3 w-3 shrink-0 items-center justify-center rounded-sm border ${active && count > 0 ? 'border-blue-600 bg-blue-600 text-white' : 'border-muted'}`}>
                        {active && count > 0 ? '✓' : ''}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </aside>
        )}
        <div className={mode === 'cycle' ? 'min-w-0 flex-1 overflow-y-auto overflow-x-hidden' : ''} style={mode === 'cycle' ? { maxHeight: 'min(30dvh, 245px)' } : undefined}>

      <div className={mode === 'cycle' ? 'mx-1 mb-0.5 flex min-h-7 flex-wrap items-center gap-x-2 gap-y-0.5 rounded-md border bg-muted/20 px-2 py-0.5 text-[10px]' : 'mx-3 mb-1 flex min-h-9 flex-wrap items-center gap-x-4 gap-y-1.5 rounded-md border bg-muted/20 px-3 py-1.5 text-[11px]'}>
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
            <span>Diferencia: <strong style={{ color: selectedDifference !== null && selectedDifference < 0 ? '#ef4444' : '#16a34a' }}>{selectedDifference === null ? '\u2014' : `${selectedDifference >= 0 ? '+' : ''}${selectedDifference.toFixed(2)}`}</strong></span>
            <span>Etapa: <strong>{selectedStage?.label ?? '\u2014'}</strong>{selectedStage?.description ? ` · ${selectedStage.description}` : ''}</span>
            <span className="inline-flex items-center gap-1 font-semibold" style={{ color: performanceMeta.color }}>
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: performanceMeta.color }} />
              {performanceMeta.label}
            </span>
          </>
        ) : (
          <span className="text-muted-foreground">Sin sesiones NDVI para este ciclo.</span>
        )}
      </div>

      <div className={mode === 'cycle' ? 'border-t bg-muted/[0.08] px-1.5 pb-0.5 pt-0.5' : 'border-t bg-muted/[0.08] px-3 pb-1.5 pt-1.5'}>
        {realNdvi.length > 0 && (
        <div className="mb-0.5 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3 text-[9px]">
            <strong>Índice de vegetación (NDVI)</strong>
            <span className="inline-flex items-center gap-1 text-blue-600"><span className="w-5 border-t-2 border-dashed border-blue-500" />Esperado</span>
            <span className="inline-flex items-center gap-1 text-green-700"><span className="w-5 border-t-2 border-green-700" />Real</span>
            <span className="text-muted-foreground">{realNdvi.length} sesiones</span>
          </div>
          {!referenceItem && <span className="text-[9px] text-muted-foreground">Sin referencia NDVI configurada para este ciclo.</span>}
        </div>
        )}

        {range && sessionsWithData.length > 0 ? (
          <>
            <div className="relative" style={{ containerType: 'inline-size' }}>
            {realNdvi.length > 0 && (
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
              {expectedPaths.map((curve) => (
                <path
                  key={curve.key}
                  d={curve.path}
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth="2"
                  strokeDasharray="6 5"
                />
              ))}
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
            )}


            {playable.length > 0 && range && (
              <div
                className="relative h-9 border-t"
                aria-label="Control de avance temporal"
              >
                <button
                  type="button"
                  onClick={() => seekTo(currentIndex - 1)}
                  disabled={currentIndex <= 0}
                  className="absolute left-0 top-1 z-20 flex h-8 w-7 items-center justify-center rounded border bg-background text-[11px] disabled:opacity-30"
                  aria-label="Retroceder una sesion"
                >
                  &#9664;
                </button>

                <input
                  type="range"
                  min={0}
                  max={1000}
                  step={1}
                  value={Math.round(progressPct * 10)}
                  disabled={playable.length <= 1}
                  onPointerDown={stopPlay}
                  onChange={(event) => {
                    stopPlay()
                    const nextPercent =
                      Number(event.currentTarget.value) / 10

                    setScrubPercent(nextPercent)
                    previewSeekAtPercent(nextPercent)
                  }}
                  onPointerUp={(event) => {
                    commitSeek(Number(event.currentTarget.value) / 10)
                  }}
                  onKeyUp={(event) => {
                    commitSeek(Number(event.currentTarget.value) / 10)
                  }}
                  onBlur={(event) => {
                    if (scrubPercent !== null) {
                      commitSeek(Number(event.currentTarget.value) / 10)
                    }
                  }}
                  onPointerCancel={() => setScrubPercent(null)}
                  aria-label="Adelantar o retroceder por fecha"
                  className="absolute top-[15px] z-10 h-[7px] cursor-pointer appearance-none rounded-full outline-none disabled:cursor-default [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-transparent [&::-webkit-slider-thumb]:bg-transparent [&::-webkit-slider-thumb]:shadow-sm [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-transparent [&::-moz-range-thumb]:bg-transparent"
                  style={{
                    left: String(padPercent) + '%',
                    width: String(100 - padPercent * 2) + '%',
                    background:
                      'linear-gradient(to right, ' +
                      '#16813a 0%, #16813a ' + progressPct + '%, ' +
                      '#d4d4d8 ' + progressPct + '%, #d4d4d8 100%)',
                  }}
                />

                {selectedSession && (
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute z-30 flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 bg-white shadow-sm"
                    style={{
                      top: '19px',
                      left: (padPercent + (progressPct / 100) * (100 - padPercent * 2)) + '%',
                      color: KIND_META[selectedSession.kind].color,
                      borderColor: KIND_META[selectedSession.kind].color,
                      boxShadow: '0 0 0 4px rgba(22,129,58,0.12)',
                    }}
                  >
                    <span className="[&>svg]:h-4 [&>svg]:w-4">
                      {KIND_META[selectedSession.kind].icon}
                    </span>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => seekTo(currentIndex + 1)}
                  disabled={currentIndex >= playable.length - 1}
                  className="absolute right-0 top-1 z-20 flex h-8 w-7 items-center justify-center rounded border bg-background text-[11px] disabled:opacity-30"
                  aria-label="Adelantar una sesion"
                >
                  &#9654;
                </button>
              </div>
            )}

            <div className={mode === 'cycle' ? 'relative h-[25px]' : 'relative h-[30px]'} aria-label="Eventos de la parcela en la línea de tiempo">
              {axisLabels.map((item) => (
                <span
                  key={item.left}
                  className="absolute top-0 -translate-x-1/2 whitespace-nowrap text-center text-[8px] leading-3 text-muted-foreground"
                  style={{ left: item.left }}
                >
                  <span className="block font-medium text-foreground/75">
                    {item.month.charAt(0).toUpperCase() + item.month.slice(1)}
                  </span>
                  <span className="block">{item.label}</span>
                </span>
              ))}

              {(selectedSession?.date || playable[currentIndex]?.date) && (
                <span
                  className="pointer-events-none absolute top-[15px] z-20 -translate-x-1/2 whitespace-nowrap rounded-full bg-green-700 px-2 py-0.5 text-[9px] font-semibold text-white shadow-sm"
                  style={{
                    left: (padPercent + (progressPct / 100) * (100 - padPercent * 2)) + '%',
                  }}
                >
                  {longDate(selectedSession?.date ?? playable[currentIndex]?.date)}
                </span>
              )}

              {visibleEvents.map(({ session, stackIndex }) => {
                const left = chartXPercent(session.date, range, padPercent)
                if (left === null) return null
                const meta = KIND_META[session.kind]
                const selected = selectedSession?.id === session.id
                // Nunca ocultamos eventos que comparten fecha. Los repartimos en dos
                // alturas y aplicamos un pequeÁ±o desplazamiento horizontal a partir del
                // tercer elemento para que todos sigan siendo visibles/clicables.
                const horizontalOffset = stackIndex === 0
                  ? 0
                  : (stackIndex % 2 === 1 ? -1 : 1) * Math.ceil(stackIndex / 2) * 20
                const top = -26
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
                      opacity: selected ? 0 : 1,
                    }}
                    title={`${longDate(session.date)} · ${sessionTitle(session, ndviById)} · ${session.points_count} puntos`}
                    aria-label={`${meta.label}, ${longDate(session.date)}`}
                  >
                    <span className="[&>svg]:h-3 [&>svg]:w-3">{meta.icon}</span>
                  </button>
                )
              })}
            </div>
            {selectedGuide && (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute z-[1] border-l border-dashed border-green-700/60"
                style={{
                  left: String(selectedGuide.x) + '%',
                  top: String(selectedGuide.top) + 'cqw',
                  bottom: '48px',
                }}
              />
            )}
            </div>
          </>
        ) : (
          <div className="flex min-h-10 items-center justify-center text-[10px] text-muted-foreground">Sin sesiones con datos cargados para este filtro.</div>
        )}

        {mode !== 'cycle' && <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-0.5 pt-0.5 text-[10px]">
          {KIND_ORDER.filter((kind) => sessionCounts[kind] > 0).map((kind) => {
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
        </div>}
      </div>
        </div>
      </div>
      </>))}
      </div>
    </section>
  )
}
