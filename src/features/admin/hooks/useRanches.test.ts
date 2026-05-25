import { describe, it, expect } from 'vitest'
import type { components } from '@/types/api'

/**
 * Tests de la lógica de aplanado de FeatureCollection.
 * El backend devuelve GeoJSON FeatureCollection; los hooks aplanan
 * { ...f.properties, id: f.id, geom: f.geometry } para que el UI trabaje
 * con objetos planos en lugar de la estructura GeoJSON anidada.
 */

function flattenRanch(f: components['schemas']['Ranch']) {
  return { ...(f.properties ?? {}), id: f.id!, geom: f.geometry ?? null }
}

function flattenPlot(f: components['schemas']['Plot']) {
  return { ...(f.properties ?? {}), id: f.id!, geom: f.geometry ?? null }
}

const RANCH_FEATURE: components['schemas']['Ranch'] = {
  type: 'Feature',
  id: 'uuid-r1',
  geometry: { type: 'Point', coordinates: [-99.15, 18.95] },
  properties: {
    code: 'R-001',
    name: 'Rancho El Fresno',
    producer: 'uuid-p1',
    status: 'active',
    area_uom: 'ha',
    total_area: '250.00',
  },
}

const PLOT_FEATURE: components['schemas']['Plot'] = {
  type: 'Feature',
  id: 'uuid-pl1',
  geometry: {
    type: 'Polygon',
    coordinates: [[[-99.2, 18.9], [-99.1, 18.9], [-99.1, 19.0], [-99.2, 19.0], [-99.2, 18.9]]],
  },
  properties: {
    code: 'PLT-001',
    ranch: 'uuid-r1',
    status: 'active',
    total_area: '11500.00',
    tech_spraying: false,
  },
}

describe('flattenRanch — aplanado de GeoJSON Feature a objeto plano', () => {
  it('eleva id y geometry al nivel raíz', () => {
    const flat = flattenRanch(RANCH_FEATURE)
    expect(flat.id).toBe('uuid-r1')
    expect(flat.geom).toEqual({ type: 'Point', coordinates: [-99.15, 18.95] })
  })

  it('preserva todas las properties del rancho', () => {
    const flat = flattenRanch(RANCH_FEATURE)
    expect(flat.code).toBe('R-001')
    expect(flat.name).toBe('Rancho El Fresno')
    expect(flat.producer).toBe('uuid-p1')
    expect(flat.status).toBe('active')
    expect(flat.total_area).toBe('250.00')
  })

  it('usa null como geom cuando geometry es undefined', () => {
    const noGeom: components['schemas']['Ranch'] = { ...RANCH_FEATURE, geometry: undefined }
    const flat = flattenRanch(noGeom)
    expect(flat.geom).toBeNull()
  })
})

describe('flattenPlot — aplanado de GeoJSON Feature de Polygon', () => {
  it('eleva id y geometry (Polygon) al nivel raíz', () => {
    const flat = flattenPlot(PLOT_FEATURE)
    expect(flat.id).toBe('uuid-pl1')
    expect(flat.geom?.type).toBe('Polygon')
    expect(flat.geom?.coordinates?.[0]).toHaveLength(5)
  })

  it('preserva total_area calculada por el backend (no recalcular en frontend)', () => {
    const flat = flattenPlot(PLOT_FEATURE)
    // total_area viene del backend (Plot.save() via PostGIS), no del cliente
    expect(flat.total_area).toBe('11500.00')
  })
})
