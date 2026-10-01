import { describe, expect, it } from 'vitest'
import { buildCycle, isSeason2ValidForSeason1, parseCycle } from './cycle'

describe('isSeason2ValidForSeason1', () => {
  it('acepta ciclos de una sola temporada', () => {
    expect(isSeason2ValidForSeason1('Invierno', '')).toBe(true)
  })

  it('acepta cualquier orden, incluidos los que cruzan de año', () => {
    expect(isSeason2ValidForSeason1('Primavera', 'Verano')).toBe(true)
    expect(isSeason2ValidForSeason1('Invierno', 'Primavera')).toBe(true)
    expect(isSeason2ValidForSeason1('Otoño', 'Primavera')).toBe(true)
  })

  it('rechaza temporadas iguales o temporada 2 sin temporada 1', () => {
    expect(isSeason2ValidForSeason1('Verano', 'Verano')).toBe(false)
    expect(isSeason2ValidForSeason1(undefined, 'Verano')).toBe(false)
  })
})

describe('buildCycle / parseCycle', () => {
  it('ida y vuelta de un ciclo que cruza de año', () => {
    const cycle = buildCycle('Invierno', 'Primavera', '2026')
    expect(cycle).toBe('Invierno-Primavera-2026')
    expect(parseCycle(cycle)).toEqual({ season1: 'Invierno', season2: 'Primavera', year: 2026 })
  })
})
