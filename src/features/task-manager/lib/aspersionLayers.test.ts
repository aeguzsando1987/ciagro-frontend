import { describe, it, expect } from 'vitest'
import {
  classifyApplication,
  applicationPercent,
  computeQuartiles,
  quartileOf,
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
  it('clasifica según los umbrales exactos del caso de uso', () => {
    expect(classifyApplication(300, 400)).toBe('deficiente')   // 75% < 80
    expect(classifyApplication(315, 400)).toBe('deficiente')   // 78.75% < 80
  })

  it('límite 80% cae en regular (80–95% incluye el 80)', () => {
    expect(classifyApplication(320, 400)).toBe('regular')      // 80.0% exacto
  })

  it('95% excelente (incluido en 95–105)', () => {
    expect(classifyApplication(380, 400)).toBe('excelente')    // 95%
    expect(classifyApplication(400, 400)).toBe('excelente')    // 100%
  })

  it('105% sobredosis (incluido en 105–120)', () => {
    expect(classifyApplication(420, 400)).toBe('sobredosis')   // 105%
    expect(classifyApplication(480, 400)).toBe('sobredosis')   // 120%
  })

  it('> 120% sobredosis_alta', () => {
    expect(classifyApplication(481, 400)).toBe('sobredosis_alta') // 120.25%
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
  it('hay 5 capas con keys únicos', () => {
    expect(ASPERSION_LAYERS).toHaveLength(5)
    const keys = ASPERSION_LAYERS.map((l) => l.key)
    expect(new Set(keys).size).toBe(5)
    expect(keys[0]).toBe('application')
  })

  it('APPLICATION_CATEGORIES tiene 5 categorías con colores únicos', () => {
    expect(APPLICATION_CATEGORIES).toHaveLength(5)
    const colors = APPLICATION_CATEGORIES.map((c) => c.color)
    expect(new Set(colors).size).toBe(5)
  })
})
