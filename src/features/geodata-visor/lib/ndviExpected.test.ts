import { describe, expect, it } from 'vitest'

import type { NdviReferenceConfig } from '../hooks/useNdviTimeline'
import {
  classifyNdviPerformance,
  expectedNdviAtDate,
  ndviCyclePosition,
  ndviStageAtDate,
} from './ndviExpected'

const reference: NdviReferenceConfig = {
  basis: 'normalized_cycle_progress',
  values: [0.20, 0.40, 0.60],
  good_max_deficit: 0.05,
  regular_max_deficit: 0.12,
  stages: [
    { start_week: 1, end_week: 1, label: 'VE', description: 'Emergencia' },
    { start_week: 2, end_week: 2, label: 'V2', description: '2 hojas' },
    { start_week: 3, end_week: 3, label: 'R6', description: 'Fin de ciclo' },
  ],
  source: 'test',
  version: '1',
}

describe('NDVI esperado normalizado al ciclo del Programa', () => {
  it('usa exactamente el inicio y fin cargados en el Programa', () => {
    expect(
      expectedNdviAtDate('2024-01-01', '2024-01-01', '2024-03-31', reference)
    ).toBeCloseTo(0.20)

    expect(
      expectedNdviAtDate('2024-03-31', '2024-01-01', '2024-03-31', reference)
    ).toBeCloseTo(0.60)
  })

  it('interpola por porcentaje de avance, no por una duración fija en semanas', () => {
    // 01-ene -> 31-mar de 2024 son 90 días; 15-feb está justo a 45 días.
    expect(
      expectedNdviAtDate('2024-02-15', '2024-01-01', '2024-03-31', reference)
    ).toBeCloseTo(0.40)
  })

  it('adapta la misma forma a ciclos de distinta duración', () => {
    const threeMonthEnd = expectedNdviAtDate(
      '2024-03-31', '2024-01-01', '2024-03-31', reference
    )
    const eightMonthEnd = expectedNdviAtDate(
      '2024-08-31', '2024-01-01', '2024-08-31', reference
    )
    const yearEnd = expectedNdviAtDate(
      '2024-12-31', '2024-01-01', '2024-12-31', reference
    )

    expect(threeMonthEnd).toBeCloseTo(0.60)
    expect(eightMonthEnd).toBeCloseTo(0.60)
    expect(yearEnd).toBeCloseTo(0.60)
  })

  it('permite curvas independientes para Programas hijos de 12 y 40 semanas', () => {
    // Ambos ciclos usan la misma referencia de maíz, pero cada uno la escala
    // exclusivamente dentro de sus propias fechas.
    const shortStart = '2024-01-01'
    const shortEnd = '2024-03-24'
    const longStart = '2024-04-01'
    const longEnd = '2025-01-05'

    expect(expectedNdviAtDate(shortStart, shortStart, shortEnd, reference)).toBeCloseTo(0.20)
    expect(expectedNdviAtDate(shortEnd, shortStart, shortEnd, reference)).toBeCloseTo(0.60)

    expect(expectedNdviAtDate(longStart, longStart, longEnd, reference)).toBeCloseTo(0.20)
    expect(expectedNdviAtDate(longEnd, longStart, longEnd, reference)).toBeCloseTo(0.60)

    // La curva de un hijo nunca invade la ventana del otro.
    expect(expectedNdviAtDate('2024-03-25', shortStart, shortEnd, reference)).toBeNull()
    expect(expectedNdviAtDate('2024-03-31', longStart, longEnd, reference)).toBeNull()
  })

  it('no calcula esperado fuera de las fechas del Programa', () => {
    expect(
      expectedNdviAtDate('2023-12-31', '2024-01-01', '2024-12-31', reference)
    ).toBeNull()
    expect(
      expectedNdviAtDate('2025-01-01', '2024-01-01', '2024-12-31', reference)
    ).toBeNull()
  })

  it('no calcula esperado si falta inicio o fin', () => {
    expect(expectedNdviAtDate('2024-02-01', null, '2024-03-31', reference)).toBeNull()
    expect(expectedNdviAtDate('2024-02-01', '2024-01-01', null, reference)).toBeNull()
  })

  it('normaliza la posición al número de puntos de referencia', () => {
    expect(ndviCyclePosition('2024-01-01', '2024-01-01', '2024-03-31', 3)).toBeCloseTo(0)
    expect(ndviCyclePosition('2024-02-15', '2024-01-01', '2024-03-31', 3)).toBeCloseTo(1)
    expect(ndviCyclePosition('2024-03-31', '2024-01-01', '2024-03-31', 3)).toBeCloseTo(2)
  })

  it('escala también las etapas al avance del ciclo', () => {
    expect(
      ndviStageAtDate('2024-01-01', '2024-01-01', '2024-03-31', reference)?.label
    ).toBe('VE')
    expect(
      ndviStageAtDate('2024-02-15', '2024-01-01', '2024-03-31', reference)?.label
    ).toBe('V2')
    expect(
      ndviStageAtDate('2024-03-31', '2024-01-01', '2024-03-31', reference)?.label
    ).toBe('R6')
  })

  it('usa los umbrales configurados para el semáforo', () => {
    expect(classifyNdviPerformance(0.56, 0.60, reference)).toBe('good')
    expect(classifyNdviPerformance(0.50, 0.60, reference)).toBe('regular')
    expect(classifyNdviPerformance(0.40, 0.60, reference)).toBe('bad')
  })

  it('no clasifica si el cultivo no tiene referencia', () => {
    expect(classifyNdviPerformance(0.60, null, null)).toBe('unconfigured')
  })
})
