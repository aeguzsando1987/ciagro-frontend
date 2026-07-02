/**
 * Tests del GeodataDashboard: las tarjetas de estadísticas cambian según el nivel
 * seleccionado. Hooks de datos mockeados. El nivel DataCentral (que usa useQueries
 * para agregar) se cubre indirectamente vía las funciones puras en visorStats.test.
 */
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

vi.mock('react-map-gl/maplibre', () => ({
  default: ({ children }: { children?: React.ReactNode }) => <div data-testid="mock-map">{children}</div>,
  Source: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Layer: () => null,
  Marker: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock('@/features/admin/hooks/useProducers', () => ({
  useProducers: () => ({ data: [{ id: 'prod-1' }], isLoading: false }),
}))
vi.mock('@/features/admin/hooks/useRanches', () => ({
  useRanches: () => ({ data: [{ id: 'r1' }, { id: 'r2' }], isLoading: false }),
  ranchesQueryOptions: () => ({ queryKey: ['x'], queryFn: async () => [] }),
}))
vi.mock('@/features/admin/hooks/usePlots', () => ({
  usePlots: () => ({ data: [{ id: 'p1', total_area: '3' }, { id: 'p2', total_area: '2' }], isLoading: false }),
  usePlotDetail: () => ({ data: { id: 'p1', total_area: '4.5' }, isLoading: false }),
  plotsQueryOptions: () => ({ queryKey: ['y'], queryFn: async () => [] }),
}))
vi.mock('../hooks/useAspersionSessionHeaders', () => ({
  useAspersionSessionHeaders: () => ({ data: [{ id: 's1' }, { id: 's2' }, { id: 's3' }], isLoading: false }),
}))
// SessionInfoCard tiene su propio test (resuelve hooks + Link de router); aquí se aísla.
vi.mock('./SessionInfoCard', () => ({
  SessionInfoCard: () => <div data-testid="session-info-card" />,
}))
// Hooks del visor de aspersión (usados por AspersionMap en nivel sesión).
// La referencia del array DEBE ser estable: si cambia en cada render, el useMemo/effect
// de AspersionMap entra en bucle infinito (recalcula capas y resetea checkboxes sin fin).
const mockAspersionPoints = [{
  id: 'pt-1', geom: { type: 'Point', coordinates: [-101, 20.5] },
  course_deg: '0', boom_width_m: '14', distance_m: '1.5',
  applied_rate_l: '380', target_rate_l: '400', area_ha: '0.5',
}]
const mockPointsResult = { data: mockAspersionPoints, isLoading: false, error: null }
vi.mock('@/features/task-manager/hooks/useAspersionPoints', () => ({
  useAspersionPoints: () => mockPointsResult,
}))
vi.mock('@/features/task-manager/hooks/usePlotGeometry', () => ({ usePlotGeometry: () => ({ data: null }) }))
vi.mock('@/features/task-manager/hooks/useAspersionVariableStats', () => ({ useAspersionVariableStats: () => ({ data: null }) }))
vi.mock('@/features/task-manager/hooks/useAspersionSessionStats', () => ({ useAspersionSessionStats: () => ({ data: null }) }))
// SessionReportToggle (toolbarEnd del visor a nivel sesión) consulta el detalle de la sesión;
// se mockea para no requerir QueryClientProvider (sin datos → el toggle no renderiza).
vi.mock('@/features/task-manager/hooks/useAspersionSessionDetail', () => ({ useAspersionSessionDetail: () => ({ data: null }) }))

import { GeodataDashboard } from './GeodataDashboard'
import type { VisorSelection } from '../types'

const org = { id: 'org-1', name: 'Org' }

describe('GeodataDashboard', () => {
  it('nivel rancho: muestra Parcelas y Superficie + el mapa', () => {
    const sel: VisorSelection = { level: 'ranch', org, ranch: { id: 'r1', name: 'Rancho Norte' } }
    render(<GeodataDashboard selection={sel} onSelect={vi.fn()} />)
    // Aparece en el título y en la tarjeta flotante del mapa
    expect(screen.getAllByText('Rancho Norte').length).toBeGreaterThan(0)
    expect(screen.getByText('Parcelas')).toBeTruthy()
    expect(screen.getByText('Superficie')).toBeTruthy()
    expect(screen.getByText('2')).toBeTruthy() // 2 parcelas
    expect(screen.getByText(/5 ha/)).toBeTruthy() // 3 + 2
    expect(screen.getByTestId('mock-map')).toBeTruthy()
  })

  it('nivel parcela: muestra superficie y número de sesiones', () => {
    const sel: VisorSelection = { level: 'plot', org, ranch: { id: 'r1', name: 'Rancho Norte' }, plot: { id: 'p1', name: 'P-01' } }
    render(<GeodataDashboard selection={sel} onSelect={vi.fn()} />)
    // "Sesiones de aspersión" aparece como tarjeta de stat y como título del panel
    expect(screen.getAllByText('Sesiones de aspersión').length).toBeGreaterThan(0)
    expect(screen.getByText('3')).toBeTruthy() // 3 sesiones (stat)
    expect(screen.getByText(/4.5 ha/)).toBeTruthy()
  })

  it('nivel sesión: monta el visor de capas (AspersionMap) con el botón Parcela', () => {
    const sel: VisorSelection = {
      level: 'session', org,
      ranch: { id: 'r1', name: 'Rancho Norte' },
      plot: { id: 'p1', name: 'P-01' },
      session: { id: 's1', date: '2026-03-23' },
    }
    render(<GeodataDashboard selection={sel} onSelect={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Proporción volumen' })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Parcela/ })).toBeTruthy()
  })
})
