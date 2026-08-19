/**
 * Panel de sesiones de mapeo de suelo de una parcela.
 *
 * Lista las sesiones ordenadas como las entrega el backend, permite filtrarlas
 * por `mapping_date` en el cliente y emite una selección `kind: 'soil_map'`.
 */
import { useMemo, useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { GpaLoader } from '@/components/ui/gpa-loader'
import { useSoilMapSessionHeaders } from '../hooks/useSoilMapSessionHeaders'
import { isAllowedSession } from '../lib/advancedSearch'
import type { VisorSession } from '../types'

interface SoilMapSessionsPanelProps {
  plotId: string
  selectedSessionId: string | null
  onSelectSession: (session: VisorSession) => void
  /** `true`: tarjeta sobre el mapa; `false`: elemento dentro de una columna. */
  floating?: boolean
  /**
   * Ids permitidos por la busqueda avanzada (fase AS). `null`/ausente = sin busqueda,
   * se listan todas las sesiones de la parcela como siempre.
   */
  allowedIds?: string[] | null
}

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pendiente',
  in_progress: 'En progreso',
  loaded: 'Cargado',
  completed: 'Completado',
  cancelled: 'Cancelado',
}

export function SoilMapSessionsPanel({
  plotId,
  selectedSessionId,
  onSelectSession,
  floating = true,
  allowedIds = null,
}: SoilMapSessionsPanelProps) {
  const { data, isLoading } = useSoilMapSessionHeaders(plotId)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [collapsed, setCollapsed] = useState(false)

  const sessions = useMemo(() => {
    const list = data ?? []
    return list.filter((session) => {
      if (!isAllowedSession(session.id, allowedIds)) return false
      const date = session.mapping_date ?? ''
      if (from && date && date < from) return false
      if (to && date && date > to) return false
      return true
    })
  }, [data, from, to, allowedIds])

  return (
    <div
      className={`flex flex-col rounded-md border bg-background/85 shadow-lg backdrop-blur-sm ${
        floating
          ? 'absolute right-2 top-2 z-10 max-h-[calc(100%-1rem)] w-52'
          : 'relative max-h-[50%] min-h-0 w-full'
      }`}
    >
      <div className="border-b px-2 py-1.5">
        <div className="flex items-center justify-between gap-1">
          <h3 className="text-xs font-semibold">Sesiones de mapeo de suelo</h3>
          <button
            type="button"
            aria-label={collapsed ? 'Expandir' : 'Minimizar'}
            onClick={() => setCollapsed((current) => !current)}
            className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-accent"
          >
            {collapsed ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronUp className="h-3.5 w-3.5" />
            )}
          </button>
        </div>

        {!collapsed && (
          <>
            <div className="mt-1.5 flex items-end gap-1 text-[10px]">
              <label className="flex min-w-0 flex-col gap-0.5">
                <span className="text-muted-foreground">Desde</span>
                <input
                  type="date"
                  value={from}
                  onChange={(event) => setFrom(event.target.value)}
                  className="w-full rounded border bg-background px-1 py-0.5 text-[10px]"
                />
              </label>
              <label className="flex min-w-0 flex-col gap-0.5">
                <span className="text-muted-foreground">Hasta</span>
                <input
                  type="date"
                  value={to}
                  onChange={(event) => setTo(event.target.value)}
                  className="w-full rounded border bg-background px-1 py-0.5 text-[10px]"
                />
              </label>
            </div>
            {(from || to) && (
              <button
                type="button"
                onClick={() => {
                  setFrom('')
                  setTo('')
                }}
                className="mt-1 text-[10px] text-muted-foreground hover:text-foreground"
              >
                Limpiar filtro
              </button>
            )}
          </>
        )}
      </div>

      {!collapsed && (
        <div className="min-h-0 flex-1 overflow-auto p-1">
          {isLoading ? (
            <div className="flex items-center gap-2 px-2 py-2 text-xs text-muted-foreground">
              <GpaLoader size="xs" /> Cargando sesiones…
            </div>
          ) : sessions.length === 0 ? (
            <p className="px-2 py-2 text-xs text-muted-foreground">
              {data && data.length > 0
                ? 'Sin sesiones en el rango.'
                : 'Esta parcela no tiene sesiones de mapeo de suelo.'}
            </p>
          ) : (
            <ul className="space-y-1">
              {sessions.map((session) => {
                const selected = session.id === selectedSessionId
                const count = Number(session.points_count ?? 0)
                return (
                  <li key={session.id}>
                    <button
                      type="button"
                      onClick={() =>
                        onSelectSession({
                          id: session.id,
                          date: session.mapping_date ?? null,
                          kind: 'soil_map',
                        })
                      }
                      className={`w-full rounded px-2 py-1.5 text-left text-xs hover:bg-accent ${
                        selected ? 'bg-accent font-medium' : ''
                      }`}
                    >
                      <div>{session.mapping_date ?? 'Sin fecha'}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {count ? `${count} pts` : 'sin puntos'}
                        {session.status && session.status !== 'completed'
                          ? ` · ${STATUS_LABEL[session.status] ?? session.status}`
                          : ''}
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
