import { describe, expect, it } from 'vitest'
import {
  SOIL_MAP_LAYERS,
  buildNumericScale,
  categoryColor,
  formatSoilValue,
  numericBucket,
} from './soilMapLayers'

describe('SOIL_MAP_LAYERS', () => {
  it('ofrece las 49 variables solicitadas sin claves duplicadas', () => {
    expect(SOIL_MAP_LAYERS).toHaveLength(49)
    expect(new Set(SOIL_MAP_LAYERS.map((layer) => layer.key)).size).toBe(49)
    expect(SOIL_MAP_LAYERS.map((layer) => layer.field)).toEqual(
      expect.arrayContaining([
        'Countrate',
        'OM',
        'Clay',
        'Silt',
        'Sand',
        'classtexture',
        'compfisic',
        'compquim',
        'pH',
        'Na_bse',
        'P_total',
        'K_total',
        'Ca_total',
        'Mg_total',
        'Zn_disp',
        'lim_inf_CC',
        'Cap_efi_fert',
        'C_de_MO',
      ])
    )
  })

  it('conserva las paletas entregadas en orden alto a bajo', () => {
    expect(SOIL_MAP_LAYERS.find((layer) => layer.key === 'countrate')?.palette).toEqual([
      '#FF0100',
      '#FF8800',
      '#FFE100',
      '#F8FF00',
      '#00D8FF',
      '#008FFF',
      '#0C00FF',
    ])
    expect(SOIL_MAP_LAYERS.find((layer) => layer.key === 'ph')?.palette).toEqual([
      '#FF0000',
      '#FF6F00',
      '#FF9700',
      '#FFCF00',
      '#FFF500',
      '#F2FF00',
      '#BFFF00',
    ])
    expect(
      SOIL_MAP_LAYERS.find((layer) => layer.key === 'manganese_available')?.palette
    ).toHaveLength(8)
    expect(SOIL_MAP_LAYERS.find((layer) => layer.key === 'iron')?.palette).toEqual(['#FF0000'])
  })

  it('usa colores oficiales solo para las clases texturales conocidas', () => {
    const textureLayer = SOIL_MAP_LAYERS.find((layer) => layer.key === 'texture_class')
    expect(textureLayer?.kind).toBe('category')
    if (!textureLayer || textureLayer.kind !== 'category') return

    expect(categoryColor(textureLayer, 'Arcilloso', 0)).toBe('#6A3535')
    expect(categoryColor(textureLayer, 'Franco', 1)).toBe('#804040')
    expect(categoryColor(textureLayer, 'Franco limoso arcilloso', 2)).toBe('#F0F0F0')
    expect(categoryColor(textureLayer, 'Arenoso', 3)).toBe('#94A3B8')
    expect(categoryColor(textureLayer, 'Franco Limoso', 4)).toBe('#94A3B8')
  })

  it('distingue la compactación física conocida de categorías aún no definidas', () => {
    const layer = SOIL_MAP_LAYERS.find((candidate) => candidate.key === 'physical_compaction')
    expect(layer?.kind).toBe('category')
    if (!layer || layer.kind !== 'category') return

    expect(categoryColor(layer, 'Baja compactación', 0)).toBe('#BC92BC')
    expect(categoryColor(layer, 'Desconocido', 1)).toBe('#94A3B8')
  })
})

describe('escala numérica de suelo', () => {
  const palette = ['#A00000', '#B00000', '#C00000', '#D00000', '#E00000', '#F00000', '#FFFFFF']
  const scale = buildNumericScale([1, 2, 3, 4, 5, 6, 7], palette, '')!

  it('crea un rango filtrable por cada color', () => {
    expect(scale.entries).toHaveLength(7)
    expect(scale.entries.map((entry) => entry.color)).toEqual(palette)
  })

  it('coloca el valor más alto en el primer color y el más bajo en el último', () => {
    expect(numericBucket(7, scale.breaks, palette.length)).toBe('band-0')
    expect(numericBucket(1, scale.breaks, palette.length)).toBe('band-6')
    expect(scale.entries[0]?.label).toMatch(/–7$/)
    expect(scale.entries[6]?.label).toMatch(/^1–/)
  })
})

describe('formatSoilValue', () => {
  it('agrega la unidad únicamente cuando existe', () => {
    expect(formatSoilValue(6.825, '')).toBe('6.83')
    expect(formatSoilValue(12.4, '%')).toBe('12.4 %')
  })
})
