/**
 * Panel de sesiones NDVI de una parcela — símil de SessionsPanel / PhytoSessionsPanel.
 *
 * Tarjeta flotante sobre el mapa: lista las sesiones NDVI de la parcela ordenadas por fecha
 * desc (tal como las entrega el backend) con filtro de rango de fechas EN CLIENTE. Al hacer
 * clic emite la selección a nivel 'session' con `kind: 'ndvi'`. Solo lectura.
 */
import { useMemo, useState } from 'react'
import { ChevronDown, ChevronUp, Loader2 } from 'lucide-react'
import { useNdviSessionHeaders } from '../hooks/useNdviSessionHeaders'
import type { VisorSession } from '../types'

interface NdviSessionsPanelProps {
  plotId: string
  selectedSessionId: string | null
  onSelectSession: (session: VisorSession) => void
  floating?: boolean
}

const IMPORT_LABEL: Record<string, string> = {
  pending: 'Sin importar',
  processing: 'Procesando',
  done: 'Cargado',
  error: 'Error',
  pending_mapping: 'Pendiente de mapear',
}

export function NdviSessionsPanel({ plotId, selectedSessionId, onSelectSession, floating = true }: NdviSessionsPanelProps) {
  const { data, isLoading } = useNdviSessionHeaders(plotId)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [collapsed, setCollapsed] = useState(false)

  const sessions = useMemo(() => {
    const list = data ?? []
    return list.filter((s) => {
      const d = s.session_date ?? ''
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
          <h3 className="text-xs font-semibold">Sesiones NDVI</h3>
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
              {data && data.length > 0 ? 'Sin sesiones en el rango.' : 'Esta parcela no tiene sesiones NDVI.'}
            </p>
          ) : (
            <ul className="space-y-1">
              {sessions.map((s) => {
                const selected = s.id === selectedSessionId
                const count = Number(s.points_count ?? 0)
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => onSelectSession({ id: s.id, date: s.session_date ?? null, kind: 'ndvi' })}
                      className={`w-full rounded px-2 py-1.5 text-left text-xs hover:bg-accent ${
                        selected ? 'bg-accent font-medium' : ''
                      }`}
                    >
                      <div>{s.session_date ?? 'Sin fecha'}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {count ? `${count} pts` : 'sin puntos'}
                        {s.import_status && s.import_status !== 'done'
                          ? ` · ${IMPORT_LABEL[s.import_status] ?? s.import_status}`
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
