import { useMemo, useState } from 'react'
import {
  Bug,
  CalendarRange,
  ChevronDown,
  ChevronUp,
  FlaskConical,
  Layers,
  Leaf,
  RotateCw,
} from 'lucide-react'

import { Skeleton } from '@/components/ui/skeleton'
import { GpaLoader } from '@/components/ui/gpa-loader'
import { useAspersionSessionHeaders } from '../hooks/useAspersionSessionHeaders'
import { useNdviSessionHeaders } from '../hooks/useNdviSessionHeaders'
import { usePhytoSessionHeaders } from '../hooks/usePhytoSessionHeaders'
import { useSoilMapSessionHeaders } from '../hooks/useSoilMapSessionHeaders'
import { isAllowedSession } from '../lib/advancedSearch'
import type { SessionKind, VisorSession } from '../types'

interface AllowedSessions {
  aspersion?: string[] | null
  phyto?: string[] | null
  ndvi?: string[] | null
  soil_map?: string[] | null
}

interface PlotSessionsPanelProps {
  plotId: string
  selectedSessionId: string | null
  onSelectSession: (session: VisorSession) => void
  allowedIds?: AllowedSessions
}

interface SessionItem {
  id: string
  kind: SessionKind
  date: string | null
  detail: string
}

interface SessionSection {
  kind: SessionKind
  label: string
  emptyDescription: string
  icon: React.ReactNode
  items: SessionItem[]
  loading: boolean
  error: boolean
  retry: () => void
}

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pendiente',
  processing: 'Procesando',
  pending_mapping: 'Pendiente de mapear',
  in_progress: 'En progreso',
  loaded: 'Cargado',
  completed: 'Completado',
  cancelled: 'Cancelado',
  error: 'Error',
}

function pointDetail(value: unknown) {
  const count = Number(value ?? 0)
  return count > 0 ? `${count.toLocaleString('es-MX')} pts` : 'Sin puntos'
}

function withStatus(detail: string, status: unknown, completedStatus: string) {
  const value = typeof status === 'string' ? status : ''
  if (!value || value === completedStatus) return detail
  return `${detail} · ${STATUS_LABEL[value] ?? value}`
}

function inDateRange(date: string | null, from: string, to: string) {
  if (!date) return true
  if (from && date < from) return false
  if (to && date > to) return false
  return true
}

