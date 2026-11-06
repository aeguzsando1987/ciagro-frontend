import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { StatsSnapshot } from '../types'
import { historicalReferenceSchema, measurementRadarSchema, radarSchema, radarV2Schema, timelineSchema } from '../radarContract'

type Indicator = NonNullable<StatsSnapshot['radar']>['indicators'][number]
type Radar = NonNullable<StatsSnapshot['radar']>
type MeasurementRadar = NonNullable<StatsSnapshot['measurement_radar']>
type Timeline = NonNullable<StatsSnapshot['linea_tiempo']>

function number(value: number | string | null | undefined, digits = 2) {
  if (value === null || value === undefined || value === '') return '—'
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed.toLocaleString('es-MX', { maximumFractionDigits: digits }) : '—'
}

function dateTime(value?: string | null) {
  if (!value) return '—'
  // Date-only headers are calendar dates, not UTC instants (UTC would shift Mexico to yesterday).
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(Number(value.slice(0, 4)), Number(value.slice(5, 7)) - 1, Number(value.slice(8, 10)))
    : new Date(value)
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: value.includes('T') ? 'short' : undefined })
}

function RadarChart({ indicators }: { indicators: Indicator[] }) {
  const center = { x: 210, y: 165 }
  const radius = 100
  const angle = (index: number) => (-Math.PI / 2) + (index * Math.PI * 2) / 6
  const vertex = (index: number, value: number) => ({
    x: center.x + Math.cos(angle(index)) * radius * value / 100,
    y: center.y + Math.sin(angle(index)) * radius * value / 100,
  })
  const axes = indicators.slice(0, 6)
  const points = axes.map((indicator, index) => indicator.score === null ? null : vertex(index, indicator.score))
  const allScored = points.length === 6 && points.every(Boolean)

  return (
    <svg viewBox="0 0 420 340" role="img" aria-label="Gráfica radar de evaluación de aspersión" className="mx-auto w-full max-w-lg">
      <title>Calificaciones normalizadas de 0 a 100; los ejes sin datos suficientes quedan sin trazo.</title>
      {[20, 40, 60, 80, 100].map((level) => {
        const polygon = axes.map((_, index) => {
          const point = vertex(index, level)
          return `${point.x},${point.y}`
        }).join(' ')
        return <g key={level}><polygon points={polygon} fill="none" stroke="currentColor" strokeOpacity=".18" /><text x={center.x + 5} y={center.y - radius * level / 100} className="fill-current text-[9px]">{level}</text></g>
      })}
      {axes.map((indicator, index) => {
        const axis = vertex(index, 100)
        const labelPoint = vertex(index, 137)
        const measured = indicator.value === null ? 'Sin medición' : `${number(indicator.value, indicator.id === 'volume_ratio' ? 4 : 2)} ${indicator.unit}`
        const evaluation = indicator.score === null ? 'Sin puntuación' : `${number(indicator.score)} / 100`
        return <g key={indicator.id}>
          <line x1={center.x} y1={center.y} x2={axis.x} y2={axis.y} stroke="currentColor" strokeOpacity=".25" />
          {indicator.score === null && <circle cx={axis.x} cy={axis.y} r="3" fill="white" stroke="currentColor" strokeOpacity=".55"><title>{indicator.name}: {measured}; sin puntuación porque no hay referencia compatible.</title></circle>}
          <text x={labelPoint.x} y={labelPoint.y - 6} textAnchor="middle" className="fill-current text-[11px]">
            <tspan x={labelPoint.x}>{indicator.name}</tspan>
            <tspan x={labelPoint.x} dy="12" className="fill-muted-foreground text-[9px]">{measured}</tspan>
            <tspan x={labelPoint.x} dy="11" className={indicator.score === null ? 'fill-muted-foreground text-[8px]' : 'fill-green-700 text-[8px]'}>{evaluation}</tspan>
          </text>
        </g>
      })}
      {allScored ? <polygon points={points.map((p) => `${p!.x},${p!.y}`).join(' ')} fill="#16a34a" fillOpacity=".18" stroke="#15803d" strokeWidth="2" /> : null}
      {!allScored && axes.map((indicator, index) => {
        const next = (index + 1) % 6
        const current = points[index]
        const following = points[next]
        if (!current || !following) return null
        return <line key={`segment-${indicator.id}`} x1={current.x} y1={current.y} x2={following.x} y2={following.y} stroke="#15803d" strokeWidth="2" />
      })}
      {axes.map((indicator, index) => {
        const point = points[index]
        if (!point) return null
        return <g key={`point-${indicator.id}`}>
          <circle cx={point.x} cy={point.y} r="4" fill="#15803d"><title>{indicator.name}: {indicator.score}/100</title></circle>
          <text x={point.x} y={point.y - 8} textAnchor="middle" className="fill-foreground text-[9px]">{indicator.score}</text>
        </g>
      })}
    </svg>
  )
}

