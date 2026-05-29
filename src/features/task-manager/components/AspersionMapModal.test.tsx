/**
 * Tests de AspersionMapModal (wrapper de Dialog sobre AspersionMap).
 *
 * react-map-gl/maplibre rompe JSDOM (necesita WebGL), por lo que se mockea
 * por completo. El foco está en: renderizado condicional del Dialog, presencia
 * del chrome (botón cerrar) y que el contenido reutilizado (AspersionMap) se
 * monta dentro del modal. La lógica fina de capas/leyenda se prueba en
 * AspersionMap.test.tsx.
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

// ─── Mock de hooks de datos (resuelven al mismo módulo que importa AspersionMap) ─
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
vi.mock('../hooks/useAspersionSessionStats', () => ({
  useAspersionSessionStats: () => ({ data: null }),
}))

import { AspersionMapModal } from './AspersionMapModal'

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

describe('AspersionMapModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renderiza los 5 botones de capa cuando hay puntos', async () => {
    renderModal()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '% de aplicación' })).toBeTruthy()
      expect(screen.getByRole('button', { name: 'Flujo líquido' })).toBeTruthy()
      expect(screen.getByRole('button', { name: 'Presión de brazo' })).toBeTruthy()
      expect(screen.getByRole('button', { name: 'Producción' })).toBeTruthy()
      expect(screen.getByRole('button', { name: 'Velocidad' })).toBeTruthy()
    })
  })

  it('renderiza el botón de cierre del modal', async () => {
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

  it('no renderiza el mapa cuando open=false', () => {
    renderModal(false)
    expect(screen.queryByTestId('mock-map')).toBeNull()
  })
})
