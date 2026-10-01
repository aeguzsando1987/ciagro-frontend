import { useMemo, useState } from 'react'
import { CalendarRange, RotateCw, Sprout } from 'lucide-react'
import { GpaLoader } from '@/components/ui/gpa-loader'
import { Skeleton } from '@/components/ui/skeleton'
import { usePlantingMapHeaders } from '@/features/planting-map/hooks/usePlantingMapHeaders'
import type { VisorSession } from '../types'

interface Props {
  plotId: string
  selectedSessionId: string | null
  onSelectSession: (session: VisorSession) => void
  allowedIds?: string[] | null
}

function inDateRange(date: string | null, from: string, to: string) {
  if (!date) return true
  if (from && date < from) return false
  if (to && date > to) return false
  return true
}

export function PlantingMapSessionsPanel({
  plotId,
  selectedSessionId,
  onSelectSession,
  allowedIds = null,
}: Props) {
  const query = usePlantingMapHeaders(plotId)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)

  const sessions = useMemo(
    () => (query.data ?? [])
      .filter((session) => !allowedIds || allowedIds.includes(session.id))
      .filter((session) => inDateRange(session.planting_date ?? null, from, to))
      .sort((a, b) => (b.planting_date ?? '').localeCompare(a.planting_date ?? '')),
    [allowedIds, from, query.data, to],
  )

  return (
    <aside className="absolute bottom-3 right-3 top-3 z-20 flex w-64 flex-col overflow-hidden rounded-xl border border-white/30 bg-white/95 shadow-lg backdrop-blur-sm dark:bg-slate-950/95">
      <div className="border-b px-3 py-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-1.5">
              <Sprout className="h-4 w-4 text-emerald-700" />
              <h3 className="text-sm font-semibold">Sesiones de siembra</h3>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {sessions.length} {sessions.length === 1 ? 'registro visible' : 'registros visibles'}
            </p>
          </div>
          <button
            type="button"
            aria-label="Filtrar sesiones de siembra por fecha"
            onClick={() => setFiltersOpen((value) => !value)}
            className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
          >
            <CalendarRange className="h-4 w-4" />
          </button>
        </div>

        {filtersOpen && (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <label className="space-y-1 text-[11px] text-muted-foreground">
              Desde
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
                className="h-8 w-full rounded border bg-background px-1.5 text-xs text-foreground" />
            </label>
            <label className="space-y-1 text-[11px] text-muted-foreground">
              Hasta
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
                className="h-8 w-full rounded border bg-background px-1.5 text-xs text-foreground" />
            </label>
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {query.isLoading ? (
          <div className="space-y-2 p-1">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <GpaLoader size="xs" /> Cargando sesiones…
            </div>
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : query.isError ? (
          <div className="rounded-lg bg-destructive/5 p-3">
            <p className="text-xs text-destructive">No se pudieron cargar las sesiones.</p>
            <button type="button" onClick={() => void query.refetch()}
              className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-destructive hover:underline">
              <RotateCw className="h-3 w-3" /> Reintentar
            </button>
          </div>
        ) : sessions.length === 0 ? (
          <div className="rounded-lg bg-muted/60 p-3">
            <p className="text-xs font-medium">Sin sesiones de siembra</p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              No hay registros para esta parcela con el filtro actual.
            </p>
          </div>
        ) : (
          <ul className="space-y-1">
            {sessions.map((session) => {
              const selected = session.id === selectedSessionId
              return (
                <li key={session.id}>
                  <button type="button"
                    onClick={() => onSelectSession({
                      id: session.id,
                      date: session.planting_date ?? null,
                      kind: 'planting_map',
                    })}
                    className={`w-full rounded-lg px-3 py-2 text-left transition hover:bg-muted ${
                      selected ? 'bg-emerald-50 ring-1 ring-emerald-200 dark:bg-emerald-950/30' : ''
                    }`}>
                    <span className="block text-sm font-semibold">{session.planting_date ?? 'Sin fecha'}</span>
                    <span className="mt-0.5 block text-[11px] text-muted-foreground">
                      {Number(session.points_count ?? 0).toLocaleString('es-MX')} pts
                      {session.source_product ? ` · ${session.source_product}` : ''}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </aside>
  )
}
