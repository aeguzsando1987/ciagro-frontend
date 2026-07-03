/**
 * Tests de AspersionMap (componente reutilizable extraído de AspersionMapModal).
 *
 * react-map-gl/maplibre rompe JSDOM (necesita WebGL) → se mockea completo.
 * Cubre: render embebido (toolbar de capas + leyenda), conmutación de capa,
 * toggle de leyenda y la función pura sumAreaByBucket.
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClientProvider } from '@tanstack/react-query'
import { createTestQueryClient } from '@/test/test-utils'

vi.mock('react-map-gl/maplibre', () => ({
  default: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="mock-map">{children}</div>
  ),
  Source: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Layer: () => null,
  Popup: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="mock-popup">{children}</div>
  ),
  Marker: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="mock-marker">{children}</div>
  ),
}))

const mockPoints = [
  {
    id: 'pt-1', session_header: 'sess-1', plot: null,
    geom: { type: 'Point', coordinates: [-101.088, 20.534] },
    course_deg: '277', boom_width_m: '13.97', distance_m: '1.5',
    applied_rate_l: '380', target_rate_l: '400',
    liquid_flow_ls: '0.6', boom_pressure_bar: '0.3',
    production_hah: '7.6', speed_kmh: '5.4', area_ha: '0.5',
  },
  {
    id: 'pt-2', session_header: 'sess-1', plot: null,
    geom: { type: 'Point', coordinates: [-101.087, 20.535] },
    course_deg: '277', boom_width_m: '13.97', distance_m: '1.5',
    applied_rate_l: '250', target_rate_l: '400', // 62.5% → Deficiente
    liquid_flow_ls: '1.2', boom_pressure_bar: '0.6',
    production_hah: '3.0', speed_kmh: '3.0', area_ha: '0.25',
  },
]

vi.mock('@/features/task-manager/hooks/useAspersionPoints', () => ({
  useAspersionPoints: () => ({ data: mockPoints, isLoading: false, error: null }),
}))
vi.mock('@/features/task-manager/hooks/usePlotGeometry', () => ({
  usePlotGeometry: () => ({ data: null }),
}))
vi.mock('@/features/task-manager/hooks/useAspersionVariableStats', () => ({
  useAspersionVariableStats: () => ({ data: null }),
}))
vi.mock('@/features/task-manager/hooks/useAspersionSessionStats', () => ({
  useAspersionSessionStats: () => ({ data: null }),
}))

import { AspersionMap, sumAreaByBucket, areaShareByBucket } from './AspersionMap'

function renderMap() {
  const qc = createTestQueryClient()
  return render(
    <QueryClientProvider client={qc}>
      <AspersionMap sessionId="sess-1" plotId={null} />
    </QueryClientProvider>,
  )
}

describe('AspersionMap', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renderiza los botones de capa embebido (sin chrome de modal)', async () => {
    renderMap()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Proporción volumen' })).toBeTruthy()
      expect(screen.getByRole('button', { name: 'Velocidad' })).toBeTruthy()
      expect(screen.getByRole('button', { name: 'Proporción meta' })).toBeTruthy()
      expect(screen.getByRole('button', { name: 'Rate Quality' })).toBeTruthy()
    })
    // No hay botón de cierre: es responsabilidad del contenedor (modal), no del mapa
    expect(screen.queryByText('✕ Cerrar')).toBeNull()
  })

  it('muestra la leyenda de Capa 1 (categorías) por defecto', async () => {
    renderMap()
    await waitFor(() => {
      expect(screen.getByText(/Deficiente/)).toBeTruthy()
      expect(screen.getByText(/Excelente/)).toBeTruthy()
    })
  })

  it('muestra el área por categoría en la Capa 1 (% aplicación)', async () => {
    renderMap()
    await waitFor(() => {
      expect(screen.getByText(/0\.5 ha/)).toBeTruthy()
      expect(screen.getByText(/0\.25 ha/)).toBeTruthy()
    })
  })

  it('cambia a leyenda de cuartiles al seleccionar Caudal', async () => {
    renderMap()
    await waitFor(() => screen.getByText('Caudal'))
    fireEvent.click(screen.getByText('Caudal'))
    await waitFor(() => {
      const q1Items = screen.getAllByText(/Q1/)
      expect(q1Items.length).toBeGreaterThan(0)
    })
  })

  it('el toggle de checkbox cambia el estado visual (tachado)', async () => {
    renderMap()
    await waitFor(() => screen.getByText(/Deficiente/))
    const deficienteLabel = screen.getByText(/Deficiente/).closest('label')!
    fireEvent.click(deficienteLabel)
    await waitFor(() => {
      const span = screen.getByText(/Deficiente/).closest('span')
      expect(span?.className).toContain('line-through')
    })
  })
})

describe('sumAreaByBucket', () => {
  function fc(features: Array<{ bucket: string; area_ha: number | null }>) {
    return {
      type: 'FeatureCollection' as const,
      features: features.map((p) => ({
        type: 'Feature' as const,
        geometry: { type: 'Polygon' as const, coordinates: [] },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        properties: { bucket: p.bucket, area_ha: p.area_ha } as any,
      })),
    }
  }

  it('suma el área por bucket', () => {
    const res = sumAreaByBucket(fc([
      { bucket: 'excelente', area_ha: 0.5 },
      { bucket: 'excelente', area_ha: 1.5 },
      { bucket: 'deficiente', area_ha: 0.25 },
    ]))
    expect(res.excelente).toBeCloseTo(2.0)
    expect(res.deficiente).toBeCloseTo(0.25)
  })

  it('ignora áreas null o no finitas', () => {
    const res = sumAreaByBucket(fc([
      { bucket: 'q1', area_ha: null },
      { bucket: 'q1', area_ha: 0.3 },
      { bucket: 'q2', area_ha: NaN },
    ]))
    expect(res.q1).toBeCloseTo(0.3)
    expect(res.q2).toBeUndefined()
  })
})

describe('areaShareByBucket', () => {
  it('calcula el % de área sobre la base y suma 100%', () => {
    const res = areaShareByBucket(
      { excelente: 3, regular: 1, deficiente: 0 },
      ['deficiente', 'regular', 'excelente'],
    )
    expect(res.excelente).toBeCloseTo(75)
    expect(res.regular).toBeCloseTo(25)
    expect(res.deficiente).toBeCloseTo(0)
    expect((res.deficiente ?? 0) + (res.regular ?? 0) + (res.excelente ?? 0)).toBeCloseTo(100)
  })

  it('acota la base a las keys indicadas (ignora buckets fuera, p. ej. sin_meta)', () => {
    const res = areaShareByBucket(
      { excelente: 3, regular: 1, sin_meta: 96 },
      ['regular', 'excelente'],
    )
    // sin_meta no entra en la base (3 + 1 = 4) ni en la salida
    expect(res.excelente).toBeCloseTo(75)
    expect(res.regular).toBeCloseTo(25)
    expect(res.sin_meta).toBeUndefined()
  })

  it('base 0 → 0 para todas las keys', () => {
    const res = areaShareByBucket({}, ['regular', 'excelente'])
    expect(res.regular).toBe(0)
    expect(res.excelente).toBe(0)
  })
})