function MeasurementRadarChart({ radar }: { radar: MeasurementRadar }) {
  const center = { x: 210, y: 165 }
  const radius = 100
  const angle = (index: number) => (-Math.PI / 2) + (index * Math.PI * 2) / 6
  const vertex = (index: number, position: number) => ({ x: center.x + Math.cos(angle(index)) * radius * position / 100, y: center.y + Math.sin(angle(index)) * radius * position / 100 })
  const points = radar.indicators.map((item, index) => item.position === null ? null : vertex(index, item.position))
  return <svg viewBox="0 0 420 360" role="img" aria-label="Radar descriptivo de mediciones de aspersión" className="mx-auto w-full max-w-lg">
    <title>Posición de cada promedio dentro de su propia escala descriptiva; no representa puntuación.</title>
    {[20, 40, 60, 80, 100].map(level => <polygon key={level} points={radar.indicators.map((_, index) => { const point = vertex(index, level); return `${point.x},${point.y}` }).join(' ')} fill="none" stroke="currentColor" strokeOpacity=".18" />)}
    {radar.indicators.map((item, index) => {
      const axis = vertex(index, 100); const label = vertex(index, 140)
      return <g key={item.id}>
        <line x1={center.x} y1={center.y} x2={axis.x} y2={axis.y} stroke="currentColor" strokeOpacity=".25" />
        <text x={label.x} y={label.y - 8} textAnchor="middle" className="fill-current text-[11px]">
          <tspan x={label.x}>{item.name}</tspan>
          <tspan x={label.x} dy="12" className="fill-current text-[9px]">{number(item.value, item.id === 'volume_ratio' ? 4 : 2)} {item.unit}</tspan>
          <tspan x={label.x} dy="11" className="fill-muted-foreground text-[8px]">{item.scale_min === null ? 'Escala no disponible' : `${number(item.scale_min)}–${number(item.scale_max)} ${item.unit}`}</tspan>
        </text>
      </g>
    })}
    {points.map((point, index) => point && <circle key={`measurement-${radar.indicators[index]!.id}`} cx={point.x} cy={point.y} r="4" fill="#2563eb"><title>{radar.indicators[index]!.name}: {number(radar.indicators[index]!.value)} {radar.indicators[index]!.unit}; posición descriptiva {radar.indicators[index]!.position}/100.</title></circle>)}
    {points.every(Boolean) && <polygon points={points.map(point => `${point!.x},${point!.y}`).join(' ')} fill="#2563eb" fillOpacity=".14" stroke="#2563eb" strokeWidth="2" />}
  </svg>
}

