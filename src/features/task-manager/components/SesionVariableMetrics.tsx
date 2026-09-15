import { LoadingState } from '@/components/ui/loading-state'
import { Metric, MetricGrid } from '../panel/SesionShell'
import { pickHeadlineMetrics, type MetricSesionType, type VariableLike } from '../lib/sesionMetrics'

interface Props {
  /** Titulo de la rejilla, propio de cada tipo ("Resumen de la aplicación"). */
  title: string
  type: MetricSesionType
  variables: VariableLike[] | undefined
  pointsCount: number | undefined
  isLoading: boolean
  error: unknown
}

/**
 * Las tarjetas informativas de una sesion, iguales a las de Rendimiento.
 *
 * Solo presenta: cada modal trae sus datos con su propio hook de /variable-stats/, porque
 * son tres endpoints distintos. La eleccion de que variables son titulares vive en
 * lib/sesionMetrics.ts, separada para poder probarla sin montar React.
 */
export function SesionVariableMetrics({
  title,
  type,
  variables,
  pointsCount,
  isLoading,
  error,
}: Props) {
  if (isLoading) {
    return <LoadingState compact label="Cargando resumen…" className="justify-start p-0 text-xs" />
  }
  if (error) {
    return <p className="text-xs text-muted-foreground">No se pudo cargar el resumen.</p>
  }

  const metricas = pickHeadlineMetrics(variables, type)
  // Una sesion sin puntos no tiene nada que resumir; la ficha ya dice que hay cero.
  if (!metricas.length) return null

  return (
    <MetricGrid
      title={title}
      subtitle={
        pointsCount ? `${pointsCount.toLocaleString('es-MX')} puntos importados` : undefined
      }
    >
      {metricas.map((metrica) => (
        <Metric key={metrica.key} label={metrica.label} value={metrica.value} />
      ))}
    </MetricGrid>
  )
}
