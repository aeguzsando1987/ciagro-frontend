import { describe, expect, it } from 'vitest'
import {
  buildSoilBucketAreaStats,
  buildSoilRasterAreaStats,
  polygonAreaHa,
  resolveSoilMapBoundary,
} from './soilMapArea'

const square = [
  [-101, 20],
  [-100.99, 20],
  [-100.99, 20.01],
  [-101, 20.01],
  [-101, 20],
]

describe('soilMapArea', () => {
  it('calcula hectáreas positivas desde un polígono geográfico', () => {
    expect(polygonAreaHa(square)).toBeGreaterThan(100)
    expect(polygonAreaHa(square)).toBeLessThan(130)
  })

  it('prioriza total_area del endpoint de parcela', () => {
    expect(resolveSoilMapBoundary(square, '42.5')).toMatchObject({
      totalAreaHa: 42.5,
      source: 'plot',
    })
  })

  it('no inventa un límite cuando falta la geometría de la parcela', () => {
    expect(resolveSoilMapBoundary(null, null)).toBeNull()
  })

  it('reparte porcentajes y hectáreas por rango', () => {
    const stats = buildSoilBucketAreaStats(['alto', 'bajo'], ['alto', 'alto', 'alto', 'bajo'], 20)

    expect(stats.alto).toEqual({ count: 3, percentage: 75, areaHa: 15 })
    expect(stats.bajo).toEqual({ count: 1, percentage: 25, areaHa: 5 })
  })

  it('reparte hectáreas según celdas espaciales, no según cantidad de muestras', () => {
    const stats = buildSoilRasterAreaStats(['alto', 'bajo'], { alto: 30, bajo: 70 }, 20)

    expect(stats.alto).toEqual({ count: 30, percentage: 30, areaHa: 6 })
    expect(stats.bajo).toEqual({ count: 70, percentage: 70, areaHa: 14 })
  })
})
