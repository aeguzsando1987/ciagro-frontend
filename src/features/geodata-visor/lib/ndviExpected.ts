import type { NdviAgronomicCycle, NdviReferenceConfig } from '../hooks/useNdviTimeline'

export type NdviPerformance = 'good' | 'regular' | 'bad' | 'missing' | 'unconfigured'

/**
 * Compatibilidad con datos antiguos que todavía puedan traer ciclos explícitos.
 * La vista principal ya no depende de esta función: usa automáticamente las
 * fechas del Programa/subciclo.
 */
export function agronomicCycleAtDate(
  date: string,
  cycles: NdviAgronomicCycle[]
): NdviAgronomicCycle | null {
  return cycles.find(
    (cycle) =>
      cycle.start_date !== null &&
      cycle.end_date !== null &&
      date >= cycle.start_date &&
      date <= cycle.end_date
  ) ?? null
}

function utcDay(value: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])

  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null
  }

  return Date.UTC(year, month - 1, day)
}

/**
 * Posición normalizada de una fecha dentro de la ventana automática del ciclo.
 *
 * - inicio del Programa = 0
 * - fin del Programa = referenceLength - 1
 *
 * De esta forma la misma forma de referencia del cultivo se adapta a ciclos de
 * 3, 8, 12 meses, etc., sin asumir una duración fija de 19 semanas.
 */
export function ndviCyclePosition(
  date: string,
  referenceStart: string | null | undefined,
  referenceEnd: string | null | undefined,
  referenceLength: number
): number | null {
  if (!referenceStart || !referenceEnd || referenceLength < 1) return null

  const current = utcDay(date)
  const start = utcDay(referenceStart)
  const end = utcDay(referenceEnd)

  if (current === null || start === null || end === null || end < start) {
    return null
  }

  if (current < start || current > end) return null

  const total = end - start
  if (total === 0) return 0

  const progress = (current - start) / total
  return Math.max(0, Math.min(referenceLength - 1, progress * (referenceLength - 1)))
}

export function expectedNdviAtDate(
  date: string,
  referenceStart: string | null | undefined,
  referenceEnd: string | null | undefined,
  reference: NdviReferenceConfig | null | undefined
): number | null {
  if (!reference || reference.values.length < 2) return null

  const position = ndviCyclePosition(
    date,
    referenceStart,
    referenceEnd,
    reference.values.length
  )

  if (position === null) return null

  const leftIndex = Math.floor(position)
  const rightIndex = Math.ceil(position)
  const left = reference.values[leftIndex]
  const right = reference.values[rightIndex]

  if (left === undefined || right === undefined) return null
  if (leftIndex === rightIndex) return left

  const ratio = position - leftIndex
  return left + (right - left) * ratio
}

export function ndviStageAtDate(
  date: string,
  referenceStart: string | null | undefined,
  referenceEnd: string | null | undefined,
  reference: NdviReferenceConfig | null | undefined
): { label: string; description: string } | null {
  if (!reference) return null

  const position = ndviCyclePosition(
    date,
    referenceStart,
    referenceEnd,
    reference.values.length
  )

  if (position === null) return null

  // Las etapas de la referencia están definidas sobre los puntos originales de
  // la curva. Al normalizar el ciclo, cada etapa conserva su proporción relativa.
  const week = Math.floor(position) + 1
  const stage = reference.stages.find(
    (item) => week >= item.start_week && week <= item.end_week
  )

  if (!stage) return null
  return { label: stage.label, description: stage.description }
}

export function classifyNdviPerformance(
  real: number | null,
  expected: number | null,
  reference: NdviReferenceConfig | null | undefined
): NdviPerformance {
  if (real === null || !Number.isFinite(real)) return 'missing'
  if (expected === null || !reference) return 'unconfigured'

  const deficit = expected - real
  if (deficit <= reference.good_max_deficit) return 'good'
  if (deficit <= reference.regular_max_deficit) return 'regular'
  return 'bad'
}
