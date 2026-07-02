/**
 * Semáforo de cobertura (5 buckets). El color viene del backend como nombre y se resuelve a
 * hex en `lib/semaforo.ts` (F3 / GAP-AC-004: no hardcodear rangos en el front). Muestra
 * área (ha) y % del área total por bucket.
 */
import type { StatsSnapshot } from '../types'
import { semaforoRows } from '../lib/semaforo'

function fmt(n: number | null, digits = 2): string {
  return n === null ? '—' : n.toLocaleString('es-MX', { maximumFractionDigits: digits })
}

export function SemaforoBadges({ stats }: { stats: StatsSnapshot }) {
  const rows = semaforoRows(stats)
  if (rows.length === 0) {
    return <p className="text-xs text-muted-foreground">Sin datos de clasificación.</p>
  }
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">Clasificación de cobertura</p>
      <ul className="space-y-1">
        {rows.map((r) => (
          <li key={r.key} className="flex items-center gap-2 text-sm">
            <span
              className="inline-block h-3 w-3 shrink-0 rounded-sm"
              style={{ backgroundColor: r.color }}
              aria-hidden
            />
            <span className="min-w-24 flex-1">{r.label}</span>
            <span className="tabular-nums text-muted-foreground">{fmt(r.areaHa)} ha</span>
            <span className="w-14 text-right tabular-nums font-medium">
              {fmt(r.pctAreaTotal, 1)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
