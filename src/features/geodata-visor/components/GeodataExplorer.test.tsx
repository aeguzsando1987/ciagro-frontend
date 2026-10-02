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
// FASE CV: cada sesion trae la temporada de su subprograma (program_cycle).
// Aspersion y NDVI vienen de subprogramas distintos con la MISMA temporada: deben caer
// en un solo ciclo. Rendimiento cuelga de un subprograma sin temporada.
vi.mock('../hooks/useAspersionSessionHeaders', () => ({
  useAspersionSessionHeaders: () => ({
    data: [{ id: 'sess-1', aspersion_date: '2026-03-23', points_count: 42, program_cycle: 'Primavera-Verano-2026' }],
    isLoading: false,
  }),
}))
vi.mock('../hooks/usePhytoSessionHeaders', () => ({
  usePhytoSessionHeaders: () => ({ data: [], isLoading: false }),
}))
vi.mock('../hooks/useNdviSessionHeaders', () => ({
  useNdviSessionHeaders: () => ({
    data: [
      { id: 'ndvi-1', session_date: '2026-05-10', points_count: 1024, program_cycle: 'Primavera-Verano-2026' },
      { id: 'ndvi-2', session_date: '2025-11-02', points_count: 900, program_cycle: 'Verano-Invierno-2025' },
    ],
    isLoading: false,
  }),
}))
vi.mock('../hooks/useSoilMapSessionHeaders', () => ({
  useSoilMapSessionHeaders: () => ({
    data: [
      {
        id: 'soil-session-1',
        mapping_date: '2026-04-15',
        points_count: '8',
        program_cycle: 'Verano-Invierno-2017',
      },
    ],
    isLoading: false,
  }),
}))
vi.mock('@/features/yield-map/hooks/useYieldMapHeaders', () => ({
  useYieldMapHeaders: () => ({
    data: [{ id: 'yield-session-1', program: 'program-yield-1', harvest_date: '2024-10-12', points_count: 1594, program_cycle: null }],
    isLoading: false, isError: false, refetch: vi.fn(),
  }),
}))
vi.mock('@/features/planting-map/hooks/usePlantingMapHeaders', () => ({
  usePlantingMapHeaders: () => ({ data: [], isLoading: false, isError: false, refetch: vi.fn() }),
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

  async function abrirParcela() {
    fireEvent.doubleClick(screen.getByText('Organización Uno'))
    await waitFor(() => screen.getByText('CIAgro Hija A'))
    fireEvent.doubleClick(screen.getByText('CIAgro Hija A'))
    await waitFor(() => screen.getByText('Productor X'))
    fireEvent.doubleClick(screen.getByText('Productor X'))
    await waitFor(() => screen.getByText('Rancho Norte'))
    fireEvent.doubleClick(screen.getByText('Rancho Norte'))
    await waitFor(() => screen.getByText('P-01'))
    fireEvent.doubleClick(screen.getByText('P-01'))
    await waitFor(() => screen.getByText('Generales'))
  }

  const GRUPOS_RAIZ = new Set([
    'Generales',
    'Ciclo productivo Primavera-Verano 2026',
    'Ciclo productivo Verano-Invierno 2025',
    'Sin ciclo',
  ])

  it('arma Generales y los ciclos productivos por sesion mas reciente, con Sin ciclo al final', async () => {
    render(<GeodataExplorer selection={null} onSelect={vi.fn()} />)
    await abrirParcela()

    const orden = screen
      .getAllByRole('treeitem')
      .map((item) => item.textContent ?? '')
      .filter((text) => GRUPOS_RAIZ.has(text))
    expect(orden).toEqual([...GRUPOS_RAIZ])
    // Aspersion y NDVI de subprogramas distintos con la misma temporada: un solo nodo.
    expect(screen.getAllByText('Ciclo productivo Primavera-Verano 2026')).toHaveLength(1)
    // Todo colapsado: aun no se ve ningun tipo.
    expect(screen.queryByText('Aplicaciones')).toBeNull()
  })

  it('poda los tipos sin sesiones dentro del ciclo', async () => {
    render(<GeodataExplorer selection={null} onSelect={vi.fn()} />)
    await abrirParcela()
    fireEvent.click(screen.getByText('Ciclo productivo Primavera-Verano 2026'))

    expect(screen.getByText('Seguimiento a campo')).toBeInTheDocument()
    expect(screen.getByText('Aplicaciones')).toBeInTheDocument()
    for (const vacio of ['Fitosanitario', 'Siembra', 'Rendimiento']) {
      expect(screen.queryByText(vacio)).toBeNull()
    }
  })

  it('el mapeo va a Generales por año y conserva la ruta completa al seleccionarlo', async () => {
    const onSelect = vi.fn()
    render(<GeodataExplorer selection={null} onSelect={onSelect} />)
    await abrirParcela()

    // Su subprograma tiene temporada, pero un mapeo nunca entra a un ciclo.
    expect(screen.queryByText('Ciclo productivo Verano-Invierno 2017')).toBeNull()
    fireEvent.click(screen.getByText('Generales'))
    fireEvent.click(screen.getByText('Mapeos (2026)'))
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

  it('abre sola la rama de la sesion seleccionada', async () => {
    const selection = {
      org: { id: 'org-1', name: 'Organización Uno' },
      plot: { id: 'plot-1', name: 'P-01' },
      session: { id: 'yield-session-1', date: '2024-10-12', kind: 'yield_map' as const },
      level: 'session' as const,
    }
    render(<GeodataExplorer selection={selection} onSelect={vi.fn()} />)
    await abrirParcela()

    // Sin ciclo > Rendimiento > sesion, sin un solo clic. Dentro del ciclo no hay nivel de año.
    expect(screen.getByText('Rendimiento')).toBeInTheDocument()
    expect(screen.getByText('2024-10-12 · 1594 pts')).toBeInTheDocument()
    expect(screen.queryByText('Rendimiento (2024)')).toBeNull()
    // Las ramas que no la contienen siguen cerradas.
    expect(screen.queryByText('Aplicaciones')).toBeNull()
  })
})
