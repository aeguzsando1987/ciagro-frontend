/**
 * Tests de AspersionMapModal.
 *
 * react-map-gl/maplibre rompe JSDOM (necesita WebGL), por lo que se mockea
 * por completo. El foco está en: renderizado condicional, selección de capas
 * y toggles de la leyenda — toda la lógica de UI que no depende del canvas.
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClientProvider } from '@tanstack/react-query'
import { createTestQueryClient } from '@/test/test-utils'

// ─── Mock de react-map-gl/maplibre (WebGL no existe en JSDOM) ────────────────
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

// ─── Mock de hooks de datos ──────────────────────────────────────────────────
// MSW no intercepta apiClient (openapi-fetch captura fetch al crearse).
// Mockeamos los hooks directamente para controlar los datos en los tests.

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

vi.mock('../hooks/useAspersionPoints', () => ({
  useAspersionPoints: () => ({ data: mockPoints, isLoading: false, error: null }),
}))

vi.mock('../hooks/usePlotGeometry', () => ({
  usePlotGeometry: () => ({ data: null }),
}))

vi.mock('../hooks/useAspersionVariableStats', () => ({
  useAspersionVariableStats: () => ({ data: null }),
}))

// useAspersionSessionStats está definido en el mismo módulo que AspersionMapModal
// lo mockeamos como parte del módulo para que devuelva null stats
vi.mock('../components/AspersionMapModal', async (importOriginal) => {
  const mod = await importOriginal<typeof import('./AspersionMapModal')>()
  return {
    ...mod,
    useAspersionSessionStats: () => ({ data: null }),
  }
})

import { AspersionMapModal, sumAreaByBucket } from './AspersionMapModal'

// ─── Wrapper de test ─────────────────────────────────────────────────────────

function renderModal(open = true, onClose = vi.fn()) {
  const qc = createTestQueryClient()
  return render(
    <QueryClientProvider client={qc}>
      <AspersionMapModal
        open={open}
        onClose={onClose}
        sessionId="sess-1"
        plotId={null}
      />
    </QueryClientProvider>,
  )
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('AspersionMapModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renderiza los 5 botones de capa cuando hay puntos', async () => {
    renderModal()
    await waitFor(() => {
      // getByRole filtra solo botones — descarta el span del título de la leyenda
      expect(screen.getByRole('button', { name: '% de aplicación' })).toBeTruthy()
      expect(screen.getByRole('button', { name: 'Flujo líquido' })).toBeTruthy()
      expect(screen.getByRole('button', { name: 'Presión de brazo' })).toBeTruthy()
      expect(screen.getByRole('button', { name: 'Producción' })).toBeTruthy()
      expect(screen.getByRole('button', { name: 'Velocidad' })).toBeTruthy()
    })
  })

  it('renderiza el botón de cierre', async () => {
    renderModal()
    await waitFor(() => {
      expect(screen.getByText('✕ Cerrar')).toBeTruthy()
    })
  })

  it('llama a onClose al hacer click en "✕ Cerrar"', async () => {
    const onClose = vi.fn()
    renderModal(true, onClose)
    await waitFor(() => screen.getByText('✕ Cerrar'))
    fireEvent.click(screen.getByText('✕ Cerrar'))
    expect(onClose).toHaveBeenCalled()
  })

  it('muestra la leyenda de Capa 1 (categorías) por defecto', async () => {
    renderModal()
    await waitFor(() => {
      expect(screen.getByText(/Deficiente/)).toBeTruthy()
      expect(screen.getByText(/Excelente/)).toBeTruthy()
    })
  })

  it('muestra el área por categoría en la Capa 1 (% aplicación)', async () => {
    renderModal()
    await waitFor(() => {
      // pt-1 (Excelente) area 0.5 ha; pt-2 (Deficiente) area 0.25 ha
      expect(screen.getByText(/0\.5 ha/)).toBeTruthy()
      expect(screen.getByText(/0\.25 ha/)).toBeTruthy()
    })
  })

  it('cambia a leyenda de cuartiles al seleccionar Capa 2 (Flujo líquido)', async () => {
    renderModal()
    await waitFor(() => screen.getByText('Flujo líquido'))
    fireEvent.click(screen.getByText('Flujo líquido'))
    await waitFor(() => {
      // Q1/Q2/Q3/Q4 deben aparecer en los labels de la leyenda
      const q1Items = screen.getAllByText(/Q1/)
      expect(q1Items.length).toBeGreaterThan(0)
    })
  })

  it('el toggle de checkbox cambia el estado visual (tachado)', async () => {
    renderModal()
    await waitFor(() => screen.getByText(/Deficiente/))

    // Encontrar el label del checkbox de "Deficiente"
    const deficienteLabel = screen.getByText(/Deficiente/).closest('label')!
    // Hacer click para desmarcar
    fireEvent.click(deficienteLabel)

    // Después del click el texto debería aparecer tachado (line-through class)
    await waitFor(() => {
      const span = screen.getByText(/Deficiente/).closest('span')
      expect(span?.className).toContain('line-through')
    })
  })

  it('no renderiza el mapa cuando open=false', () => {
    renderModal(false)
    expect(screen.queryByTestId('mock-map')).toBeNull()
  })
})

describe('sumAreaByBucket', () => {
  function fc(features: Array<{ bucket: string; area_ha: number | null }>) {
    return {
      type: 'FeatureCollection' as const,
      features: features.map((p) => ({
        type: 'Feature' as const,
        geometry: { type: 'Polygon' as const, coordinates: [] },
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
