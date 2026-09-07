import { useId, useState } from 'react'
import { ChevronDown, Mountain } from 'lucide-react'
import {
  useSoilMapElevation,
  type SoilElevationAnalysis,
} from '@/features/task-manager/hooks/useSoilMapElevation'
import { formatSoilValue } from '@/features/task-manager/lib/soilMapLayers'

const REASONS: Record<string, string> = {
  insufficient_points: 'Faltan muestras de elevación',
  collinear_points: 'Las muestras no cubren una superficie',
  missing_boundary: 'Falta el límite de la parcela',
  invalid_boundary: 'El límite de la parcela necesita revisión',
  insufficient_surface: 'Cobertura insuficiente para calcular pendiente',
  conflicting_elevations: 'Hay alturas incompatibles en una misma ubicación',
  possible_outliers: 'Revisar posibles valores atípicos de elevación',
  no_predominant_direction: 'Sin dirección predominante clara',
  flat: 'Sin cambio de elevación apreciable',
}

function metres(value: number | null) {
  return value == null ? '—' : formatSoilValue(value, 'm')
}

function percent(value: number | undefined) {
  return value == null ? '—' : `${value.toLocaleString('es-MX', { maximumFractionDigits: 1 })}%`
}

export function SoilElevationDetails({ data }: { data: SoilElevationAnalysis }) {
  const { elevation, trend, slope, quality } = data
  if (elevation.count === 0) {
    return (
      <p className="px-3 py-2 text-xs text-muted-foreground">
        Sin elevaciones en este mapeo de suelo.
      </p>
    )
  }
  return (
    <div className="px-3 py-2.5 text-xs">
      <div className="space-y-2.5">
        <div>
          <h3 className="font-semibold">Elevación</h3>
          <p className="mt-0.5 font-medium tabular-nums">
            {metres(elevation.min_m)} – {metres(elevation.max_m)}
          </p>
          <p className="text-muted-foreground">
            Media: {metres(elevation.mean_m)} · Desnivel: {metres(elevation.range_m)}
          </p>
        </div>
        <div className="border-t pt-2">
          <h3 className="font-semibold">Relieve</h3>
          <p className="mt-0.5 text-muted-foreground">
            {trend.status === 'available'
              ? `Descenso predominante: ${trend.ascent_direction} → ${trend.descent_direction}`
              : (REASONS[trend.status] ?? 'Sin tendencia disponible')}
          </p>
          <p className="text-[10px] text-muted-foreground">Mapeo del {data.mapping_date}</p>
        </div>
        <div className="border-t pt-2">
          <h3 className="font-semibold">Pendiente estimada</h3>
          {slope.status === 'available' ? (
            <>
              <p className="mt-0.5 tabular-nums">
                Media: {percent(slope.mean_pct)} · Máxima: {percent(slope.max_pct)}
              </p>
              <details className="mt-0.5 text-muted-foreground">
                <summary className="cursor-pointer">
                  Rangos · cobertura: {percent(slope.coverage_pct)} de la parcela
                </summary>
                <p className="mt-1">
                  Mínima: {percent(slope.min_pct)} · Media ponderada por superficie cubierta.
                </p>
                <ul className="mt-1 space-y-0.5">
                  {slope.distribution?.map((range) => (
                    <li key={range.min_pct} className="flex justify-between gap-3 tabular-nums">
                      <span>
                        {range.max_pct == null
                          ? `≥ ${range.min_pct}%`
                          : `${range.min_pct}–${range.max_pct}%`}
                      </span>
                      <span>
                        {formatSoilValue(range.area_ha, 'ha')} · {percent(range.plot_percentage)} de
                        la parcela
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-1">
                  Sin estimar: {formatSoilValue(slope.uncovered_area_ha ?? 0, 'ha')}. Precisión
                  limitada por el muestreo.
                </p>
              </details>
            </>
          ) : (
            <p className="mt-0.5 text-muted-foreground">
              {REASONS[slope.status] ?? 'No disponible'}
            </p>
          )}
        </div>
      </div>
      {(quality.possible_outliers > 0 ||
        quality.conflicting_locations > 0 ||
        quality.outside_plot > 0 ||
        quality.missing_elevation > 0) && (
        <p className="mt-1 text-[10px] text-muted-foreground">
          {quality.possible_outliers > 0 &&
            `${quality.possible_outliers} posibles valores atípicos. `}
          {quality.conflicting_locations > 0 &&
            `${quality.conflicting_locations} ubicaciones con alturas incompatibles. `}
          {quality.outside_plot > 0 &&
            `${quality.outside_plot} muestras fuera de la parcela excluidas del resumen. `}
          {quality.missing_elevation > 0 &&
            `${quality.missing_elevation} muestras sin elevación válida.`}
        </p>
      )}
    </div>
  )
}

export function SoilElevationSummary({ sessionId }: { sessionId: string }) {
  const [expanded, setExpanded] = useState(false)
  const detailsId = useId()
  const { data, isLoading, error } = useSoilMapElevation(sessionId)
  return (
    <section
      className="pointer-events-auto flex min-h-0 w-72 max-w-full flex-col overflow-hidden rounded-md border bg-background/90 shadow-lg backdrop-blur-sm"
      aria-label="Resumen de elevación de la parcela"
    >
      <button
        type="button"
        aria-label="Elevación y relieve"
        aria-expanded={expanded}
        aria-controls={detailsId}
        onClick={() => setExpanded((previous) => !previous)}
        className="flex w-full shrink-0 items-start gap-2 rounded-md px-3 py-2 text-left hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <Mountain className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
        <span className="min-w-0 flex-1 text-xs">
          <span className="block font-semibold">Elevación y relieve</span>
          {!expanded && (
            <span className="mt-0.5 block tabular-nums text-muted-foreground">
              {isLoading
                ? 'Calculando elevación y relieve…'
                : error
                  ? 'No se pudo cargar la elevación.'
                  : data?.elevation.count
                    ? `${metres(data.elevation.min_m)} – ${metres(data.elevation.max_m)}`
                    : 'Sin elevaciones en este mapeo de suelo.'}
            </span>
          )}
        </span>
        <ChevronDown
          className={`mt-0.5 size-3.5 shrink-0 text-muted-foreground transition-transform ${expanded ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>
      <div
        id={detailsId}
        hidden={!expanded}
        className="min-h-0 overflow-y-auto overscroll-contain border-t"
      >
        {isLoading ? (
          <p className="px-3 py-2 text-xs text-muted-foreground">Calculando elevación y relieve…</p>
        ) : error ? (
          <p className="px-3 py-2 text-xs text-muted-foreground">No se pudo cargar la elevación.</p>
        ) : data ? (
          <SoilElevationDetails data={data} />
        ) : null}
      </div>
    </section>
  )
}
