/** Marca temporal GPS de aspersión en zona horaria local de CIAgro. */
const TIME_ZONE = 'America/Mexico_City'

export function sessionClock(value: string | null | undefined): string | null {
  if (!value) return null
  // Report snapshots may also contain date-only header values; do not invent 00:00.
  if (!/[T ]\d{2}:\d{2}/.test(value)) return null
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return null
  return new Intl.DateTimeFormat('es-MX', {
    timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true,
  }).format(date)
}

/** Formato de reporte que conserva la hora local de SMS Advanced. */
export function sessionDateTime(value: string | null | undefined): string {
  if (!value) return '—'
  if (!/[T ]\d{2}:\d{2}/.test(value)) {
    const [year, month, day] = value.slice(0, 10).split('-')
    return year && month && day ? `${day}/${month}/${year}` : value
  }
  const parsed = new Date(value)
  if (!Number.isFinite(parsed.getTime())) return value
  const date = new Intl.DateTimeFormat('es-MX', {
    timeZone: TIME_ZONE, day: '2-digit', month: '2-digit', year: 'numeric',
  }).format(parsed)
  const clock = sessionClock(value)
  return clock ? `${date} ${clock}` : date
}

export function sessionDateAndClock(value: string | null | undefined, sessionDay: string | null): string | null {
  const clock = sessionClock(value)
  if (!clock || !value) return null
  const date = new Date(value)
  const day = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date)
  if (day === sessionDay) return clock
  const [year, month, dayNumber] = day.split('-')
  return `${dayNumber}/${month}/${year} ${clock}`
}
