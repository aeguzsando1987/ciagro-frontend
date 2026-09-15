import { useAspersionVariableStats } from '../hooks/useAspersionVariableStats'
import { LoadingState } from '@/components/ui/loading-state'

interface Props {
  headerId: string
}

function fmt(v: number | null): string {
  return v === null ? '—' : v.toLocaleString('es-MX', { maximumFractionDigits: 2 })
}

/**
 * Detalle estadistico por variable de aspersion.
 * El titular (las tarjetas) lo pinta SesionVariableMetrics justo encima; esta tabla es el
 * desglose, por eso ya no repite el conteo de puntos ni se llama "resumen".
 */
export function AspersionImportSummary({ headerId }: Props) {
  const { data, isLoading, error } = useAspersionVariableStats(headerId)

  if (isLoading) {
    return <LoadingState compact label="Cargando resumen…" className="justify-start p-0 text-xs" />
  }
  if (error || !data) {
    return <p className="text-xs text-muted-foreground">No se pudo cargar el resumen.</p>
  }

  return (
    <div className="space-y-2 rounded border p-3">
      <p className="text-sm font-medium">
        Detalle por variable
        <span className="ml-2 text-xs font-normal text-muted-foreground">
          media, mínimo, máximo y desviación de cada variable
        </span>
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="text-left text-muted-foreground">
            <tr>
              <th className="py-1 pr-3 font-medium">Variable</th>
              <th className="px-2 py-1 text-right font-medium">Media</th>
              <th className="px-2 py-1 text-right font-medium">Mín</th>
              <th className="px-2 py-1 text-right font-medium">Máx</th>
              <th className="px-2 py-1 text-right font-medium">Desv.</th>
              <th className="py-1 pl-2 text-right font-medium">n</th>
            </tr>
          </thead>
          <tbody>
            {data.variables.map((v) => (
              <tr key={v.key} className="border-t">
                <td className="py-1 pr-3">{v.label}</td>
                <td className="px-2 py-1 text-right font-medium">{fmt(v.mean)}</td>
                <td className="px-2 py-1 text-right">{fmt(v.min)}</td>
                <td className="px-2 py-1 text-right">{fmt(v.max)}</td>
                <td className="px-2 py-1 text-right">{fmt(v.stddev)}</td>
                <td className="py-1 pl-2 text-right text-muted-foreground">{v.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
