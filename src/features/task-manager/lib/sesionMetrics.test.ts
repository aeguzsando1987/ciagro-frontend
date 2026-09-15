import { describe, it, expect } from 'vitest'
import {
  HEADLINE_KEYS,
  formatMetricMean,
  pickHeadlineMetrics,
  type VariableLike,
} from './sesionMetrics'

function v(key: string, mean: number | null, count = 100, label = key): VariableLike {
  return { key, label, count, mean }
}

describe('pickHeadlineMetrics', () => {
  it('respeta el orden declarado de titulares, no el del backend', () => {
    const variables = [
      v('boom_pressure_bar', 3),
      v('speed_kmh', 12),
      v('applied_rate_l', 150),
      v('liquid_flow_ls', 1.5),
    ]

    const metricas = pickHeadlineMetrics(variables, 'aspersion')

    expect(metricas.map((m) => m.key)).toEqual([
      'speed_kmh',
      'liquid_flow_ls',
      'boom_pressure_bar',
      'applied_rate_l',
    ])
  })

  it('nunca devuelve mas del maximo pedido', () => {
    // NDVI trae 15 indices; una rejilla de 15 tarjetas no es un resumen.
    const variables = Array.from({ length: 15 }, (_, i) => v(`idx_${i}`, i / 10))
    expect(pickHeadlineMetrics(variables, 'ndvi')).toHaveLength(4)
  })

  // Es el caso real de suelo: el CSV del proveedor decide que capas existen, asi que
  // ninguno de los cuatro titulares esta garantizado. Sin relleno, una sesion con 40
  // capas cargadas mostraria la rejilla vacia.
  it('rellena con las variables que si tengan datos cuando faltan los titulares', () => {
    const variables = [v('Clay', 22), v('Sand', 51), v('Silt', 27), v('Zn', 1.2)]

    const metricas = pickHeadlineMetrics(variables, 'soil_map')

    expect(metricas).toHaveLength(4)
    expect(metricas.map((m) => m.key)).toEqual(['Clay', 'Sand', 'Silt', 'Zn'])
  })

  it('completa los titulares que faltan sin repetir los que ya eligio', () => {
    const variables = [v('pH', 6.8), v('Clay', 22), v('Sand', 51)]

    const metricas = pickHeadlineMetrics(variables, 'soil_map')

    expect(metricas.map((m) => m.key)).toEqual(['pH', 'Clay', 'Sand'])
  })

  // Un titular declarado pero sin un solo valor ocuparia una tarjeta con un guion,
  // desplazando a una variable que si tiene datos.
  it('descarta un titular sin puntos y cede su lugar a otro con datos', () => {
    const variables = [v('pH', null, 0), v('OM', 3.4), v('Clay', 22)]

    const metricas = pickHeadlineMetrics(variables, 'soil_map')

    expect(metricas.map((m) => m.key)).toEqual(['OM', 'Clay'])
  })

  it('devuelve vacio si la sesion no tiene variables o ninguna tiene datos', () => {
    expect(pickHeadlineMetrics(undefined, 'ndvi')).toEqual([])
    expect(pickHeadlineMetrics([], 'ndvi')).toEqual([])
    expect(pickHeadlineMetrics([v('ndvi', null, 0)], 'ndvi')).toEqual([])
  })

  it('formatea NDVI con tres decimales y aspersion con dos', () => {
    const ndvi = pickHeadlineMetrics([v('ndvi', 0.7241)], 'ndvi')
    const asp = pickHeadlineMetrics([v('speed_kmh', 12.3456)], 'aspersion')

    expect(ndvi[0]!.value).toBe('0.724')
    expect(asp[0]!.value).toBe('12.35')
  })

  it('conserva la etiqueta que manda el backend, no una traduccion propia', () => {
    const metricas = pickHeadlineMetrics(
      [v('speed_kmh', 12, 100, 'Velocidad (km/h)')],
      'aspersion'
    )
    expect(metricas[0]!.label).toBe('Velocidad (km/h)')
  })
})

describe('formatMetricMean', () => {
  it('muestra un guion en vez de NaN o null', () => {
    expect(formatMetricMean(null, 2)).toBe('—')
    expect(formatMetricMean(Number.NaN, 2)).toBe('—')
    expect(formatMetricMean(Number.POSITIVE_INFINITY, 2)).toBe('—')
  })

  it('conserva el cero, que es un valor y no una ausencia', () => {
    expect(formatMetricMean(0, 2)).toBe('0.00')
  })
})

describe('HEADLINE_KEYS', () => {
  it('declara cuatro titulares por tipo, que es el ancho de la rejilla', () => {
    expect(HEADLINE_KEYS.aspersion).toHaveLength(4)
    expect(HEADLINE_KEYS.ndvi).toHaveLength(4)
    expect(HEADLINE_KEYS.soil_map).toHaveLength(4)
  })
})
