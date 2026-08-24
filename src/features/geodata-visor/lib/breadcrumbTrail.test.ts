import { describe, expect, it } from 'vitest'

import { breadcrumbTrail, selectionAtStep } from './breadcrumbTrail'
import type { VisorSelection } from '../types'

const ORG = { id: 'org-1', name: 'Organización Uno' }
const DC = { id: 'dc-1', name: 'CIAgro Norte' }
const PROD = { id: 'ag-1', name: 'Agrounidad Uno' }
const RANCH = { id: 'r-1', name: 'Rancho Norte' }
const PLOT = { id: 'p-1', name: 'P-001' }

const EN_SESION: VisorSelection = {
  level: 'session',
  org: ORG,
  datacentral: DC,
  producer: PROD,
  ranch: RANCH,
  plot: PLOT,
  session: { id: 's-1', kind: 'aspersion', date: '2026-03-10' },
}

describe('breadcrumbTrail — dónde está el usuario', () => {
  it('en la sesión más profunda enumera los seis escalones en orden', () => {
    expect(breadcrumbTrail(EN_SESION).map((p) => p.name)).toEqual([
      'Organización Uno',
      'CIAgro Norte',
      'Agrounidad Uno',
      'Rancho Norte',
      'P-001',
      '2026-03-10',
    ])
  })

  it('a media profundidad enumera solo hasta donde llega', () => {
    const enRancho: VisorSelection = {
      level: 'ranch', org: ORG, datacentral: DC, producer: PROD, ranch: RANCH,
    }
    expect(breadcrumbTrail(enRancho).map((p) => p.level)).toEqual([
      'org', 'datacentral', 'producer', 'ranch',
    ])
  })

  it('en la organización sola deja un único escalón', () => {
    expect(breadcrumbTrail({ level: 'org', org: ORG })).toHaveLength(1)
  })
})

describe('selectionAtStep — subir a un escalón', () => {
  it('conserva los ancestros y descarta los descendientes', () => {
    // Sin descartarlos, el panel mostraría los datos de un nivel con el título de otro.
    const subida = selectionAtStep(EN_SESION, 'producer')
    expect(subida.level).toBe('producer')
    expect(subida.org).toEqual(ORG)
    expect(subida.datacentral).toEqual(DC)
    expect(subida.producer).toEqual(PROD)
    expect(subida.ranch).toBeUndefined()
    expect(subida.plot).toBeUndefined()
    expect(subida.session).toBeUndefined()
  })

  it('subir a la CIAgro deja el estado del panel de bienvenida', () => {
    // Es el camino de vuelta al dashboard desde cualquier profundidad.
    const subida = selectionAtStep(EN_SESION, 'datacentral')
    expect(subida.level).toBe('datacentral')
    expect(subida.datacentral).toEqual(DC)
    expect(subida.producer).toBeUndefined()
  })

  it('subir a la organización no arrastra nada por debajo', () => {
    const subida = selectionAtStep(EN_SESION, 'org')
    expect(subida).toEqual({ level: 'org', org: ORG })
  })
})
