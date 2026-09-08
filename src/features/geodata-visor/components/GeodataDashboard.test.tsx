/**
 * Tests del GeodataDashboard: las tarjetas de estadísticas cambian según el nivel
 * seleccionado. Hooks de datos mockeados. El nivel DataCentral (que usa useQueries
 * para agregar) se cubre indirectamente vía las funciones puras en visorStats.test.
 *
 * El panel de estadísticas arranca COLAPSADO (el mapa y la línea de tiempo ganan alto),
 * así que los tests que aseveran sobre las tarjetas abren el panel primero con
 * `showStats()`. Ese contrato lo fija `arranca con las estadísticas ocultas`.
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

vi.mock('react-map-gl/maplibre', () => ({
  default: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="mock-map">{children}</div>
  ),
  Source: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Layer: () => null,
  Popup: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
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
  usePlots: () => ({
    data: [
      { id: 'p1', total_area: '3' },
      { id: 'p2', total_area: '2' },
    ],
    isLoading: false,
  }),
  usePlotDetail: () => ({ data: { id: 'p1', total_area: '4.5' }, isLoading: false }),
  plotsQueryOptions: () => ({ queryKey: ['y'], queryFn: async () => [] }),
}))
vi.mock('../hooks/useAspersionSessionHeaders', () => ({
  useAspersionSessionHeaders: () => ({
    data: [{ id: 's1' }, { id: 's2' }, { id: 's3' }],
    isLoading: false,
  }),
}))
vi.mock('../hooks/usePhytoSessionHeaders', () => ({
  usePhytoSessionHeaders: () => ({ data: [{ id: 'ph1' }, { id: 'ph2' }], isLoading: false }),
}))
vi.mock('../hooks/useNdviSessionHeaders', () => ({
  useNdviSessionHeaders: () => ({ data: [{ id: 'nd1' }], isLoading: false }),
}))

vi.mock('../hooks/useSoilMapSessionHeaders', () => ({
  useSoilMapSessionHeaders: () => ({
    data: [{ id: 'sm1', mapping_date: '2026-04-15', points_count: '3' }],
    isLoading: false,
  }),
}))
// SessionInfoCard tiene su propio test (resuelve hooks + Link de router); aquí se aísla.
vi.mock('./SessionInfoCard', () => ({
  SessionInfoCard: () => <div data-testid="session-info-card" />,
}))
vi.mock('./SoilMapSessionInfoCard', () => ({
  SoilMapSessionInfoCard: () => <div data-testid="soil-map-session-info-card" />,
}))
vi.mock('./SoilElevationSummary', () => ({
  SoilElevationSummary: ({ sessionId }: { sessionId: string }) => (
    <div data-testid="soil-elevation-summary">{sessionId}</div>
  ),
}))
// Hooks del visor de aspersión (usados por AspersionMap en nivel sesión).
// La referencia del array DEBE ser estable: si cambia en cada render, el useMemo/effect
// de AspersionMap entra en bucle infinito (recalcula capas y resetea checkboxes sin fin).
const mockAspersionPoints = [
  {
    id: 'pt-1',
    geom: { type: 'Point', coordinates: [-101, 20.5] },
    course_deg: '0',
    boom_width_m: '14',
    distance_m: '1.5',
    applied_rate_l: '380',
    target_rate_l: '400',
    area_ha: '0.5',
  },
]
const mockPointsResult = { data: mockAspersionPoints, isLoading: false, error: null }
vi.mock('@/features/task-manager/hooks/useAspersionPoints', () => ({
  useAspersionPoints: () => mockPointsResult,
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
// SessionReportToggle (toolbarEnd del visor a nivel sesión) consulta el detalle de la sesión;
// se mockea para no requerir QueryClientProvider (sin datos → el toggle no renderiza).
// Ambos, no solo el de aspersion: el toggle consulta los dos hooks siempre —no se
// pueden llamar condicionalmente— y pasa null al que no aplica (RS-12).
vi.mock('@/features/task-manager/hooks/useAspersionSessionDetail', () => ({
  useAspersionSessionDetail: () => ({ data: null }),
}))
vi.mock('@/features/task-manager/hooks/useSoilMapSessionDetail', () => ({
  useSoilMapSessionDetail: () => ({ data: null }),
}))
// El mapa de suelo carga en dos partes (geometría y valores de la capa activa) y
// consulta un tercer endpoint para saber qué capas tienen datos. Los tres hooks
// se mockean: sin esto llamarían a useQuery de verdad, y aquí no hay
// QueryClientProvider porque las dependencias se sustituyen hook por hook.
const mockSoilMapPoints = [
  { id: 'smp-1', geom: { type: 'Point', coordinates: [-101, 20.5] } },
  { id: 'smp-2', geom: { type: 'Point', coordinates: [-101.01, 20.51] } },
  { id: 'smp-3', geom: { type: 'Point', coordinates: [-101.02, 20.52] } },
]
const mockSoilMapValues = new Map<string, number>([
  ['smp-1', 5.5],
  ['smp-2', 6.5],
  ['smp-3', 7.5],
])
const mockSoilMapStats = {
  header_id: 'soil-1',
  points_count: 3,
  variables: [{ key: 'pH', label: 'pH', count: 3, mean: 6.5, min: 5.5, max: 7.5, stddev: 1 }],
  text_variables: [],
}
vi.mock('@/features/task-manager/hooks/useSoilMapPoints', () => ({
  useSoilMapPoints: () => ({ data: mockSoilMapPoints, isLoading: false, error: null }),
}))
vi.mock('@/features/task-manager/hooks/useSoilMapLayerValues', () => ({
  useSoilMapRelativeElevations: () => ({ data: undefined }),
  useSoilMapLayerValues: () => ({ data: mockSoilMapValues, isLoading: false, error: null }),
}))
vi.mock('@/features/task-manager/hooks/useSoilMapVariableStats', async (importOriginal) => ({
  ...(await importOriginal<
    typeof import('@/features/task-manager/hooks/useSoilMapVariableStats')
  >()),
  useSoilMapVariableStats: () => ({ data: mockSoilMapStats, isLoading: false, error: null }),
}))

import { GeodataDashboard } from './GeodataDashboard'
import type { VisorSelection } from '../types'

const org = { id: 'org-1', name: 'Org' }

/** Despliega el panel de estadísticas, que nace colapsado en los niveles con mapa. */
function showStats() {
  fireEvent.click(screen.getByRole('button', { name: 'Mostrar estadísticas' }))
}

