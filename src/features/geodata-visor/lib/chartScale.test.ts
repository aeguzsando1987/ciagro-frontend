import { describe, it, expect } from 'vitest'
import { niceAxisTicks, readableTextColor } from './chartScale'

describe('niceAxisTicks', () => {
  it('arranca en 0 y cubre el maximo', () => {
    const { axisMax, ticks } = niceAxisTicks(4.39)

    expect(ticks[0]).toBe(0)
    expect(axisMax).toBeGreaterThanOrEqual(4.39)
    expect(ticks[ticks.length - 1]).toBe(axisMax)
  })

  it('usa pasos redondos, no el maximo partido en trozos', () => {
    // 4.39 / 4 = 1.0975: sin redondear saldrian marcas ilegibles.
    expect(niceAxisTicks(4.39).ticks).toEqual([0, 1, 2, 3, 4, 5])
  })

  it('mantiene marcas intermedias para poder estimar alturas', () => {
    // Lo que se corrige: con solo 0 y el maximo no se puede leer una barra a media altura.
    expect(niceAxisTicks(4.39).ticks.length).toBeGreaterThan(2)
  })

  it('escala a magnitudes muy distintas sin perder legibilidad', () => {
    expect(niceAxisTicks(0.08).ticks).toEqual([0, 0.02, 0.04, 0.06, 0.08])
    expect(niceAxisTicks(950).ticks).toEqual([0, 200, 400, 600, 800, 1000])
  })

  it('no produce marcas con basura de coma flotante', () => {
    for (const t of niceAxisTicks(0.7).ticks) {
      expect(String(t)).not.toMatch(/\d{6,}/)
    }
  })

  it('degrada sin romperse con un maximo nulo o invalido', () => {
    expect(niceAxisTicks(0)).toEqual({ axisMax: 0, ticks: [0] })
    expect(niceAxisTicks(Number.NaN)).toEqual({ axisMax: 0, ticks: [0] })
  })
})

describe('readableTextColor', () => {
  it('pone texto oscuro sobre colores claros', () => {
    expect(readableTextColor('#fff700')).toBe('#1f2937') // amarillo de Clase 5
    expect(readableTextColor('#a8ff3d')).toBe('#1f2937') // verde claro de Clase 3
  })

  it('pone texto claro sobre colores oscuros', () => {
    expect(readableTextColor('#f00000')).toBe('#ffffff') // rojo de Clase 9
    expect(readableTextColor('#1a9850')).toBe('#ffffff')
  })

  it('no revienta con un color mal formado', () => {
    expect(readableTextColor('#abc')).toBe('#1f2937')
    expect(readableTextColor('')).toBe('#1f2937')
  })
})
