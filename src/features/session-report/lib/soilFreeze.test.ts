/**
 * Traduccion raster -> payload de congelado (RS-15).
 *
 * Lo que se prueba es la alineacion de identificadores: `band-{i}` del visor con
 * `classes[].index` del backend con `palette[i]` del PDF. Si se corre uno, la
 * leyenda del PDF sale con los colores cambiados de clase — y eso no lanza ningun
 * error, simplemente miente.
 */
import { describe, expect, it } from 'vitest'
import { buildFreezePayload } from './soilFreeze'

/** Tres bandas, en orden de paleta (valor alto -> bajo), como el visor. */
const ENTRIES = [
  { key: 'band-0', color: '#a00', label: '7–9' },
  { key: 'band-1', color: '#fa0', label: '5–7' },
  { key: 'band-2', color: '#0a0', label: '3–5' },
]
const BREAKS = [5, 7]

function base(over: Partial<Parameters<typeof buildFreezePayload>[0]> = {}) {
  return buildFreezePayload({
    layerKey: 'ph',
    entries: ENTRIES,
    breaks: BREAKS,
    sampleBuckets: ['band-0', 'band-1', 'band-1', 'band-2'],
    bucketCellCounts: { 'band-0': 10, 'band-1': 10, 'band-2': 80 },
    totalAreaHa: 100,
    ...over,
  })
}

describe('buildFreezePayload', () => {
  it('el índice de clase sigue el orden de la paleta, no el de llegada', () => {
    const p = base()!
    expect(p.classes.map((c) => c.index)).toEqual([0, 1, 2])
    expect(p.classes.map((c) => c.label)).toEqual(['7–9', '5–7', '3–5'])
  })

  it('publica las DOS bases, que reparten distinto', () => {
    const p = base()!
    // Por muestras: 1 de 4 puntos en band-0 = 25 %.
    expect(p.classes[0]!.by_points).toEqual({ count: 1, pct: 25, area_ha: 25 })
    // Por superficie: 10 de 100 celdas = 10 %. Que difiera es justo el dato util —
    // esa clase ocupa menos terreno del que sugieren sus muestras.
    expect(p.classes[0]!.by_area).toEqual({ pct: 10, area_ha: 10 })
  })

  it('sin raster omite by_area en vez de copiar el de muestras', () => {
    // Dos columnas iguales fingiendo ser dos medidas distintas seria peor que una.
    const p = base({ bucketCellCounts: null })!
    expect(p.classes[0]!.by_area).toBeUndefined()
    expect(p.classes[0]!.by_points.pct).toBe(25)
  })

  it('sin superficie de parcela el porcentaje sigue, las hectáreas no', () => {
    const p = base({ totalAreaHa: null })!
    expect(p.classes[0]!.by_points.pct).toBe(25)
    expect(p.classes[0]!.by_points.area_ha).toBeNull()
  })

  it('una clase sin muestras va en cero, no se omite', () => {
    // El PDF dibuja `class_count` filas: una clase ausente correria la leyenda.
    const p = base({ sampleBuckets: ['band-0', 'band-0'] })!
    expect(p.classes).toHaveLength(3)
    expect(p.classes[2]!.by_points).toEqual({ count: 0, pct: 0, area_ha: 0 })
  })

  it('rechaza un número de cortes que no cuadra con la paleta (H8)', () => {
    // Se valida antes de subir: a mitad de una publicacion de N capas conviene
    // detectarlo sin gastar el viaje.
    expect(base({ breaks: [5] })).toBeNull()
    expect(base({ breaks: [4, 5, 6] })).toBeNull()
  })

  it('una capa de una sola clase no lleva ningún corte', () => {
    const p = buildFreezePayload({
      layerKey: 'iron',
      entries: [{ key: 'band-0', color: '#f00', label: '0–9' }],
      breaks: [],
      sampleBuckets: ['band-0', 'band-0'],
      bucketCellCounts: { 'band-0': 100 },
      totalAreaHa: 50,
    })!
    expect(p.breaks).toEqual([])
    expect(p.classes).toHaveLength(1)
    expect(p.classes[0]!.by_points.pct).toBe(100)
  })

  /**
   * DEFECTO REAL, hallado por el dev: "Los rangos de la capa texture_class no
   * cuadran con su paleta". Una capa CATEGORICA no tiene rangos —sus clases son
   * las categorias del dato—, pero la validacion les exigia `clases - 1` cortes.
   */
  it('una capa categórica se congela SIN cortes', () => {
    const p = buildFreezePayload({
      layerKey: 'texture_class',
      kind: 'category',
      entries: [
        { key: 'cat-franco', color: '#a', label: 'franco' },
        { key: 'cat-arcilloso', color: '#b', label: 'arcilloso' },
      ],
      breaks: [],
      sampleBuckets: ['cat-franco', 'cat-franco', 'cat-arcilloso'],
      bucketCellCounts: null,
      totalAreaHa: 30,
    })!
    expect(p).not.toBeNull()
    expect(p.breaks).toEqual([])
    expect(p.classes).toHaveLength(2)
  })

  it('la categórica lleva su color: no se deduce por índice de paleta', () => {
    // Sus clases no corresponden 1:1 con la paleta (physical_compaction tiene 1
    // color y 2 categorias), asi que el PDF no puede sacarlo del catalogo.
    const p = buildFreezePayload({
      layerKey: 'texture_class', kind: 'category',
      entries: [{ key: 'cat-franco', color: '#abc', label: 'franco' }],
      breaks: [], sampleBuckets: ['cat-franco'], bucketCellCounts: null, totalAreaHa: 10,
    })!
    expect(p.classes[0]!.color).toBe('#abc')
  })

  it('una numérica SÍ sigue exigiendo sus cortes', () => {
    // La correccion de las categoricas no debe aflojar la validacion de las demas.
    expect(base({ breaks: [5] })).toBeNull()
  })

  it('la numérica no manda color: se lee del catálogo al renderizar', () => {
    // Asi un reporte congelado antes de un cambio de paleta sale con la nueva.
    expect(base()!.classes[0]!.color).toBeUndefined()
  })

  it('sin bandas no hay payload', () => {
    expect(base({ entries: [] })).toBeNull()
  })

  it('adjunta el histograma solo si trae barras', () => {
    expect(base({ histogram: { bin_count: 0, bins: [] } })!.histogram).toBeUndefined()
    const conBins = base({
      histogram: { bin_count: 1, bins: [{ lower: 3, upper: 9, count: 4 }] },
    })!
    expect(conBins.histogram!.bins).toHaveLength(1)
  })
})
