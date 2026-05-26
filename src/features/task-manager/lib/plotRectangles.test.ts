import { describe, it, expect } from 'vitest'
import {
  parseDecimal,
  rectangleRing,
  pointsToRectangleCollection,
  type AspersionPoint,
} from './plotRectangles'

const M_PER_DEG_LAT = 111_320
const LAT = 20.5
const LON = -101.0
const M_PER_DEG_LON = M_PER_DEG_LAT * Math.cos((LAT * Math.PI) / 180)

/** Extensión en metros del anillo a lo largo de cada eje geográfico (semi-ancho). */
function extents(ring: number[][]) {
  const lons = ring.map((c) => c[0]!)
  const lats = ring.map((c) => c[1]!)
  const eastM = ((Math.max(...lons) - Math.min(...lons)) / 2) * M_PER_DEG_LON
  const northM = ((Math.max(...lats) - Math.min(...lats)) / 2) * M_PER_DEG_LAT
  return { eastM, northM }
}

function makePoint(overrides: Partial<AspersionPoint> = {}): AspersionPoint {
  return {
    id: 'p1',
    session_header: 's1',
    plot: null,
    geom: { type: 'Point', coordinates: [LON, LAT] },
    course_deg: '0',
    boom_width_m: '14',
    distance_m: '1.5',
    applied_rate_l: '380',
    target_rate_l: '400',
    liquid_flow_ls: '0.6',
    boom_pressure_bar: '0.3',
    production_hah: '7.6',
    speed_kmh: '5.4',
    ...overrides,
  } as AspersionPoint
}

describe('parseDecimal', () => {
  it('convierte decimal-string a number y null si falta', () => {
    expect(parseDecimal('318.52')).toBeCloseTo(318.52)
    expect(parseDecimal(null)).toBeNull()
    expect(parseDecimal(undefined)).toBeNull()
    expect(parseDecimal('no-num')).toBeNull()
  })
})

describe('rectangleRing', () => {
  it('devuelve un anillo cerrado de 5 posiciones', () => {
    const ring = rectangleRing(LON, LAT, 0, 14, 1.5)
    expect(ring).toHaveLength(5)
    expect(ring[0]).toEqual(ring[4])
  })

  it('a rumbo 0° el ancho del brazo va este-oeste y la distancia norte-sur', () => {
    const { eastM, northM } = extents(rectangleRing(LON, LAT, 0, 14, 1.5))
    expect(eastM).toBeCloseTo(7, 1)   // semi-ancho = boom_width_m / 2
    expect(northM).toBeCloseTo(0.75, 2) // semi-altura = distance_m / 2
  })

  it('a rumbo 90° los ejes se intercambian (ancho norte-sur)', () => {
    const { eastM, northM } = extents(rectangleRing(LON, LAT, 90, 14, 1.5))
    expect(eastM).toBeCloseTo(0.75, 2)
    expect(northM).toBeCloseTo(7, 1)
  })
})

describe('pointsToRectangleCollection', () => {
  it('construye un Feature Polygon por punto válido y parsea sus propiedades', () => {
    const fc = pointsToRectangleCollection([makePoint()])
    expect(fc.type).toBe('FeatureCollection')
    expect(fc.features).toHaveLength(1)
    const f = fc.features[0]!
    expect(f.geometry.type).toBe('Polygon')
    expect(f.properties.applied_rate_l).toBeCloseTo(380)
    expect(f.properties.target_rate_l).toBeCloseTo(400)
    expect(f.properties.lon).toBeCloseTo(LON)
  })

  it('usa vehicle_heading como fallback cuando course_deg falta', () => {
    const fc = pointsToRectangleCollection([
      makePoint({ course_deg: null, vehicle_heading: '90' }),
    ])
    expect(fc.features[0]!.properties.course_deg).toBe(90)
  })

  it('descarta puntos sin geom, sin ancho de brazo o sin distancia', () => {
    const fc = pointsToRectangleCollection([
      makePoint({ geom: null }),
      makePoint({ boom_width_m: null }),
      makePoint({ distance_m: null }),
      makePoint({ boom_width_m: '0' }),
    ])
    expect(fc.features).toHaveLength(0)
  })
})