function MeasurementsTable({ indicators, measurementRadar }: { indicators: Indicator[]; measurementRadar?: MeasurementRadar }) {
  const scales = new Map(measurementRadar?.indicators.map(item => [item.id, item]))
  return <div className="overflow-x-auto">
    <table className="w-full min-w-[660px] text-xs">
      <thead><tr className="border-b text-left"><th className="p-1">Indicador</th><th className="p-1">Promedio real</th><th className="p-1">Registros válidos</th><th className="p-1">Escala descriptiva</th><th className="p-1">Posición visual</th><th className="p-1">Referencia de evaluación</th></tr></thead>
      <tbody>{indicators.map((item) => {
        const stability = item.stability
        const scale = scales.get(item.id)
        return <tr key={item.id} className="border-b align-top">
          <td className="p-1 font-medium">{item.name}</td>
          <td className="p-1 tabular-nums">{number(item.value, item.id === 'volume_ratio' ? 4 : 2)} {item.unit}{item.converted_value && <span className="block text-muted-foreground">{number(item.converted_value.value)} {item.converted_value.unit}</span>}</td>
          <td className="p-1">{stability?.count ?? '—'}</td>
          <td className="p-1 tabular-nums">{scale?.scale_min === null || !scale ? 'No disponible' : <>{number(scale.scale_min)}–{number(scale.scale_max)} {item.unit}<span className="block text-muted-foreground">{scale.scale_source}</span></>}</td>
          <td className="p-1 tabular-nums">{scale?.position === null || scale?.position === undefined ? 'No disponible' : `${number(scale.position)} / 100`}<span className="block text-muted-foreground">No es score</span></td>
          <td className="p-1"><span className="font-medium">{item.score === null ? 'Sin referencia compatible' : item.status}</span><p className="mt-1 text-muted-foreground">{item.score === null ? item.opinion : 'Puntuación disponible en el modo Evaluación.'}</p></td>
        </tr>
      })}</tbody>
    </table>
    <p className="mt-2 text-xs text-muted-foreground">{measurementRadar?.method ?? 'Estos son valores físicos observados; no se presentan como puntuaciones.'}</p>
  </div>
}

function TimelineChart({ timeline }: { timeline: Timeline }) {
  const series = timeline.series ?? []
  const maxArea = Math.max(0, ...series.map((point) => point.area_acumulada_ha))
  const start = series.length ? Date.parse(series[0]!.at) : 0
  const span = series.length > 1 ? Date.parse(series[series.length - 1]!.at) - start : 0
  const x = (at: string) => 20 + (span > 0 ? (Date.parse(at) - start) / span : 0) * 260
  const path = series.length > 1 && maxArea > 0
    ? series.map((point, index) => `${index === 0 ? 'M' : 'L'} ${x(point.at)} ${90 - (point.area_acumulada_ha / maxArea) * 68}`).join(' ')
    : ''

  return (
    <div className="space-y-2 rounded-md border p-3">
      <h3 className="font-medium">Línea de tiempo de la aplicación</h3>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div><span className="text-muted-foreground">Inicio</span><div>{dateTime(timeline.start)}</div></div>
        <div><span className="text-muted-foreground">Fin</span><div>{dateTime(timeline.end)}</div></div>
        <div><span className="text-muted-foreground">Duración</span><div>
          {timeline.duration_seconds !== null && timeline.duration_seconds !== undefined
            ? `${number(timeline.duration_seconds / 3600)} h`
            : timeline.duration_days !== null && timeline.duration_days !== undefined
              ? `${number(timeline.duration_days, 0)} día(s) de calendario; duración de aplicación no disponible`
              : 'No disponible'}
        </div></div>
        <div><span className="text-muted-foreground">Registros temporales</span><div>{series.length ? `${series.length} intervalos horarios` : 'Sin marcas horarias'}</div></div>
      </div>
      {series.length > 1 && <svg viewBox="0 0 300 100" role="img" aria-label="Superficie acumulada por intervalo horario" className="h-24 w-full">
        <line x1="20" y1="90" x2="280" y2="90" stroke="currentColor" strokeOpacity=".3" />
        <path d={path} fill="none" stroke="#15803d" strokeWidth="2" />
      </svg>}
      <p className="text-xs text-muted-foreground">{timeline.status ?? 'No hay suficientes datos temporales.'}</p>
      {series.length > 0 && <div className="max-h-40 overflow-auto">
        <table className="w-full text-xs">
          <thead><tr className="text-left"><th>Hora</th><th>Área acum. (ha)</th><th>Vel. (km/h)</th><th>Presión (bar)</th><th>Caudal (L/s)</th></tr></thead>
          <tbody>{series.map((point) => <tr key={point.at} className="border-t">
            <td>{dateTime(point.at)}</td><td>{number(point.area_acumulada_ha)}</td><td>{number(point.speed_kmh)}</td><td>{number(point.pressure_bar)}</td><td>{number(point.flow_ls)}</td>
          </tr>)}</tbody>
        </table>
      </div>}
    </div>
  )
}