describe('GeodataDashboard', () => {
  // Este test existe porque el default de statsHidden pasó de false a true dentro del
  // merge de la línea de tiempo NDVI sin quedar declarado en ningún lado, y dejó tres
  // tests en rojo. Si el default vuelve a cambiar, que lo diga la suite.
  it('arranca con las estadísticas ocultas y las despliega con el toggle', () => {
    const sel: VisorSelection = { level: 'ranch', org, ranch: { id: 'r1', name: 'Rancho Norte' } }
    render(<GeodataDashboard selection={sel} onSelect={vi.fn()} />)

    expect(screen.queryByText('Parcelas')).toBeNull()

    showStats()

    expect(screen.getByText('Parcelas')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Ocultar estadísticas' })).toBeTruthy()
  })

  it('nivel rancho: muestra Parcelas y Superficie + el mapa', () => {
    const sel: VisorSelection = { level: 'ranch', org, ranch: { id: 'r1', name: 'Rancho Norte' } }
    render(<GeodataDashboard selection={sel} onSelect={vi.fn()} />)
    showStats()
    // Aparece en el título y en la tarjeta flotante del mapa
    expect(screen.getAllByText('Rancho Norte').length).toBeGreaterThan(0)
    expect(screen.getByText('Parcelas')).toBeTruthy()
    expect(screen.getByText('Superficie')).toBeTruthy()
    expect(screen.getByText('2')).toBeTruthy() // 2 parcelas
    expect(screen.getByText(/5 ha/)).toBeTruthy() // 3 + 2
    expect(screen.getByTestId('mock-map')).toBeTruthy()
  })

  it('nivel parcela: muestra superficie y número de sesiones', () => {
    const sel: VisorSelection = {
      level: 'plot',
      org,
      ranch: { id: 'r1', name: 'Rancho Norte' },
      plot: { id: 'p1', name: 'P-01' },
    }
    render(<GeodataDashboard selection={sel} onSelect={vi.fn()} />)
    showStats()
    // "Sesiones de aspersión" es la tarjeta de stat. El panel de este nivel es
    // PlotSessionsPanel, que titula "Sesiones" y etiqueta la sección "Aspersión".
    expect(screen.getAllByText('Sesiones de aspersión').length).toBeGreaterThan(0)
    expect(screen.getAllByText('3').length).toBeGreaterThan(0) // 3 sesiones (stat y listado)
    expect(screen.getByText(/4.5 ha/)).toBeTruthy()
    expect(screen.getAllByText('Sesiones de mapeo de suelo').length).toBeGreaterThan(0)
    expect(screen.getAllByText('1').length).toBeGreaterThan(0)
    expect(screen.queryByTestId('soil-elevation-summary')).not.toBeInTheDocument()
  })

  it('nivel sesión: monta el visor de capas (AspersionMap) con el botón Parcela', () => {
    const sel: VisorSelection = {
      level: 'session',
      org,
      ranch: { id: 'r1', name: 'Rancho Norte' },
      plot: { id: 'p1', name: 'P-01' },
      session: { id: 's1', date: '2026-03-23', kind: 'aspersion' },
    }
    render(<GeodataDashboard selection={sel} onSelect={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Proporción volumen' })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Parcela/ })).toBeTruthy()
  })

  it('nivel sesión de suelo: monta SoilMap con su panel y etiqueta', () => {
    const sel: VisorSelection = {
      level: 'session',
      org,
      ranch: { id: 'r1', name: 'Rancho Norte' },
      plot: { id: 'p1', name: 'P-01' },
      session: { id: 'sm1', date: '2026-04-15', kind: 'soil_map' },
    }

    render(<GeodataDashboard selection={sel} onSelect={vi.fn()} />)
    showStats()

    expect(screen.getByText('Sesión de mapeo de suelo')).toBeTruthy()
    expect(screen.getByRole('combobox', { name: 'Variable del mapa' })).toBeTruthy()
    expect(screen.getAllByText('Sesiones de mapeo de suelo').length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: /Parcela/ })).toBeTruthy()
    expect(screen.queryByTestId('session-info-card')).toBeNull()
    expect(screen.getByTestId('soil-map-session-info-card')).toBeInTheDocument()
    expect(screen.queryByTestId('soil-elevation-summary')).not.toBeInTheDocument()
  })
})
