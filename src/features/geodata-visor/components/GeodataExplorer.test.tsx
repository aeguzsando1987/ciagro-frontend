/**
 * Tests del GeodataExplorer: render del árbol, expansión perezosa de un nivel y
 * emisión de la selección con su ruta de ancestros. Los hooks de la jerarquía se
 * mockean para controlar los datos sin red.
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/features/admin/hooks/useDataCentrals', () => ({
  useDataCentralMains: () => ({
    data: [{ id: 'org-1', name: 'Organización Uno', datacentrals_count: '2' }],
    isLoading: false,
    error: null,
  }),
  useDataCentrals: () => ({
    data: [{ id: 'dc-1', name: 'CIAgro Hija A' }],
    isLoading: false,
    error: null,
  }),
}))
vi.mock('@/features/admin/hooks/useProducers', () => ({
  useProducers: () => ({
    data: [{ id: 'prod-1', commercial_name: 'Productor X', code: 'PX' }],
    isLoading: false,
  }),
}))
vi.mock('@/features/admin/hooks/useRanches', () => ({
  // `producer` es imprescindible: el explorador agrupa los ranchos por productor
  // para no pintar productores sin ninguno. La API real siempre lo devuelve.
  useRanches: () => ({
    data: [{ id: 'ranch-1', name: 'Rancho Norte', code: 'RN', producer: 'prod-1' }],
    isLoading: false,
  }),
}))
vi.mock('@/features/admin/hooks/usePlots', () => ({
  // Igual con `ranch`: agrupa las parcelas por rancho para podar los que no tienen.
  usePlots: () => ({
    data: [{ id: 'plot-1', code: 'P-01', ranch: 'ranch-1' }],
    isLoading: false,
  }),
}))
vi.mock('../hooks/useAspersionSessionHeaders', () => ({
  useAspersionSessionHeaders: () => ({
    data: [{ id: 'sess-1', aspersion_date: '2026-03-23', points_count: 42 }],
    isLoading: false,
  }),
}))
vi.mock('../hooks/usePhytoSessionHeaders', () => ({
  usePhytoSessionHeaders: () => ({ data: [], isLoading: false }),
}))
// NdviSessionList dejó de leer useNdviSessionHeaders y pasó a useNdviTimeline, que es
// un useQuery: sin este mock el árbol pide un QueryClient que estos tests no montan.
vi.mock('../hooks/useNdviTimeline', () => ({
  useNdviTimeline: () => ({ data: [], isLoading: false, isError: false, refetch: vi.fn() }),
}))
vi.mock('../hooks/useNdviSessionHeaders', () => ({
  useNdviSessionHeaders: () => ({ data: [], isLoading: false }),
}))
vi.mock('../hooks/useSoilMapSessionHeaders', () => ({
  useSoilMapSessionHeaders: () => ({
    data: [
      {
        id: 'soil-session-1',
        mapping_date: '2026-04-15',
        points_count: '8',
      },
    ],
    isLoading: false,
  }),
}))

vi.mock('@/features/task-manager/hooks/useHijoDetail', () => ({
  useHijoDetail: (id: string) => ({
    data: id === 'program-yield-1'
      ? {
          id,
          title: 'Subprograma Cosecha 2024',
          voucher_code: 'SC-2024',
          cycle: 'Otoño-Invierno-2024',
          est_start_date: '2024-10-01T00:00:00Z',
          est_finish_date: '2024-12-31T00:00:00Z',
        }
      : null,
    isLoading: false,
    isError: false,
  }),
}))

vi.mock('@/features/yield-map/hooks/useYieldMapHeaders', () => ({
  useYieldMapHeaders: () => ({
    data: [{ id: 'yield-session-1', program: 'program-yield-1', harvest_date: '2024-10-12', points_count: 1594 }],
    isLoading: false, isError: false, refetch: vi.fn(),
  }),
}))

import { GeodataExplorer } from './GeodataExplorer'

describe('GeodataExplorer', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renderiza las organizaciones raíz', () => {
    render(<GeodataExplorer selection={null} onSelect={vi.fn()} />)
    expect(screen.getByText('Organización Uno')).toBeTruthy()
    // Los hijos no se cargan hasta expandir
    expect(screen.queryByText('CIAgro Hija A')).toBeNull()
  })

  it('expande un nivel y carga sus hijos (lazy)', async () => {
    render(<GeodataExplorer selection={null} onSelect={vi.fn()} />)
    const expandButtons = screen.getAllByLabelText('Expandir')
    fireEvent.click(expandButtons[0]!)
    await waitFor(() => {
      expect(screen.getByText('CIAgro Hija A')).toBeTruthy()
    })
  })

  it('expande/contrae con doble clic sobre la fila', async () => {
    render(<GeodataExplorer selection={null} onSelect={vi.fn()} />)
    fireEvent.doubleClick(screen.getByText('Organización Uno'))
    await waitFor(() => {
      expect(screen.getByText('CIAgro Hija A')).toBeTruthy()
    })
  })

  it('emite la selección con su ruta al hacer clic en un nodo', () => {
    const onSelect = vi.fn()
    render(<GeodataExplorer selection={null} onSelect={onSelect} />)
    fireEvent.click(screen.getByText('Organización Uno'))
    expect(onSelect).toHaveBeenCalledWith({
      org: { id: 'org-1', name: 'Organización Uno' },
      level: 'org',
    })
  })

  it('al expandir hasta una CIAgro hija emite la selección de datacentral', async () => {
    const onSelect = vi.fn()
    render(<GeodataExplorer selection={null} onSelect={onSelect} />)
    fireEvent.click(screen.getAllByLabelText('Expandir')[0]!)
    await waitFor(() => screen.getByText('CIAgro Hija A'))
    fireEvent.click(screen.getByText('CIAgro Hija A'))
    expect(onSelect).toHaveBeenCalledWith({
      org: { id: 'org-1', name: 'Organización Uno' },
      datacentral: { id: 'dc-1', name: 'CIAgro Hija A' },
      level: 'datacentral',
    })
  })

  it('agrupa Rendimiento por subprograma antes de mostrar sus sesiones', async () => {
    render(<GeodataExplorer selection={null} onSelect={vi.fn()} />)

    fireEvent.doubleClick(screen.getByText('Organización Uno'))
    await waitFor(() => screen.getByText('CIAgro Hija A'))
    fireEvent.doubleClick(screen.getByText('CIAgro Hija A'))
    await waitFor(() => screen.getByText('Productor X'))
    fireEvent.doubleClick(screen.getByText('Productor X'))
    await waitFor(() => screen.getByText('Rancho Norte'))
    fireEvent.doubleClick(screen.getByText('Rancho Norte'))
    await waitFor(() => screen.getByText('P-01'))
    fireEvent.doubleClick(screen.getByText('P-01'))

    await waitFor(() => {
      expect(screen.getByText('Rendimiento')).toBeInTheDocument()
      expect(screen.getByText('Subprograma Cosecha 2024')).toBeInTheDocument()
    })

    expect(screen.queryByText('2024-10-12 · 1594 pts')).toBeNull()
    fireEvent.click(screen.getByText('Subprograma Cosecha 2024'))
    expect(screen.getByText('2024-10-12 · 1594 pts')).toBeInTheDocument()
  })

  it('agrupa las sesiones de suelo y conserva la ruta completa al seleccionarlas', async () => {
    const onSelect = vi.fn()
    render(<GeodataExplorer selection={null} onSelect={onSelect} />)

    fireEvent.doubleClick(screen.getByText('Organización Uno'))
    await waitFor(() => screen.getByText('CIAgro Hija A'))
    fireEvent.doubleClick(screen.getByText('CIAgro Hija A'))
    await waitFor(() => screen.getByText('Productor X'))
    fireEvent.doubleClick(screen.getByText('Productor X'))
    await waitFor(() => screen.getByText('Rancho Norte'))
    fireEvent.doubleClick(screen.getByText('Rancho Norte'))
    await waitFor(() => screen.getByText('P-01'))
    fireEvent.doubleClick(screen.getByText('P-01'))

    await waitFor(() => {
      expect(screen.getByText('Mapeo de suelo')).toBeInTheDocument()
      expect(screen.getByText('2026-04-15 · 8 pts')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('2026-04-15 · 8 pts'))
    expect(onSelect).toHaveBeenLastCalledWith({
      org: { id: 'org-1', name: 'Organización Uno' },
      datacentral: { id: 'dc-1', name: 'CIAgro Hija A' },
      producer: { id: 'prod-1', name: 'Productor X' },
      ranch: { id: 'ranch-1', name: 'Rancho Norte' },
      plot: { id: 'plot-1', name: 'P-01' },
      session: { id: 'soil-session-1', date: '2026-04-15', kind: 'soil_map' },
      level: 'session',
    })
  })
})
