/** Fecha local de hoy en formato `YYYY-MM-DD` (sin desfase de zona horaria de `toISOString`). */
export function todayIso(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** `true` si la fecha `YYYY-MM-DD` es posterior a hoy (en zona local). */
export function isFutureDate(iso: string): boolean {
  return iso > todayIso()
}
