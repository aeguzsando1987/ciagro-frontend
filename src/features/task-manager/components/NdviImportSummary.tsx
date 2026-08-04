import { useNdviVariableStats } from '../hooks/useNdviVariableStats'

interface Props {
  headerId: string
}

/**
 * Los indices vegetativos se mueven en rangos estrechos (NDRE varia ~0.27 de punta a
 * punta), asi que con dos decimales varias filas saldrian iguales. Tres distinguen sin
 * llenar la tabla de ruido.
 */
function fmt(v: number | null): string {
  return v === null
    ? '—'
    : v.toLocaleString('es-MX', { minimumFractionDigits: 3, maximumFractionDigits: 3 })
}

/** Resumen estadistico de los 15 indices de una sesion NDVI. */
export function NdviImportSummary({ headerId }: Props) {
  const { data, isLoading, error } = useNdviVariableStats(headerId)

  if (isLoading) {
    return <p className="text-xs text-muted-foreground">Cargando resumen…</p>
  }
  if (error || !data) {
    return <p className="text-xs text-muted-foreground">No se pudo cargar el resumen.</p>
  }

  return (
    <div className="space-y-2 rounded border p-3">
      <p className="text-sm font-medium">
        Resumen de índices
        <span className="ml-2 text-xs font-normal text-muted-foreground">
          {data.points_count.toLocaleString('es-MX')} puntos
        </span>
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="text-left text-muted-foreground">
            <tr>
              <th className="py-1 pr-3 font-medium">Índice</th>
              <th className="py-1 px-2 text-right font-medium">Media</th>
              <th className="py-1 px-2 text-right font-medium">Mín</th>
              <th className="py-1 px-2 text-right font-medium">Máx</th>
              <th className="py-1 px-2 text-right font-medium">Desv.</th>
              <th className="py-1 pl-2 text-right font-medium">n</th>
            </tr>
          </thead>
          <tbody>
            {data.variables.map((v) => (
              <tr key={v.key} className="border-t">
                <td className="py-1 pr-3">{v.label}</td>
                <td className="py-1 px-2 text-right font-medium tabular-nums">{fmt(v.mean)}</td>
                <td className="py-1 px-2 text-right tabular-nums">{fmt(v.min)}</td>
                <td className="py-1 px-2 text-right tabular-nums">{fmt(v.max)}</td>
                <td className="py-1 px-2 text-right tabular-nums">{fmt(v.stddev)}</td>
                <td className="py-1 pl-2 text-right tabular-nums text-muted-foreground">
                  {v.count}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
