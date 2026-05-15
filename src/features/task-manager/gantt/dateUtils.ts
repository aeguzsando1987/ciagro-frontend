/**
 * Utilidades de fechas para el Gantt.
 * Aisladas para poder testearse sin montar componentes.
 */

/** Convierte una fecha ISO (date o date-time) a Date. Null/undefined => null. */
export function parseDate(input: string | null | undefined): Date | null {
  if (!input) return null
  const d = new Date(input)
  return Number.isNaN(d.getTime()) ? null : d
}

/**
 * Resuelve un rango de fechas con fallback.
 * Si alguna fecha falta, usa hoy ± offsetDays para que el Gantt siga renderizando
 * (gantt-task-react requiere start < end o tira RangeError).
 */
export function resolveRange(
  start: string | null | undefined,
  end: string | null | undefined,
  fallbackOffsetDays = 30
): { start: Date; end: Date } {
  const today = new Date()
  const parsedStart = parseDate(start)
  const parsedEnd = parseDate(end)

  const finalStart = parsedStart ?? new Date(today.getTime() - fallbackOffsetDays * 86_400_000)
  let finalEnd = parsedEnd ?? new Date(today.getTime() + fallbackOffsetDays * 86_400_000)

  // gantt-task-react exige start < end estrictamente.
  if (finalEnd.getTime() <= finalStart.getTime()) {
    finalEnd = new Date(finalStart.getTime() + 86_400_000)
  }

  return { start: finalStart, end: finalEnd }
}

/**
 * Convierte una fecha puntual (sesion) en un rango minimo de 1 dia.
 * gantt-task-react renderiza `type: 'milestone'` como diamante puntual,
 * pero igual exige un rango valido internamente.
 */
export function pointRange(dateIso: string | null | undefined): { start: Date; end: Date } {
  const d = parseDate(dateIso) ?? new Date()
  return { start: d, end: new Date(d.getTime() + 86_400_000) }
}

/**
 * Determina si el rango de un nodo cae fuera del rango de su padre (paso 2.11).
 * Devuelve true si: start < padre.start O end > padre.end.
 * Usado para tenir el bloque en rojo (Sprint 2.C).
 */
export function isOutOfRange(
  child: { start: Date; end: Date },
  parent: { start: Date; end: Date }
): boolean {
  return child.start.getTime() < parent.start.getTime() || child.end.getTime() > parent.end.getTime()
}
