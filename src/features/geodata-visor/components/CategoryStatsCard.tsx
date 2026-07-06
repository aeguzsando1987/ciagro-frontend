/**
 * Tarjeta de categorías de % de aplicación (Visor de Datos · aspersión).
 *
 * Muestra, por cada categoría del semáforo de % de aplicación, su **% de área** y su
 * **área en ha**, y actúa como filtro: cada fila es un toggle que comparte el mismo
 * estado (`checkedBuckets`) que la barra inferior del mapa, de modo que marcar/desmarcar
 * aquí oculta/muestra esos rectángulos en el mapa (y sincroniza con la barra inferior).
 *
 * Es presentacional: recibe los datos ya calculados desde `AspersionMap`. El % se calcula
 * sobre la suma de las categorías mostradas (base = área con meta válida), por lo que los
 * porcentajes suman ~100%. Los puntos sin meta (`sin_meta`) no están en `legendDefs`, así
 * que quedan fuera por construcción.
 */
import { areaShareByBucket, formatHa } from '../lib/aspersionMap.helpers'

export interface CategoryStatsEntry {
  key: string
  label: string
  color: string
  /** Rango legible de la categoría (p. ej. "95–105%"). Opcional. */
  range?: string
}

interface CategoryStatsCardProps {
  legendDefs: CategoryStatsEntry[]
  areaByBucket: Record<string, number>
  checkedBuckets: Set<string>
  onToggle: (key: string) => void
}

/** Formatea un porcentaje es-MX con 1 decimal (NaN → '—'). */
function formatPct(value: number): string {
  if (!Number.isFinite(value)) return '—'
  return `${value.toLocaleString('es-MX', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
}

export function CategoryStatsCard({ legendDefs, areaByBucket, checkedBuckets, onToggle }: CategoryStatsCardProps) {
  const keys = legendDefs.map((d) => d.key)
  const shares = areaShareByBucket(areaByBucket, keys)
  const totalHa = keys.reduce((acc, k) => acc + (areaByBucket[k] ?? 0), 0)

  return (
    <div className="relative w-full min-h-0 flex flex-col rounded-md border bg-background/85 shadow-lg backdrop-blur-sm">
      <div className="flex items-center justify-between gap-1 border-b px-2 py-1.5">
        <h3 className="text-xs font-semibold">% de aplicación por categoría</h3>
        <span className="text-[10px] text-muted-foreground">Total: {formatHa(totalHa)} ha</span>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-1.5">
        <ul className="space-y-1">
          {legendDefs.map((def) => {
            const checked = checkedBuckets.has(def.key)
            return (
              <li key={def.key}>
                <button
                  type="button"
                  onClick={() => onToggle(def.key)}
                  className="flex w-full items-center gap-1.5 rounded px-1 py-1 text-left text-xs hover:bg-accent"
                >
                  {/* Checkbox visual con ✓ interno (mismo patrón que la barra inferior) */}
                  <span
                    className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border-2 transition-colors"
                    style={{ borderColor: def.color, backgroundColor: checked ? def.color : 'transparent' }}
                  >
                    {checked && <span className="leading-none text-white" style={{ fontSize: 10 }}>✓</span>}
                  </span>
                  {/* Pastilla de color */}
                  <span
                    className="inline-block h-3 w-3 shrink-0 rounded-sm"
                    style={{ backgroundColor: checked ? def.color : '#d1d5db' }}
                  />
                  <span className={`min-w-0 flex-1 truncate ${checked ? '' : 'text-muted-foreground line-through'}`}>
                    {def.label}
                    {def.range && <span className="ml-1 text-muted-foreground">{def.range}</span>}
                  </span>
                  <span className={`shrink-0 tabular-nums ${checked ? 'font-medium' : 'text-muted-foreground'}`}>
                    {formatPct(shares[def.key] ?? 0)} · {formatHa(areaByBucket[def.key])} ha
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
