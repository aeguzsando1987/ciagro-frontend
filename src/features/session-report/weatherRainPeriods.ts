export interface WeatherRainPeriod {
  start: string
  end: string
  category?: string
}

type WeatherRainData = {
  rain_hours?: string[] | null
  rain_periods?: WeatherRainPeriod[] | null
}

const HOUR_MS = 60 * 60 * 1000

const formatDateTime = new Intl.DateTimeFormat('es-MX', {
  timeZone: 'America/Mexico_City',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: true,
})

function parseDate(value: string): Date | null {
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? date : null
}

/** Compress contiguous hourly rain samples into start-to-end ranges.
 * Older saved report snapshots only contain `rain_hours`, so they are grouped
 * here too instead of rendering a long list of individual timestamps.
 */
export function formatRainPeriods(weather: WeatherRainData): string[] {
  const savedPeriods = weather.rain_periods
  let periods: WeatherRainPeriod[]

  if (savedPeriods?.length) {
    periods = savedPeriods
  } else {
    const timestamps = [...new Set((weather.rain_hours ?? [])
      .map(parseDate)
      .filter((value): value is Date => value !== null)
      .map((value) => value.getTime()))].sort((a, b) => a - b)
    periods = []
    for (const timestamp of timestamps) {
      const start = new Date(timestamp)
      const end = new Date(timestamp + HOUR_MS)
      const previous = periods.at(-1)
      if (previous && parseDate(previous.end)?.getTime() === timestamp) {
        previous.end = end.toISOString()
      } else {
        periods.push({ start: start.toISOString(), end: end.toISOString() })
      }
    }
  }

  const categoryLabels: Record<string, string> = {
    minimal: 'Precipitación mínima',
    light: 'Lluvia ligera',
    moderate: 'Lluvia moderada',
    heavy: 'Lluvia fuerte',
  }

  return periods.flatMap(({ start, end, category }) => {
    const startDate = parseDate(start)
    const endDate = parseDate(end)
    return startDate && endDate
      ? [`${categoryLabels[category ?? ''] ? `${categoryLabels[category ?? '']}: ` : ''}${formatDateTime.format(startDate)} – ${formatDateTime.format(endDate)}`]
      : []
  })
}

export function rainStatusLabel(status: string | null | undefined, rained: boolean | null): string {
  if (status === 'significant') return 'Sí'
  if (status === 'minimal') return 'Precipitación mínima'
  if (status === 'none') return 'No'
  if (status === 'unavailable') return 'Sin datos disponibles'
  return rained == null ? 'Sin datos disponibles' : rained ? 'Sí' : 'No'
}
