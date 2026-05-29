import { describe, it, expect } from 'vitest'
import {
  parseArea, sumArea, formatHa,
  datacentralStats, producerStats, ranchStats, plotStats,
} from './visorStats'

describe('parseArea', () => {
  it('parsea decimales válidos', () => {
    expect(parseArea('12.5')).toBeCloseTo(12.5)
  })
  it('null / inválidos → 0', () => {
    expect(parseArea(null)).toBe(0)
    expect(parseArea(undefined)).toBe(0)
    expect(parseArea('abc')).toBe(0)
  })
})

describe('sumArea', () => {
  it('suma total_area ignorando nulos', () => {
    expect(sumArea([{ total_area: '1.5' }, { total_area: null }, { total_area: '2.5' }])).toBeCloseTo(4.0)
  })
})

describe('formatHa', () => {
  it('formatea con sufijo ha', () => {
    expect(formatHa(3.14159)).toContain('ha')
    expect(formatHa(3.14159)).toContain('3.14')
  })
})

describe('constructores de tarjetas', () => {
  it('datacentralStats', () => {
    const s = datacentralStats(2, 5, 12)
    expect(s).toHaveLength(3)
    expect(s[0]).toEqual({ label: 'Productores', value: '2' })
    expect(s[2]).toEqual({ label: 'Parcelas', value: '12' })
  })
  it('producerStats incluye superficie', () => {
    const s = producerStats(3, 9, 100)
    expect(s.map((e) => e.label)).toEqual(['Ranchos', 'Parcelas', 'Superficie'])
    expect(s[2]!.value).toContain('ha')
  })
  it('ranchStats', () => {
    expect(ranchStats(4, 50).map((e) => e.label)).toEqual(['Parcelas', 'Superficie'])
  })
  it('plotStats', () => {
    const s = plotStats(2.5, 7)
    expect(s[1]).toEqual({ label: 'Sesiones de aspersión', value: '7' })
  })
})
