import type { SoilMapLegendEntry } from '@/features/task-manager/lib/soilMapLayers'
import { formatHa } from '../lib/aspersionMap.helpers'
import type { SoilBucketAreaStat } from '../lib/soilMapArea'

interface SoilMapStatsCardProps {
  layerLabel: string
  legendEntries: SoilMapLegendEntry[]
  bucketStats: Record<string, SoilBucketAreaStat>
  totalAreaHa: number | null
  checkedBuckets: Set<string>
  onToggle: (key: string) => void
}

function formatPercentage(value: number) {
  return `${value.toLocaleString('es-MX', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`
}

export function SoilMapStatsCard({
  layerLabel,
  legendEntries,
  bucketStats,
  totalAreaHa,
  checkedBuckets,
  onToggle,
}: SoilMapStatsCardProps) {
  return (
    <div className="relative flex min-h-0 w-full flex-col rounded-md border bg-background/85 shadow-lg backdrop-blur-sm">
      <div className="flex items-center justify-between gap-1 border-b px-2 py-1.5">
        <h3 className="truncate text-xs font-semibold">% de superficie · {layerLabel}</h3>
        <span className="shrink-0 text-[10px] text-muted-foreground">
          Total: {totalAreaHa != null ? formatHa(totalAreaHa) : '—'} ha
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-1.5">
        <ul className="space-y-1">
          {legendEntries.map((entry) => {
            const checked = checkedBuckets.has(entry.key)
            const stats = bucketStats[entry.key]
            return (
              <li key={entry.key}>
                <button
                  type="button"
                  aria-pressed={checked}
                  aria-label={`${checked ? 'Ocultar' : 'Mostrar'} ${entry.label}`}
                  onClick={() => onToggle(entry.key)}
                  className="flex w-full items-center gap-1.5 rounded px-1 py-1 text-left text-xs hover:bg-accent"
                >
                  <span
                    className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border-2"
                    style={{
                      borderColor: entry.color,
                      backgroundColor: checked ? entry.color : 'transparent',
                    }}
                  >
                    {checked && <span className="text-[10px] leading-none text-white">✓</span>}
                  </span>
                  <span
                    className="inline-block h-3 w-3 shrink-0 rounded-sm"
                    style={{ backgroundColor: checked ? entry.color : '#D1D5DB' }}
                  />
                  <span
                    className={`min-w-0 flex-1 truncate ${
                      checked ? '' : 'text-muted-foreground line-through'
                    }`}
                    title={entry.label}
                  >
                    {entry.label}
                  </span>
                  <span
                    className={`shrink-0 tabular-nums ${
                      checked ? 'font-medium' : 'text-muted-foreground'
                    }`}
                  >
                    {formatPercentage(stats?.percentage ?? 0)} ·{' '}
                    {stats?.areaHa != null ? formatHa(stats.areaHa) : '—'} ha
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