export function AspersionRadarEvaluation({ stats }: { stats: StatsSnapshot }) {
  const [view, setView] = useState<'measurements' | 'evaluation'>('measurements')
  const radar: Radar | undefined = stats.radar
  const measurementRadar = stats.measurement_radar
  const radarV2 = stats.radar_v2
  const timeline: Timeline | undefined = stats.linea_tiempo
  const toNumber = (value: number | string | null | undefined) => {
    if (value === null || value === undefined || value === '') return null
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  const plotArea = toNumber(stats.superficie_parcela_ha)
  const appliedArea = toNumber(stats.area_cobertura_ha)
  const coveragePercent = toNumber(stats.porcentaje_superficie_reportada)

  if ((radar != null && !radarSchema.safeParse(radar).success) ||
      (timeline != null && !timelineSchema.safeParse(timeline).success) ||
      (radarV2 != null && !radarV2Schema.safeParse(radarV2).success) ||
      (measurementRadar != null && !measurementRadarSchema.safeParse(measurementRadar).success) ||
      (stats.historical_reference != null && !historicalReferenceSchema.safeParse(stats.historical_reference).success)) {
    return <div role="alert" className="rounded border border-destructive p-4 text-sm">La evaluación recibida tiene un formato incorrecto. Vuelve a consultar el análisis; si persiste, revisa la versión del backend.</div>
  }

  if (!radar) return <Card><CardHeader><CardTitle className="text-base">Evaluación de aspersión</CardTitle></CardHeader>
    <CardContent className="text-sm text-muted-foreground">Este reporte todavía no incluye la evaluación radar. Sincroniza los datos del reporte para calcularla.</CardContent></Card>

  return <div className="space-y-4">
    <Card>
      <CardHeader><CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
        Aspersión — Mediciones y evaluación radar
        <span className="rounded bg-muted px-2 py-1 text-sm font-normal">{radar.score === null ? 'Sin calificación global' : `${number(radar.score)} / 100`} · {radar.status}</span>
      </CardTitle>
        <div className="flex gap-2" role="group" aria-label="Vista de radar">
          <button type="button" className={`rounded border px-3 py-1 text-sm ${view === 'measurements' ? 'bg-primary text-primary-foreground' : 'bg-background'}`} onClick={() => setView('measurements')}>Mediciones (6)</button>
          <button type="button" className={`rounded border px-3 py-1 text-sm ${view === 'evaluation' ? 'bg-primary text-primary-foreground' : 'bg-background'}`} onClick={() => setView('evaluation')}>Evaluación ({radar.evaluated_count}/6)</button>
        </div>
        <p className="text-sm text-muted-foreground">{view === 'measurements'
          ? 'Las seis mediciones reales se muestran aunque no exista catálogo compatible.'
          : `${radar.evaluated_count} de 6 indicadores tienen puntuación válida; ${radar.pending_count} no se trazan en la escala 0 a 100.`}</p>
        {radar.catalog_status === 'PROVISIONAL' && <p role="note" className="rounded border border-amber-300 bg-amber-50 p-2 text-sm text-amber-950">{radar.provisional_note ?? 'Rango provisional basado en histórico; no es evaluación técnica aprobada.'}</p>}
        {radar.catalog_status === 'APROBADO' && <p className="text-sm">Rangos técnicos aprobados.</p>}
      </CardHeader>
      <CardContent className={view === 'evaluation' ? 'grid gap-4 xl:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)]' : ''}>
        {view === 'measurements' ? <div className="grid gap-4 xl:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)]"><div className="min-w-0">
          {measurementRadar ? <MeasurementRadarChart radar={measurementRadar} /> : <p className="text-sm text-muted-foreground">Este backend aún no entrega la escala descriptiva del radar; los promedios siguen disponibles en la tabla.</p>}
          <p className="text-xs text-muted-foreground">Radar descriptivo de promedios: los radios usan la escala indicada junto a cada eje, no una calificación de eficiencia.</p>
        </div><MeasurementsTable indicators={radar.indicators} measurementRadar={measurementRadar} /></div> : <>
        <div className="min-w-0"><RadarChart indicators={radar.indicators} />
          <p className="text-xs text-muted-foreground">Cada eje incluye su medición física. La línea verde sólo representa puntuaciones normalizadas; los círculos vacíos indican medición disponible sin referencia compatible.</p>
          <p className="mt-2 text-xs"><span className="text-green-700">●</span> Puntuación de la sesión · <span className="text-muted-foreground">○ Medición sin puntuación</span> · Rejilla: escala de 0 a 100</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[580px] text-xs">
            <thead><tr className="border-b text-left"><th className="p-1">Indicador</th><th className="p-1">Valor medido</th><th className="p-1">Meta / rango</th><th className="p-1">Desviación</th><th className="p-1">Puntuación de la sesión</th><th className="p-1">Estado / opinión</th></tr></thead>
            <tbody>{radar.indicators.map((item) => <tr key={item.id} className="border-b align-top">
              <td className="p-1 font-medium">{item.name}</td>
              <td className="p-1 tabular-nums">{number(item.value, item.id === 'volume_ratio' ? 4 : 2)} {item.unit}{item.converted_value && <span className="block text-muted-foreground">{number(item.converted_value.value)} {item.converted_value.unit}</span>}</td>
              <td className="p-1 tabular-nums">{item.target ? item.target.value !== undefined ? number(item.target.value) : `${number(item.target.min)}–${number(item.target.max)} ${item.unit}` : '—'}</td>
              <td className="p-1 tabular-nums">{number(item.deviation, 4)}</td>
              <td className="p-1 tabular-nums">{item.score === null ? <><span className="font-medium">Sin puntuación</span><span className="block text-muted-foreground">Sin referencia compatible</span></> : `${number(item.score)} / 100`}</td>
              <td className="p-1"><span className="font-medium">{item.status}</span><p className="mt-1 text-muted-foreground">{item.opinion}</p></td>
            </tr>)}</tbody>
          </table>
          <p className="mt-2 text-xs text-muted-foreground">{radar.weighting}</p>
        </div>
        </>}
      </CardContent>
    </Card>

    {radar.indicators.some(item => item.stability) && <Card>
      <CardHeader><CardTitle className="text-base">Estabilidad de la operación</CardTitle>
        <p className="text-xs text-muted-foreground">Descriptivos por registros válidos, sin cambiar el score principal. Los porcentajes solo se calculan con un rango configurado.</p>
      </CardHeader>
      <CardContent className="overflow-x-auto"><table className="w-full min-w-[650px] text-xs">
        <thead><tr className="text-left"><th>Indicador</th><th>Registros</th><th>Promedio</th><th>Mín. / Máx.</th><th>Desv. estándar</th><th>Dentro</th><th>Debajo</th><th>Encima</th></tr></thead>
        <tbody>{radar.indicators.filter(item => item.stability).map(item => {
          const s = item.stability!
          return <tr key={item.id} className="border-t"><td className="py-2 font-medium">{item.name} ({item.unit})</td><td>{s.count}</td><td>{number(s.avg)}</td><td>{number(s.min)} / {number(s.max)}</td><td>{number(s.stddev)}</td>
            <td>{s.within_pct === null ? 'Pendiente de rango' : `${number(s.within_pct)}%`}</td><td>{s.below_pct === null ? '—' : `${number(s.below_pct)}%`}</td><td>{s.above_pct === null ? '—' : `${number(s.above_pct)}%`}</td></tr>
        })}</tbody>
      </table><p className="mt-2 text-xs text-muted-foreground">Desviación estándar poblacional: disponible con al menos dos registros. Los porcentajes no representan proporciones de superficie ni duración.</p></CardContent>
    </Card>}

    {radarV2 && <Card className="border-amber-300">
      <CardHeader><CardTitle className="text-base">Vista previa — Motor radar V2</CardTitle>
        <p className="text-xs text-muted-foreground">No reemplaza la calificación vigente. Evalúa puntos individuales y solo genera score con un perfil versionado compatible.</p>
      </CardHeader>
      <CardContent className="space-y-2 text-xs">
        <p><span className="font-medium">Estado:</span> {radarV2.state} · {radarV2.reason}</p>
        {radarV2.profile_resolution && <p><span className="font-medium">Referencia:</span> {radarV2.profile_resolution.name ?? 'Sin perfil'} · {radarV2.profile_resolution.reason}</p>}
        {radarV2.state === 'multi_configuration' && <p>Configuraciones separadas: {radarV2.configuration_groups.map(group => `${group.points_count} puntos (${group.key.join(' / ') || 'sin clave'})`).join('; ')}.</p>}
        {radarV2.indicators.length > 0 && <div className="overflow-x-auto"><table className="w-full min-w-[700px] text-xs">
          <thead><tr className="text-left"><th>Indicador</th><th>Válidos / inv.</th><th>Promedio ± desv.</th><th>C estricto</th><th>C tolerante</th><th>Estabilidad</th><th>V2</th></tr></thead>
          <tbody>{radarV2.indicators.map(item => <tr key={item.id} className="border-t"><td className="py-1 font-medium">{item.name}</td><td>{item.valid_count} / {item.invalid_count}</td><td>{number(item.statistics.avg)} ± {number(item.statistics.stddev)} {item.unit}</td><td>{number(item.strict_compliance_pct)}%</td><td>{number(item.tolerant_compliance_pct)}%</td><td>{item.stability === null ? 'No aplica' : number(item.stability)}</td><td>{item.score === null ? '—' : `${number(item.score)} / 100`}</td></tr>)}</tbody>
        </table></div>}
      </CardContent>
    </Card>}

    <Card>
      <CardHeader><CardTitle className="text-base">Referencia histórica descriptiva</CardTitle></CardHeader>
      <CardContent className="text-sm">
        {stats.historical_reference?.status === 'comparable' ? <>
          <p className="font-medium">{stats.historical_reference.group}</p>
          <p className="text-xs text-muted-foreground">{stats.historical_reference.warning}</p>
          <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[550px] text-xs">
            <thead><tr className="text-left"><th>Indicador</th><th>Valor actual</th><th>P10</th><th>Mediana</th><th>P90</th><th>Posición percentil</th></tr></thead>
            <tbody>{stats.historical_reference.metrics?.map(item => <tr key={item.id} className="border-t">
              <td className="py-2 font-medium">{item.name}</td><td>{number(item.value)} {item.unit}</td>
              <td>{number(item.p10)}</td><td>{number(item.median)}</td><td>{number(item.p90)}</td>
              <td>{item.percentile === null ? 'Fuera de P05–P95 / sin dato' : `P${number(item.percentile, 1)}`}</td>
            </tr>)}</tbody>
          </table></div>
          <p className="mt-2 text-xs text-muted-foreground">{stats.historical_reference.session_count} archivos/sesiones · {stats.historical_reference.points_count} puntos · {stats.historical_reference.method}</p>
          <details className="mt-2 text-xs"><summary>Proveniencia y revisión</summary>
            <p>Fuente: {stats.historical_reference.source_file}</p><p>Equipo/circuito: {stats.historical_reference.equipment_identity}</p>
            <p>Revisado: {dateTime(stats.historical_reference.verified_at)} · versión {stats.historical_reference.version}</p>
            <p>Fecha de generación del paquete: {stats.historical_reference.generated_at ? dateTime(stats.historical_reference.generated_at) : 'No documentada'}</p>
          </details>
        </> : <p className="text-muted-foreground">Sin histórico comparable confirmado. Los rangos técnicos y la calificación no dependen del paquete histórico.</p>}
      </CardContent>
    </Card>

    <Card><CardHeader><CardTitle className="text-base">Superficie y cobertura reportada</CardTitle></CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-3">
        <div><p className="text-xs text-muted-foreground">Superficie de parcela</p><p className="font-semibold">{plotArea !== null ? `${number(plotArea)} ha` : '—'}</p></div>
        <div><p className="text-xs text-muted-foreground">Área sumada de puntos</p><p className="font-semibold">{appliedArea !== null ? `${number(appliedArea)} ha` : '—'}</p></div>
        <div><p className="text-xs text-muted-foreground">Área reportada / parcela</p><p className="font-semibold">{coveragePercent !== null ? `${number(coveragePercent)}%` : '—'}</p></div>
        <div><p className="text-xs text-muted-foreground">Superficie cubierta sin solapamientos</p><p className="text-sm">No disponible: no se ha calculado la unión geométrica.</p></div>
        <p className="sm:col-span-3 text-xs text-muted-foreground">{stats.area_cobertura_metodo ?? 'Superficie reportada por los puntos; no se interpreta como unión geométrica sin calcular solapamientos.'}</p>
      </CardContent>
    </Card>
    {timeline && <TimelineChart timeline={timeline} />}
  </div>
}
