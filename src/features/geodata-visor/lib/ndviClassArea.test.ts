/**
 * Reparto de superficie por clase. Se verifica sobre mallas sinteticas de reparto
 * conocido, para poder afirmar el area exacta y no solo que "se parece".
 */
import { describe, it, expect } from 'vitest'
import {
  bandIndexOf,
  buildNdviClassAreas,
  countCellsByBand,
  countPointsByBand,
  formatBandRange,
  type ClassBand,
} from './ndviClassArea'

/** Tres clases contiguas de 0.1, como las que configura el usuario a mano. */
const BANDS: ClassBand[] = [
  { min: 0.5, max: 0.6, color: '#fff700', label: 'Baja' },
  { min: 0.6, max: 0.7, color: '#ffc800', label: 'Media' },
  { min: 0.7, max: 0.8, color: '#ff7b00', label: 'Alta' },
]

/** Malla con un reparto exacto: n0 celdas de la clase 0, n1 de la 1, etc. */
function gridOf(counts: number[], values: number[], nan = 0, outside = 0): Float32Array {
  const cells: number[] = []
  counts.forEach((n, i) => { for (let k = 0; k < n; k++) cells.push(values[i]!) })
  for (let k = 0; k < outside; k++) cells.push(0.95) // fuera de toda banda
  for (let k = 0; k < nan; k++) cells.push(NaN)
  return Float32Array.from(cells)
}

const CENTERS = [0.55, 0.65, 0.75]

describe('bandIndexOf', () => {
  it('usa la misma regla que el pintado: min <= v < max', () => {
    expect(bandIndexOf(0.5, BANDS)).toBe(0) // el minimo entra
    expect(bandIndexOf(0.6, BANDS)).toBe(1) // el maximo NO entra, pasa a la siguiente
    expect(bandIndexOf(0.799, BANDS)).toBe(2)
  })

  it('devuelve -1 fuera de todas las bandas', () => {
    expect(bandIndexOf(0.2, BANDS)).toBe(-1)
    expect(bandIndexOf(0.8, BANDS)).toBe(-1)
  })

  it('trata null como mas y menos infinito', () => {
    const abiertas: ClassBand[] = [
      { min: null, max: 0.5, color: '#000' },
      { min: 0.5, max: null, color: '#fff' },
    ]
    expect(bandIndexOf(-99, abiertas)).toBe(0)
    expect(bandIndexOf(99, abiertas)).toBe(1)
  })
})

describe('countCellsByBand', () => {
  it('reparte las celdas y separa las que no caen en ninguna clase', () => {
    const grid = gridOf([10, 20, 30], CENTERS, 0, 5)
    const r = countCellsByBand(grid, BANDS)

    expect(r.perBand).toEqual([10, 20, 30])
    expect(r.outside).toBe(5)
    expect(r.withData).toBe(65)
  })

  it('ignora las celdas NaN, que son las de fuera del casco', () => {
    const grid = gridOf([10, 0, 0], CENTERS, 40)
    const r = countCellsByBand(grid, BANDS)

    expect(r.withData).toBe(10)
    expect(r.perBand[0]).toBe(10)
  })
})

describe('countPointsByBand', () => {
  it('cuenta solo los puntos con valor en el indice activo', () => {
    const r = countPointsByBand([0.55, 0.65, 0.65, null, undefined, NaN], BANDS)

    expect(r.perBand).toEqual([1, 2, 0])
    expect(r.withValue).toBe(3)
  })
})

describe('buildNdviClassAreas', () => {
  // 1 ha por celda hace que el area sea el conteo: los numeros se leen solos.
  const field = (grid: Float32Array) => ({ grid, cellAreaHa: 1 })

  it('convierte celdas en hectareas y en porcentaje del area cubierta', () => {
    const r = buildNdviClassAreas(field(gridOf([10, 20, 70], CENTERS)), BANDS)!

    expect(r.coveredAreaHa).toBe(100)
    expect(r.classes.map((c) => c.areaHa)).toEqual([10, 20, 70])
    expect(r.classes.map((c) => c.pctArea)).toEqual([10, 20, 70])
  })

  it('las clases mas lo que queda sin clase suman el area cubierta', () => {
    const r = buildNdviClassAreas(field(gridOf([5, 5, 5], CENTERS, 12, 15)), BANDS)!
    const suma = r.classes.reduce((a, c) => a + c.areaHa, 0) + r.outsideAreaHa

    expect(suma).toBeCloseTo(r.coveredAreaHa, 10)
    // Las 12 celdas NaN quedan fuera del total: no son terreno medido.
    expect(r.coveredAreaHa).toBe(30)
    expect(r.outsideAreaHa).toBe(15)
    expect(r.pctOutside).toBeCloseTo(50)
  })

  it('escala el area con el tamaño real de la celda', () => {
    const grid = gridOf([4, 0, 0], CENTERS)
    const r = buildNdviClassAreas({ grid, cellAreaHa: 0.25 }, BANDS)!

    expect(r.classes[0]!.areaHa).toBeCloseTo(1)
    expect(r.coveredAreaHa).toBeCloseTo(1)
  })

  it('acompaña el area con el conteo de puntos, como contraste', () => {
    const r = buildNdviClassAreas(
      field(gridOf([50, 50, 0], CENTERS)),
      BANDS,
      [0.55, 0.65, 0.65, 0.65, null],
    )!

    expect(r.pointsWithValue).toBe(4)
    expect(r.classes.map((c) => c.pointCount)).toEqual([1, 3, 0])
    expect(r.classes[1]!.pctPoints).toBeCloseTo(75)
    // El area dice 50/50 y los puntos 25/75: son medidas distintas y no se mezclan.
    expect(r.classes[1]!.pctArea).toBeCloseTo(50)
  })

  it('reporta todo como sin clase cuando el indice se sale del rango configurado', () => {
    // Caso real: MSAVI2 (1.02..1.47) contra clases definidas en 0..1.
    const grid = Float32Array.from([1.1, 1.2, 1.3, 1.4])
    const r = buildNdviClassAreas({ grid, cellAreaHa: 1 }, BANDS)!

    expect(r.pctOutside).toBe(100)
    expect(r.classes.every((c) => c.areaHa === 0)).toBe(true)
  })

  it('devuelve null sin bandas o sin una sola celda con dato', () => {
    expect(buildNdviClassAreas(field(gridOf([1, 1, 1], CENTERS)), [])).toBeNull()
    expect(buildNdviClassAreas(field(Float32Array.from([NaN, NaN])), BANDS)).toBeNull()
  })

  it('etiqueta las clases sin nombre propio por su posicion', () => {
    const sinLabel: ClassBand[] = [{ min: 0.5, max: 0.6, color: '#fff' }]
    const r = buildNdviClassAreas(field(Float32Array.from([0.55])), sinLabel)!

    expect(r.classes[0]!.label).toBe('Clase 1')
  })
})

describe('formatBandRange', () => {
  it('escribe el rango y marca los extremos abiertos', () => {
    expect(formatBandRange(0.7, 0.8)).toBe('0.70 – 0.80')
    expect(formatBandRange(null, 0.4)).toBe('< 0.40')
    expect(formatBandRange(0.9, null)).toBe('≥ 0.90')
    expect(formatBandRange(null, null)).toBe('todo')
  })
})