export function PlotSessionsPanel({
  plotId,
  selectedSessionId,
  onSelectSession,
  allowedIds = {},
}: PlotSessionsPanelProps) {
  const aspersion = useAspersionSessionHeaders(plotId)
  const phyto = usePhytoSessionHeaders(plotId)
  const ndvi = useNdviSessionHeaders(plotId)
  const soilMap = useSoilMapSessionHeaders(plotId)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [expanded, setExpanded] = useState<Record<SessionKind, boolean>>({
    aspersion: true,
    phyto: false,
    ndvi: false,
    soil_map: false,
  })

  const sections = useMemo<SessionSection[]>(() => {
    const filter = (item: SessionItem) =>
      isAllowedSession(item.id, allowedIds[item.kind] ?? null) && inDateRange(item.date, from, to)

    return [
      {
        kind: 'aspersion',
        label: 'Aspersión',
        emptyDescription: 'Esta parcela todavía no cuenta con registros de aspersión.',
        icon: <Layers className="h-4 w-4" />,
        items: (aspersion.data ?? [])
          .map((session) => ({
            id: session.id,
            kind: 'aspersion' as const,
            date: session.aspersion_date ?? null,
            detail: withStatus(pointDetail(session.points_count), session.import_status, 'done'),
          }))
          .filter(filter),
        loading: aspersion.isLoading,
        error: aspersion.isError,
        retry: () => void aspersion.refetch(),
      },
      {
        kind: 'phyto',
        label: 'Fitosanitarias',
        emptyDescription: 'Esta parcela todavía no cuenta con registros fitosanitarios.',
        icon: <Bug className="h-4 w-4" />,
        items: (phyto.data ?? [])
          .map((session) => ({
            id: session.id,
            kind: 'phyto' as const,
            date: session.estimated_start_date ?? null,
            detail: withStatus(pointDetail(session.checkpoints_count), session.status, 'completed'),
          }))
          .filter(filter),
        loading: phyto.isLoading,
        error: phyto.isError,
        retry: () => void phyto.refetch(),
      },
      {
        kind: 'ndvi',
        label: 'NDVI',
        emptyDescription: 'Esta parcela todavía no cuenta con registros NDVI.',
        icon: <Leaf className="h-4 w-4" />,
        items: (ndvi.data ?? [])
          .map((session) => ({
            id: session.id,
            kind: 'ndvi' as const,
            date: session.session_date ?? null,
            detail: withStatus(pointDetail(session.points_count), session.import_status, 'done'),
          }))
          .filter(filter),
        loading: ndvi.isLoading,
        error: ndvi.isError,
        retry: () => void ndvi.refetch(),
      },
      {
        kind: 'soil_map',
        label: 'Mapeo de suelo',
        emptyDescription: 'Esta parcela todavía no cuenta con registros de mapeo de suelo.',
        icon: <FlaskConical className="h-4 w-4" />,
        items: (soilMap.data ?? [])
          .map((session) => ({
            id: session.id,
            kind: 'soil_map' as const,
            date: session.mapping_date ?? null,
            detail: withStatus(pointDetail(session.points_count), session.status, 'completed'),
          }))
          .filter(filter),
        loading: soilMap.isLoading,
        error: soilMap.isError,
        retry: () => void soilMap.refetch(),
      },
    ]
  }, [allowedIds, aspersion, from, ndvi, phyto, soilMap, to])

  const total = sections.reduce((sum, section) => sum + section.items.length, 0)
  const hasDateFilter = Boolean(from || to)

  return (
    <aside className="absolute bottom-3 right-3 top-3 z-10 flex w-64 flex-col overflow-hidden rounded-xl border border-default bg-surface/95 shadow-lg backdrop-blur-sm">
      <div className="border-b border-default px-3 py-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Sesiones</h3>
            <p className="text-xs text-secondary">
              {total} {total === 1 ? 'registro visible' : 'registros visibles'}
            </p>
          </div>
          <button
            type="button"
            aria-label="Filtrar sesiones por fecha"
            aria-expanded={filtersOpen}
            onClick={() => setFiltersOpen((value) => !value)}
            className={`flex h-10 w-10 items-center justify-center rounded-md transition-colors duration-150 hover:bg-surface-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 ${
              hasDateFilter ? 'bg-primary-soft text-brand' : 'text-muted'
            }`}
          >
            <CalendarRange className="h-4 w-4" />
          </button>
        </div>

        {filtersOpen && (
          <div className="mt-3 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <label className="space-y-1 text-xs font-medium text-secondary">
                Desde
                <input
                  type="date"
                  value={from}
                  onChange={(event) => setFrom(event.target.value)}
                  className="h-9 w-full rounded-md border border-default bg-surface px-2 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </label>
              <label className="space-y-1 text-xs font-medium text-secondary">
                Hasta
                <input
                  type="date"
                  value={to}
                  onChange={(event) => setTo(event.target.value)}
                  className="h-9 w-full rounded-md border border-default bg-surface px-2 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </label>
            </div>
            {hasDateFilter && (
              <button
                type="button"
                onClick={() => {
                  setFrom('')
                  setTo('')
                }}
                className="text-xs font-medium text-brand hover:text-primary-hover"
              >
                Limpiar fechas
              </button>
            )}
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {sections.map((section) => {
          const isExpanded = expanded[section.kind]
          return (
            <section key={section.kind} className="border-b border-border-light last:border-b-0">
              <button
                type="button"
                aria-expanded={isExpanded}
                onClick={() =>
                  setExpanded((current) => ({
                    ...current,
                    [section.kind]: !current[section.kind],
                  }))
                }
                className="flex min-h-11 w-full items-center gap-2 px-3 text-left transition-colors duration-150 hover:bg-surface-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/20"
              >
                <span className="text-muted">{section.icon}</span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                  {section.label}
                </span>
                <span className="text-xs tabular-nums text-secondary">{section.items.length}</span>
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4 text-muted" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted" />
                )}
              </button>

              {isExpanded && (
                <div className="px-2 pb-2">
                  {section.loading ? (
                    <div
                      role="status"
                      aria-label={`Cargando sesiones de ${section.label}`}
                      className="space-y-2 px-1 py-2"
                    >
                      <div className="flex items-center gap-2 text-xs font-medium text-secondary">
                        <GpaLoader size="xs" />
                        <span>Cargando sesiones…</span>
                      </div>
                      <Skeleton className="h-9 w-full" />
                      <Skeleton className="h-9 w-full" />
                    </div>
                  ) : section.error ? (
                    <div className="space-y-2 rounded-lg bg-danger-soft p-3">
                      <p className="text-xs leading-4 text-danger">
                        No pudimos cargar estas sesiones.
                      </p>
                      <button
                        type="button"
                        onClick={section.retry}
                        className="inline-flex items-center gap-1 text-xs font-medium text-danger hover:underline"
                      >
                        <RotateCw className="h-3 w-3" /> Reintentar
                      </button>
                    </div>
                  ) : section.items.length === 0 ? (
                    <div className="rounded-lg bg-surface-secondary px-3 py-2.5">
                      <p className="text-xs font-medium text-foreground">
                        No hay sesiones {section.label.toLocaleLowerCase('es-MX')}
                      </p>
                      <p className="mt-0.5 text-xs leading-4 text-secondary">
                        {section.emptyDescription}
                      </p>
                    </div>
                  ) : (
                    <ul className="space-y-1">
                      {section.items.map((item) => {
                        const selected = item.id === selectedSessionId
                        return (
                          <li key={item.id}>
                            <button
                              type="button"
                              onClick={() =>
                                onSelectSession({
                                  id: item.id,
                                  date: item.date,
                                  kind: item.kind,
                                })
                              }
                              className={`min-h-10 w-full rounded-lg px-3 py-2 text-left transition-colors duration-150 hover:bg-surface-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 ${
                                selected ? 'bg-primary-soft' : ''
                              }`}
                            >
                              <span className="block text-sm font-medium text-foreground">
                                {item.date ?? 'Sin fecha'}
                              </span>
                              <span className="mt-0.5 block text-xs text-secondary">
                                {item.detail}
                              </span>
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>
              )}
            </section>
          )
        })}
      </div>
    </aside>
  )
}
