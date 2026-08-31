import { describe, expect, it } from 'vitest'
import { buildSamples, type SoilMapPointGeometry } from './soilMapSamples'
import { SOIL_MAP_LAYERS, type SoilMapLayerDef } from './soilMapLayers'

const numericLayer = SOIL_MAP_LAYERS.find((layer) => layer.field === 'pH')!
const categoryLayer = SOIL_MAP_LAYERS.find(
  (layer) => layer.field === 'classtexture'
)! as SoilMapLayerDef

function point(id: string, lng = -101.5, lat = 20.8): SoilMapPointGeometry {
  return { id, geom: { coordinates: [lng, lat] } }
}

describe('buildSamples', () => {
  it('une el valor con el punto que le corresponde, no con su posición', () => {
    // El fallo que este test existe para atrapar: si la unión se hiciera por
    // índice en vez de por id, un orden distinto entre las dos peticiones pintaría
    // valores creíbles en los puntos equivocados y nada lo delataría.
    const points = [point('a', -101, 20), point('b', -102, 21)]
    const values = new Map<string, number>([
      ['b', 7.5],
      ['a', 6.5],
    ])

    const samples = buildSamples(points, values, numericLayer)

    expect(samples).toEqual([
      { id: 'a', lng: -101, lat: 20, value: 6.5 },
      { id: 'b', lng: -102, lat: 21, value: 7.5 },
    ])
  })

  it('descarta los puntos sin valor en la capa activa', () => {
    const points = [point('a'), point('b'), point('c')]
    const values = new Map<string, number>([['b', 7]])

    const samples = buildSamples(points, values, numericLayer)

    expect(samples.map((sample) => sample.id)).toEqual(['b'])
  })

  it('descarta coordenadas ausentes o no finitas', () => {
    const points: SoilMapPointGeometry[] = [
      { id: 'sin-geom', geom: null },
      { id: 'sin-coords', geom: { coordinates: null } },
      { id: 'incompletas', geom: { coordinates: [-101.5] } },
      { id: 'nan', geom: { coordinates: [Number.NaN, 20.8] } },
      point('buena'),
    ]
    const values = new Map<string, number>(
      points.map((current) => [current.id, 6.5] as const)
    )

    const samples = buildSamples(points, values, numericLayer)

    expect(samples.map((sample) => sample.id)).toEqual(['buena'])
  })

  it('en una capa numérica ignora los valores de texto', () => {
    const values = new Map<string, string>([['a', 'Franco']])
    expect(buildSamples([point('a')], values, numericLayer)).toEqual([])
  })

  it('en una capa categórica recorta el texto y descarta el vacío', () => {
    const points = [point('a', -101, 20), point('b', -102, 21)]
    const values = new Map<string, string>([
      ['a', '  Franco  '],
      ['b', '   '],
    ])

    const samples = buildSamples(points, values, categoryLayer)

    expect(samples).toEqual([{ id: 'a', lng: -101, lat: 20, value: 'Franco' }])
  })

  it('en una capa categórica ignora los valores numéricos', () => {
    const values = new Map<string, number>([['a', 6.5]])
    expect(buildSamples([point('a')], values, categoryLayer)).toEqual([])
  })

  it('devuelve vacío mientras falte cualquiera de las dos fuentes', () => {
    const values = new Map<string, number>([['a', 6.5]])
    expect(buildSamples(undefined, values, numericLayer)).toEqual([])
    expect(buildSamples([point('a')], undefined, numericLayer)).toEqual([])
  })
})
