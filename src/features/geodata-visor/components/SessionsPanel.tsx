/**
 * Panel de sesiones de aspersión de una parcela (use case §2.3.2.5).
 *
 * Tarjeta semitransparente flotante sobre el mapa: lista las sesiones de la parcela
 * ordenadas por fecha desc (tal como las entrega el backend) con un control de rango de
 * fechas que filtra la lista EN CLIENTE. Al hacer clic en una sesión se emite la
 * selección a nivel 'session'. Solo lectura.
 */
import { useMemo, useState } from 'react'
import { ChevronDown, ChevronUp, Loader2 } from 'lucide-react'
import { useAspersionSessionHeaders } from '../hooks/useAspersionSessionHeaders'

interface SessionsPanelProps {
  plotId: string
  selectedSessionId: string | null
  onSelectSession: (session: { id: string; date: string | null }) => void
  /**
   * `true` (default): tarjeta flotante absoluta arriba-derecha sobre el mapa.
   * `false`: ítem de columna (sin posicionamiento absoluto) para convivir con otras
   * tarjetas en una columna derecha (p. ej. la tarjeta de categorías a nivel sesión).
   */
  floating?: boolean
}

export function SessionsPanel({ plotId, selectedSessionId, onSelectSession, floating = true }: SessionsPanelProps) {
  const { data, isLoading } = useAspersionSessionHeaders(plotId)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [collapsed, setCollapsed] = useState(false)

  // Filtro por rango (fechas ISO YYYY-MM-DD → comparación lexicográfica válida).
  const sessions = useMemo(() => {
    const list = data ?? []
    return list.filter((s) => {
      const d = s.aspersion_date ?? ''
      if (from && d && d < from) return false
      if (to && d && d > to) return false
      return true
    })
  }, [data, from, to])

  return (
    <div
      className={`flex flex-col rounded-md border bg-background/85 shadow-lg backdrop-blur-sm ${
        floating
          ? 'absolute right-2 top-2 z-10 max-h-[calc(100%-1rem)] w-52'
          : 'relative w-full min-h-0 max-h-[50%]'
      }`}
    >
      <div className="border-b px-2 py-1.5">
        <div className="flex items-center justify-between gap-1">
          <h3 className="text-xs font-semibold">Sesiones de aspersión</h3>
          <button
            type="button"
            aria-label={collapsed ? 'Expandir' : 'Minimizar'}
            onClick={() => setCollapsed((c) => !c)}
            className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-accent"
          >
            {collapsed ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
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
                  onChange={(e) => setFrom(e.target.value)}
                  className="w-full rounded border bg-background px-1 py-0.5 text-[10px]"
                />
              </label>
              <label className="flex min-w-0 flex-col gap-0.5">
                <span className="text-muted-foreground">Hasta</span>
                <input
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="w-full rounded border bg-background px-1 py-0.5 text-[10px]"
                />
              </label>
            </div>
            {(from || to) && (
              <button
                type="button"
                onClick={() => { setFrom(''); setTo('') }}
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
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Cargando sesiones…
          </div>
        ) : sessions.length === 0 ? (
          <p className="px-2 py-2 text-xs text-muted-foreground">
            {data && data.length > 0 ? 'Sin sesiones en el rango.' : 'Esta parcela no tiene sesiones.'}
          </p>
        ) : (
          <ul className="space-y-1">
            {sessions.map((s) => {
              const selected = s.id === selectedSessionId
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => onSelectSession({ id: s.id, date: s.aspersion_date ?? null })}
                    className={`w-full rounded px-2 py-1.5 text-left text-xs hover:bg-accent ${
                      selected ? 'bg-accent font-medium' : ''
                    }`}
                  >
                    <div>{s.aspersion_date ?? 'Sin fecha'}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {s.points_count ? `${s.points_count} pts` : 'sin puntos'}
                      {s.import_status && s.import_status !== 'done' ? ` · ${s.import_status}` : ''}
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
