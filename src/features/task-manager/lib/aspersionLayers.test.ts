import { describe, it, expect } from 'vitest'
import {
  classifyApplication,
  applicationPercent,
  computeQuartiles,
  quartileOf,
  classifyRateQuality,
  buildTargetDefs,
  targetBucketOf,
  ASPERSION_LAYERS,
  APPLICATION_CATEGORIES,
} from './aspersionLayers'

describe('applicationPercent', () => {
  it('calcula el porcentaje correctamente', () => {
    expect(applicationPercent(380, 400)).toBeCloseTo(95)
    expect(applicationPercent(400, 400)).toBeCloseTo(100)
    expect(applicationPercent(480, 400)).toBeCloseTo(120)
  })

  it('devuelve null si target es 0 o nulo', () => {
    expect(applicationPercent(100, 0)).toBeNull()
    expect(applicationPercent(100, null)).toBeNull()
    expect(applicationPercent(null, 400)).toBeNull()
  })
})

describe('classifyApplication', () => {
  // Umbrales unificados con el reporte: <75 Deficiente | 75–90 Baja | 90–100 Esperada |
  //   100–115 Excelente | >115 Sobredosis.
  it('< 75% es deficiente', () => {
    expect(classifyApplication(296, 400)).toBe('deficiente')   // 74%
    expect(classifyApplication(299, 400)).toBe('deficiente')   // 74.75%
  })

  it('75–90% es baja (75 incluido)', () => {
    expect(classifyApplication(300, 400)).toBe('baja')         // 75.0% exacto
    expect(classifyApplication(356, 400)).toBe('baja')         // 89%
  })

  it('90–100% es esperada (90 incluido, 100 excluido)', () => {
    expect(classifyApplication(360, 400)).toBe('esperada')     // 90%
    expect(classifyApplication(396, 400)).toBe('esperada')     // 99%
  })

  it('100–115% es excelente (100 y 115 incluidos)', () => {
    expect(classifyApplication(400, 400)).toBe('excelente')    // 100%
    expect(classifyApplication(460, 400)).toBe('excelente')    // 115%
  })

  it('> 115% es sobredosis', () => {
    expect(classifyApplication(461, 400)).toBe('sobredosis')   // 115.25%
    expect(classifyApplication(600, 400)).toBe('sobredosis')   // 150%
  })

  it('sin meta cuando applied o target son null/0', () => {
    expect(classifyApplication(null, 400)).toBe('sin_meta')
    expect(classifyApplication(380, null)).toBe('sin_meta')
    expect(classifyApplication(380, 0)).toBe('sin_meta')
  })
})

describe('computeQuartiles', () => {
  it('devuelve null para arreglo vacío', () => {
    expect(computeQuartiles([])).toBeNull()
    expect(computeQuartiles([NaN, Infinity])).toBeNull()
  })

  it('calcula correctamente con valores conocidos', () => {
    const cuts = computeQuartiles([1, 2, 3, 4, 5, 6, 7, 8])!
    expect(cuts.min).toBe(1)
    expect(cuts.max).toBe(8)
    // Q1 = percentil 25 sobre 8 valores → índice 1.75 → interpola entre 2 y 3
    expect(cuts.q1).toBeCloseTo(2.75)
    expect(cuts.q2).toBeCloseTo(4.5)
    expect(cuts.q3).toBeCloseTo(6.25)
  })

  it('funciona con un único valor', () => {
    const cuts = computeQuartiles([5])!
    expect(cuts.min).toBe(5)
    expect(cuts.max).toBe(5)
    expect(cuts.q1).toBe(5)
    expect(cuts.q2).toBe(5)
    expect(cuts.q3).toBe(5)
  })
})

describe('quartileOf', () => {
  const cuts = { min: 0, q1: 2, q2: 5, q3: 8, max: 10 }

  it('asigna el cuartil correcto', () => {
    expect(quartileOf(1, cuts)).toBe('q1')
    expect(quartileOf(2, cuts)).toBe('q2')  // igual a q1 → q2
    expect(quartileOf(3, cuts)).toBe('q2')
    expect(quartileOf(5, cuts)).toBe('q3')  // igual a q2 → q3
    expect(quartileOf(8, cuts)).toBe('q4')  // igual a q3 → q4
    expect(quartileOf(10, cuts)).toBe('q4')
  })

  it('devuelve null para valor null o no finito', () => {
    expect(quartileOf(null, cuts)).toBeNull()
    expect(quartileOf(NaN, cuts)).toBeNull()
  })
})

describe('estructura de ASPERSION_LAYERS y APPLICATION_CATEGORIES', () => {
  it('hay 7 capas con keys únicos', () => {
    expect(ASPERSION_LAYERS).toHaveLength(7)
    const keys = ASPERSION_LAYERS.map((l) => l.key)
    expect(new Set(keys).size).toBe(7)
    expect(keys[0]).toBe('application')
    expect(keys).toContain('target_rate')
    expect(keys).toContain('rate_quality')
  })

  it('la capa de presión trae unidad alterna PSI (×14.538)', () => {
    const presion = ASPERSION_LAYERS.find((l) => l.key === 'boom_pressure')!
    expect(presion.altUnit).toEqual({ label: 'PSI', factor: 14.538 })
  })

  it('APPLICATION_CATEGORIES: 5 categorías, keys y colores del semáforo unificado', () => {
    expect(APPLICATION_CATEGORIES).toHaveLength(5)
    const keys = APPLICATION_CATEGORIES.map((c) => c.key)
    expect(keys).toEqual(['deficiente', 'baja', 'esperada', 'excelente', 'sobredosis'])
    expect(new Set(APPLICATION_CATEGORIES.map((c) => c.color)).size).toBe(5)
    expect(APPLICATION_CATEGORIES.find((c) => c.key === 'sobredosis')!.color).toBe('#4052D6')
  })
})

describe('classifyRateQuality', () => {
  it('mapea los textos del CSV a los 3 buckets', () => {
    expect(classifyRateQuality('Bajo Objetivo')).toBe('bajo')
    expect(classifyRateQuality('Bien')).toBe('bien')
    expect(classifyRateQuality('Sobre el objetivo')).toBe('sobre')
  })
  it('fallback sin_dato para vacío o desconocido', () => {
    expect(classifyRateQuality(null)).toBe('sin_dato')
    expect(classifyRateQuality('otro')).toBe('sin_dato')
  })
})

describe('buildTargetDefs / targetBucketOf', () => {
  it('genera una entrada por valor distinto (ordenado)', () => {
    const defs = buildTargetDefs([800, 400, 400, null, 800])
    expect(defs.map((d) => d.key)).toEqual(['400', '800'])
    expect(defs[0]!.label).toBe('400.00 L/ha')
  })
  it('targetBucketOf devuelve la key string o sin_meta', () => {
    expect(targetBucketOf(400)).toBe('400')
    expect(targetBucketOf(null)).toBe('sin_meta')
  })
})
