import { usePhytoSessionStats } from '../hooks/usePhytoSessionStats'

interface Props {
  headerId: string
}

/** Semáforo de presencia: baja / advertencia / crítica. */
const PRESENCE_META = [
  { key: 'low', label: 'Baja', dot: 'bg-emerald-500' },
  { key: 'warning', label: 'Advertencia', dot: 'bg-amber-500' },
  { key: 'critical', label: 'Crítica', dot: 'bg-red-500' },
] as const

function pct(part: number, total: number): string {
  if (!total) return '0%'
  return `${Math.round((part / total) * 100)}%`
}

/**
 * Resumen estadístico de una sesión fitosanitaria con checkpoints cargados.
 * Análogo categórico al resumen de aspersión: totales, semáforo de presencia y
 * desglose por problema fitosanitario. No renderiza nada si no hay checkpoints.
 */
export function PhytoStatsCard({ headerId }: Props) {
  const { data, isLoading, error } = usePhytoSessionStats(headerId)

  if (isLoading) {
    return <p className="text-xs text-muted-foreground">Cargando estadísticas…</p>
  }
  if (error || !data) {
    return <p className="text-xs text-muted-foreground">No se pudo cargar el resumen.</p>
  }
  if (data.checkpoints_count === 0) {
    return null
  }

  const total = data.checkpoints_count

  return (
    <div className="space-y-3 rounded border p-3">
      <p className="text-sm font-medium">
        Resumen de monitoreo
        <span className="ml-2 text-xs font-normal text-muted-foreground">
          {total.toLocaleString('es-MX')} puntos ·{' '}
          {data.targets_visited}/{data.targets_count} objetivos visitados
        </span>
      </p>

      {/* Semáforo de presencia */}
      <div className="grid grid-cols-3 gap-2">
        {PRESENCE_META.map((p) => {
          const n = data.presence[p.key]
          return (
            <div key={p.key} className="rounded border p-2 text-center">
              <div className="flex items-center justify-center gap-1.5">
                <span className={`inline-block h-2 w-2 rounded-full ${p.dot}`} />
                <span className="text-xs text-muted-foreground">{p.label}</span>
              </div>
              <p className="mt-0.5 text-sm font-semibold">
                {n} <span className="text-xs font-normal text-muted-foreground">({pct(n, total)})</span>
              </p>
            </div>
          )
        })}
      </div>

      {/* Desglose por problema fitosanitario */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="text-left text-muted-foreground">
            <tr>
              <th className="py-1 pr-3 font-medium">Problema</th>
              <th className="py-1 px-2 font-medium">Tipo</th>
              <th className="py-1 px-2 text-right font-medium">Puntos</th>
              <th className="py-1 px-2 text-right font-medium">Cantidad</th>
              <th className="py-1 pl-2 text-right font-medium">Críticos</th>
            </tr>
          </thead>
          <tbody>
            {data.by_issue.map((iss) => (
              <tr key={iss.id} className="border-t">
                <td className="py-1 pr-3 font-medium">{iss.name}</td>
                <td className="py-1 px-2 text-muted-foreground">{iss.type}</td>
                <td className="py-1 px-2 text-right">{iss.count}</td>
                <td className="py-1 px-2 text-right">{iss.qty_total.toLocaleString('es-MX')}</td>
                <td className="py-1 pl-2 text-right">
                  {iss.critical > 0 ? (
                    <span className="font-semibold text-red-600 dark:text-red-400">{iss.critical}</span>
                  ) : (
                    <span className="text-muted-foreground">0</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
