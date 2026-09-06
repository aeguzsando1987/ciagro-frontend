/**
 * Geometria del histograma (RS-14).
 *
 * El bloque que importa es el primero: los numeros esperados NO se escribieron a
 * mano, se obtuvieron corriendo `apps/field_ops/report_charts.py` con esta misma
 * entrada y extrayendo los <rect> del SVG. Si alguien toca una constante o una
 * formula en cualquiera de los dos lados, este test lo detecta — que es justamente
 * el motivo de dibujar a mano en vez de usar una libreria.
 */
import { describe, expect, it } from 'vitest'
import { classColor, histogramGeometry, smoothPath, barValue } from './histogram'

const HIST = {
  bins: [
    { lower: 5.0, upper: 5.5, count: 10 },
    { lower: 5.5, upper: 6.0, count: 40 },
    { lower: 6.0, upper: 6.5, count: 25 },
    { lower: 6.5, upper: 7.0, count: 5 },
  ],
}
const BREAKS = [5.6, 6.2, 6.8]
/** Paleta de valor ALTO a BAJO, como el catalogo y el visor. */
const PALETTE = ['#AA0000', '#DD5500', '#FFCC00', '#00AA00']

describe('histogramGeometry — paridad con report_charts.py', () => {
  it('produce las mismas barras que el backend', () => {
    const geo = histogramGeometry(HIST, BREAKS, PALETTE)!
    const redondeadas = geo.bars.map((b) => [
      b.x.toFixed(2), b.y.toFixed(2), b.width.toFixed(2), b.height.toFixed(2), b.fill,
    ])
    expect(redondeadas).toEqual([
      ['62.00', '167.00', '76.00', '47.00', '#00AA00'],
      ['139.00', '26.00', '76.00', '188.00', '#FFCC00'],
      ['216.00', '96.50', '76.00', '117.50', '#DD5500'],
      ['293.00', '190.50', '76.00', '23.50', '#DD5500'],
    ])
  })

  it('coloca los cortes en las mismas x que el backend', () => {
    const geo = histogramGeometry(HIST, BREAKS, PALETTE)!
    expect(geo.breakLines.map((l) => l.x.toFixed(2))).toEqual(['154.40', '246.80', '339.20'])
  })

  it('traza la misma curva de tendencia que el backend', () => {
    const geo = histogramGeometry(HIST, BREAKS, PALETTE)!
    expect(geo.curve.startsWith('M 100.50 167.00 C 113.33 143.50, 151.83 37.75, 177.50 26.00')).toBe(
      true
    )
  })
})

describe('classColor', () => {
  it('invierte el indice: la paleta va de alto a bajo', () => {
    // El valor mas BAJO recibe el ULTIMO color, no el primero.
    expect(classColor(5.0, BREAKS, PALETTE)).toBe('#00AA00')
    expect(classColor(9.9, BREAKS, PALETTE)).toBe('#AA0000')
  })

  it('sin paleta usa un color neutro en vez de reventar', () => {
    expect(classColor(1, [], [])).toBe('#8ea9c1')
  })
})

describe('H8 — el numero de clases no es siete', () => {
  it('una capa de una sola clase no dibuja ningun corte', () => {
    // `iron` tiene 1 color, o sea 0 cortes. Con 7 hardcodeadas saldrian 7 lineas.
    const geo = histogramGeometry(HIST, [], ['#FF0000'])!
    expect(geo.breakLines).toHaveLength(0)
    expect(geo.bars.every((b) => b.fill === '#FF0000')).toBe(true)
  })

  it('una capa de ocho clases dibuja siete cortes', () => {
    // `manganese_available` tiene 8 colores.
    const cortes = [1, 2, 3, 4, 5, 6, 7]
    const geo = histogramGeometry(HIST, cortes, Array(8).fill('#000'))!
    expect(geo.breakLines).toHaveLength(7)
  })
})

describe('eje Y', () => {
  it('va en puntos cuando el raster no ha dado hectareas', () => {
    expect(histogramGeometry(HIST)!.yLabel).toBe('Puntos')
  })

  it('va en Ha cuando el front ya las calculo', () => {
    const conArea = {
      bins: HIST.bins.map((b, i) => ({ ...b, area_ha: (i + 1) * 1.5 })),
    }
    const geo = histogramGeometry(conArea)!
    expect(geo.yLabel).toBe('Ha')
    // La altura la manda el hectareaje, no el conteo: el bin de 40 puntos ya no
    // es el mas alto.
    expect(geo.bars[3]!.height).toBeGreaterThan(geo.bars[1]!.height)
  })

  it('barValue prefiere hectareas y cae al conteo si no hay', () => {
    expect(barValue({ lower: 0, upper: 1, count: 7 })).toBe(7)
    expect(barValue({ lower: 0, upper: 1, count: 7, area_ha: 2.5 })).toBe(2.5)
    // 0 ha es un dato, no "sin dato": no debe caer al conteo.
    expect(barValue({ lower: 0, upper: 1, count: 7, area_ha: 0 })).toBe(0)
  })
})

describe('casos limite', () => {
  it('sin bins no hay geometria', () => {
    expect(histogramGeometry({ bins: [] })).toBeNull()
    expect(histogramGeometry(null)).toBeNull()
  })

  it('capa constante: una barra de ancho completo, no una linea', () => {
    const geo = histogramGeometry({ bins: [{ lower: 7, upper: 7, count: 100 }] })!
    expect(geo.bars).toHaveLength(1)
    expect(geo.bars[0]!.width).toBeGreaterThan(300)
  })

  it('un solo punto no traza curva', () => {
    expect(smoothPath([[1, 2]])).toBe('')
  })
})
