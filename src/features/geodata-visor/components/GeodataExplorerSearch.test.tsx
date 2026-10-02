/**
 * Tests del modo resultados del explorador (fase AS).
 *
 * Van en un archivo aparte de `GeodataExplorer.test.tsx` porque ese mockea los hooks
 * de la jerarquía perezosa, y aquí lo que importa es justo lo contrario: que con una
 * búsqueda activa el explorador NO consulte nada y pinte el árbol que recibe.
 */
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

// El modo perezoso no debe dispararse: si algún hook se llamara, estos mocks lo
// delatarían al fallar la aserción de "no se consultó nada".
const useDataCentralMains = vi.fn(() => ({ data: [], isLoading: false, error: null }))
vi.mock('@/features/admin/hooks/useDataCentrals', () => ({
  useDataCentralMains: () => useDataCentralMains(),
  useDataCentrals: () => ({ data: [], isLoading: false, error: null }),
}))
vi.mock('@/features/admin/hooks/useProducers', () => ({
  useProducers: vi.fn(() => ({ data: [], isLoading: false })),
}))
vi.mock('@/features/admin/hooks/useRanches', () => ({
  useRanches: vi.fn(() => ({ data: [], isLoading: false })),
}))
vi.mock('@/features/admin/hooks/usePlots', () => ({
  usePlots: vi.fn(() => ({ data: [], isLoading: false })),
}))
vi.mock('../hooks/useAspersionSessionHeaders', () => ({
  useAspersionSessionHeaders: vi.fn(() => ({ data: [], isLoading: false })),
}))
vi.mock('../hooks/usePhytoSessionHeaders', () => ({
  usePhytoSessionHeaders: vi.fn(() => ({ data: [], isLoading: false })),
}))
// SearchNdviCycleResults usa useNdviTimeline (un useQuery) para agrupar por subciclo.
// Sin este mock el árbol pide un QueryClient que estos tests no montan. Con data vacía
// el componente cae en su fallback deliberado y pinta las coincidencias tal como llegaron,
// que es lo que estos tests aseveran.
vi.mock('../hooks/useNdviTimeline', () => ({
  useNdviTimeline: vi.fn(() => ({ data: [], isLoading: false, isError: false, refetch: vi.fn() })),
}))
vi.mock('../hooks/useNdviSessionHeaders', () => ({
  useNdviSessionHeaders: vi.fn(() => ({ data: [], isLoading: false })),
}))
vi.mock('../hooks/useSoilMapSessionHeaders', () => ({
  useSoilMapSessionHeaders: vi.fn(() => ({ data: [], isLoading: false })),
}))

import { GeodataExplorer } from './GeodataExplorer'
import type { AdvancedSearchResult } from '../types'

const result: AdvancedSearchResult = {
  count: 2,
  total: 2,
  truncated: false,
  plot_ids: ['plot-1'],
  producers: [
    {
      id: 'prod-1',
      name: 'Dr. Crampie',
      organization: { id: 'org-1', name: 'Organización Uno' },
      ranches: [
        {
          id: 'ranch-1',
          name: 'La tijera',
          plots: [
            {
              id: 'plot-1',
              code: 'P-001',
              sessions: [
                { id: 's-asp', kind: 'aspersion', date: '2025-03-10', points_count: 5, program_cycle: null },
                { id: 's-ndvi', kind: 'ndvi', date: '2024-11-05', points_count: 1024, program_cycle: null },
              ],
            },
          ],
        },
      ],
    },
  ],
}

