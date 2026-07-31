import { describe, expect, it } from 'vitest'
import { analyzeSoilSurface, interpolateIdw, pointInRing } from './soilMapSurface'

describe('pointInRing', () => {
  const square = [
    [0, 0],
    [10, 0],
    [10, 10],
    [0, 10],
    [0, 0],
  ]

  it('distingue puntos interiores y exteriores', () => {
    expect(pointInRing(5, 5, square)).toBe(true)
    expect(pointInRing(12, 5, square)).toBe(false)
  })
})

describe('interpolateIdw', () => {
  const samples = [
    { lng: 0, lat: 0, value: 10 },
    { lng: 2, lat: 0, value: 30 },
  ]

  it('conserva el valor de una muestra exacta', () => {
    expect(interpolateIdw(0, 0, samples, 0)).toBe(10)
  })

  it('interpola simétricamente entre dos muestras', () => {
    expect(interpolateIdw(1, 0, samples, 0)).toBeCloseTo(20)
  })

  it('usa vecinos locales y evita que valores lejanos aplanen la superficie', () => {
    expect(
      interpolateIdw(1, 0, [...samples, { lng: 100, lat: 100, value: 10_000 }], 0)
    ).toBeCloseTo(20)
  })
})

describe('analyzeSoilSurface', () => {
  it('calcula cortes desde el raster completo y cuenta únicamente celdas del polígono', () => {
    const analysis = analyzeSoilSurface({
      ring: [
        [0, 0],
        [2, 0],
        [2, 2],
        [0, 2],
        [0, 0],
      ],
      samples: [
        { lng: 0, lat: 0, value: 10 },
        { lng: 2, lat: 0, value: 20 },
        { lng: 2, lat: 2, value: 30 },
        { lng: 0, lat: 2, value: 40 },
      ],
      paletteSize: 4,
      maxSize: 24,
    })

    expect(analysis?.breaks).toHaveLength(3)
    expect(analysis?.min).toBeGreaterThanOrEqual(10)
    expect(analysis?.max).toBeLessThanOrEqual(40)
    expect(
      Object.values(analysis?.bucketCellCounts ?? {}).reduce((total, count) => total + count, 0)
    ).toBeGreaterThan(0)
  })
})
