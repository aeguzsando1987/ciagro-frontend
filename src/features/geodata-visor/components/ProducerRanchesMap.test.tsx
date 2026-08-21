/**
 * Polígonos de las parcelas a nivel de productor, sobre imagen satelital.
 *
 * Antes este mapa solo pintaba un pin por rancho, así que no se apreciaba la extensión
 * real. Ahora dibuja las parcelas coloreadas por rancho, con el pin encima.
 *
 * Los colores van en ORDEN FIJO y no se ciclan: el rancho número 7 no reutiliza el
 * color del primero, se va a un gris neutro. Ciclar haría creer que dos ranchos
 * distintos son el mismo.
 */
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { ProducerRanchesMap } from './ProducerRanchesMap'
import type { PlotFlat, RanchFlat } from '@/features/admin/types'

/** El mapa real necesita WebGL; se sustituye por un espía de lo que se le pasa. */
const capas = vi.hoisted(() => ({ ultimaData: null as unknown }))

vi.mock('react-map-gl/maplibre', () => ({
  default: ({ children }: { children?: React.ReactNode }) => <div data-testid="mapa">{children}</div>,
  Marker: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Source: ({ data, children }: { data: unknown; children?: React.ReactNode }) => {
    capas.ultimaData = data
    return <div data-testid="source">{children}</div>
  },
  Layer: () => null,
}))
vi.mock('../lib/mapModes', () => ({ useMapMode: () => ({ mapMode: 'satellite', setMapMode: vi.fn() }) }))
vi.mock('../lib/mapCameraSync', () => ({ useMapCameraSync: () => vi.fn() }))
vi.mock('./MapModeSelector', () => ({ MapModeSelector: () => null }))

function rancho(id: string): RanchFlat {
  return { id, code: id, name: `Rancho ${id}` } as RanchFlat
}

function parcela(id: string, ranchId: string): PlotFlat {
  return {
    id,
    code: id,
    ranch: ranchId,
    geom: { type: 'Polygon', coordinates: [[[-103, 20], [-103, 21], [-102, 21], [-103, 20]]] },
  } as unknown as PlotFlat
}

function colores() {
  const fc = capas.ultimaData as GeoJSON.FeatureCollection
  return fc.features.map((f) => f.properties?.['color'] as string)
}

describe('ProducerRanchesMap', () => {
  it('dibuja los polígonos de las parcelas, no solo los pines', () => {
    render(
      <ProducerRanchesMap
        ranches={[rancho('r1')]}
        plots={[parcela('p1', 'r1')]}
        onSelectRanch={vi.fn()}
      />
    )
    expect(screen.getByTestId('source')).toBeInTheDocument()
    const fc = capas.ultimaData as GeoJSON.FeatureCollection
    expect(fc.features).toHaveLength(1)
  })

  it('da un color distinto a cada rancho', () => {
    render(
      <ProducerRanchesMap
        ranches={[rancho('r1'), rancho('r2')]}
        plots={[parcela('p1', 'r1'), parcela('p2', 'r2')]}
        onSelectRanch={vi.fn()}
      />
    )
    const [a, b] = colores()
    expect(a).toBeTruthy()
    expect(a).not.toBe(b)
  })

  it('las parcelas del MISMO rancho comparten color', () => {
    render(
      <ProducerRanchesMap
        ranches={[rancho('r1')]}
        plots={[parcela('p1', 'r1'), parcela('p2', 'r1')]}
        onSelectRanch={vi.fn()}
      />
    )
    const [a, b] = colores()
    expect(a).toBe(b)
  })

  it('no cicla la paleta: el séptimo rancho cae a un neutro', () => {
    const ranchos = Array.from({ length: 7 }, (_, i) => rancho(`r${i}`))
    const parcelas = ranchos.map((r, i) => parcela(`p${i}`, r.id))
    render(<ProducerRanchesMap ranches={ranchos} plots={parcelas} onSelectRanch={vi.fn()} />)

    const lista = colores()
    expect(lista[6]).toBe('#94a3b8')
    // Y no repite el color del primero, que es lo que haría una paleta cíclica.
    expect(lista[6]).not.toBe(lista[0])
  })

  it('ignora parcelas de ranchos que no son de este productor', () => {
    render(
      <ProducerRanchesMap
        ranches={[rancho('r1')]}
        plots={[parcela('p1', 'r1'), parcela('p-ajena', 'r-otro')]}
        onSelectRanch={vi.fn()}
      />
    )
    const fc = capas.ultimaData as GeoJSON.FeatureCollection
    expect(fc.features).toHaveLength(1)
  })
})