describe('GeodataExplorer en modo resultados', () => {
  it('pinta la jerarquía completa ya expandida, sin pedir nada', () => {
    render(
      <GeodataExplorer selection={null} onSelect={vi.fn()} searchActive searchResult={result} />
    )

    expect(screen.getByText('Dr. Crampie')).toBeInTheDocument()
    expect(screen.getByText('La tijera')).toBeInTheDocument()
    expect(screen.getByText('P-001')).toBeInTheDocument()
    // Las sesiones se ven sin tener que expandir nada.
    expect(screen.getByText('2025-03-10 · 5 pts')).toBeInTheDocument()
    expect(screen.getByText('2024-11-05 · 1024 pts')).toBeInTheDocument()
  })

  it('emite la selección con la organización del productor', () => {
    // Es el punto crítico: sin `org` el mapa NDVI no sabría de quién es la paleta.
    const onSelect = vi.fn()
    render(
      <GeodataExplorer selection={null} onSelect={onSelect} searchActive searchResult={result} />
    )

    fireEvent.click(screen.getByText('2024-11-05 · 1024 pts'))

    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        level: 'session',
        org: { id: 'org-1', name: 'Organización Uno' },
        producer: { id: 'prod-1', name: 'Dr. Crampie' },
        ranch: { id: 'ranch-1', name: 'La tijera' },
        plot: { id: 'plot-1', name: 'P-001' },
        session: { id: 's-ndvi', kind: 'ndvi', date: '2024-11-05' },
      })
    )
  })

  // FASE CV (D5): misma estructura que el arbol normal, ya expandida.
  it('agrupa las coincidencias en Generales y ciclos productivos', () => {
    const conCiclos: AdvancedSearchResult = {
      ...result,
      producers: [{
        ...result.producers[0]!,
        ranches: [{
          ...result.producers[0]!.ranches[0]!,
          plots: [{
            id: 'plot-1',
            code: 'P-001',
            sessions: [
              { id: 's-asp', kind: 'aspersion', date: '2025-03-10', points_count: 5, program_cycle: 'Primavera-Verano-2025' },
              { id: 's-soil', kind: 'soil_map', date: '2025-01-20', points_count: 8, program_cycle: 'Primavera-Verano-2025' },
              { id: 's-ndvi', kind: 'ndvi', date: '2024-11-05', points_count: 1024, program_cycle: null },
            ],
          }],
        }],
      }],
    }
    render(<GeodataExplorer selection={null} onSelect={vi.fn()} searchActive searchResult={conCiclos} />)

    expect(screen.getByText('Generales')).toBeInTheDocument()
    expect(screen.getByText('Mapeos (2025)')).toBeInTheDocument()
    expect(screen.getByText('Ciclo productivo Primavera-Verano 2025')).toBeInTheDocument()
    expect(screen.getByText('Aplicaciones')).toBeInTheDocument()
    expect(screen.getByText('2025-03-10 · 5 pts')).toBeInTheDocument()
    expect(screen.getByText('Sin ciclo')).toBeInTheDocument()
    expect(screen.getByText('2024-11-05 · 1024 pts')).toBeInTheDocument()
    // El año solo agrupa en Generales.
    expect(screen.queryByText(/^Apl\. líquidas/)).toBeNull()
    expect(screen.queryByText('Fitosanitario')).toBeNull()
  })

  it('avisa cuando el resultado viene recortado', () => {
    render(
      <GeodataExplorer
        selection={null}
        onSelect={vi.fn()}
        searchActive
        searchResult={{ ...result, truncated: true, count: 500, total: 812 }}
      />
    )
    expect(screen.getByText(/500 sesiones más recientes de 812/)).toBeInTheDocument()
  })

  it('informa cuando no hay coincidencias', () => {
    render(
      <GeodataExplorer
        selection={null}
        onSelect={vi.fn()}
        searchActive
        searchResult={{ count: 0, total: 0, truncated: false, plot_ids: [], producers: [] }}
      />
    )
    expect(screen.getByText('Ninguna sesión coincide con la búsqueda.')).toBeInTheDocument()
  })

  it('no permite navegar un productor sin organización', () => {
    const onSelect = vi.fn()
    const orphan: AdvancedSearchResult = {
      ...result,
      producers: [{ ...result.producers[0]!, organization: null }],
    }
    render(<GeodataExplorer selection={null} onSelect={onSelect} searchActive searchResult={orphan} />)

    fireEvent.click(screen.getByText('Dr. Crampie'))

    expect(onSelect).not.toHaveBeenCalled()
    expect(screen.getByText(/Sin organización asociada/)).toBeInTheDocument()
  })
})
