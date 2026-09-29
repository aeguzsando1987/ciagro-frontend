import { describe, expect, it } from 'vitest'
import { copernicusAttribution } from './ndviAttribution'

describe('copernicusAttribution', () => {
  it('acredita a Copernicus en sesiones de satelite, con el año de la fecha de imagen', () => {
    expect(copernicusAttribution('sentinel2', '2024-10-25')).toBe(
      'Datos de Copernicus Sentinel 2024, procesados a través del catálogo de Sentinel Hub.',
    )
  })

  it('no acredita a Copernicus datos importados por CSV', () => {
    // Serian datos de un proveedor externo: la atribucion seria falsa.
    expect(copernicusAttribution('csv', '2024-10-25')).toBeNull()
  })

  it('no acredita nada cuando el backend no manda el origen', () => {
    expect(copernicusAttribution(null, '2024-10-25')).toBeNull()
    expect(copernicusAttribution(undefined, '2024-10-25')).toBeNull()
  })

  it('cae al instante de la pasada cuando la sesion no tiene fecha de imagen', () => {
    expect(copernicusAttribution('sentinel2', null, '2023-07-14T17:32:00Z')).toContain('2023')
  })

  it('no inventa un año cuando no hay ninguna fecha', () => {
    expect(copernicusAttribution('sentinel2', null, null)).toBeNull()
  })
})
