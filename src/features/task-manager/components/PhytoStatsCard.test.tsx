/**
 * Tests de PhytoStatsCard: renderiza el resumen (totales, semáforo de presencia
 * y desglose por problema) cuando hay checkpoints, y no renderiza nada cuando la
 * sesión está vacía. El hook de datos se mockea.
 */
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import type { PhytoSessionStats } from '../hooks/usePhytoSessionStats'
import { PhytoStatsCard } from './PhytoStatsCard'

const mockStats = vi.fn()
vi.mock('../hooks/usePhytoSessionStats', () => ({
  usePhytoSessionStats: () => mockStats(),
}))

function withData(data: PhytoSessionStats | null, isLoading = false, error: unknown = null) {
  mockStats.mockReturnValue({ data, isLoading, error })
}

const SAMPLE: PhytoSessionStats = {
  checkpoints_count: 24,
  targets_count: 6,
  targets_visited: 2,
  presence: { low: 9, warning: 7, critical: 8 },
  captured_first: '2026-07-06T21:31:34Z',
  captured_last: '2026-07-06T22:40:34Z',
  by_issue: [
    { id: 6, name: 'mosca verde', type: 'Plaga', count: 14, qty_total: 47, critical: 4 },
    { id: 7, name: 'ruya', type: 'Enfermedad', count: 10, qty_total: 20, critical: 4 },
  ],
}

describe('PhytoStatsCard', () => {
  it('muestra totales, semáforo y desglose por problema', () => {
    withData(SAMPLE)
    render(<PhytoStatsCard headerId="h1" />)

    expect(screen.getByText(/24 puntos/)).toBeInTheDocument()
    expect(screen.getByText(/2\/6 objetivos visitados/)).toBeInTheDocument()
    // semáforo
    expect(screen.getByText('Crítica')).toBeInTheDocument()
    // desglose por problema
    expect(screen.getByText('mosca verde')).toBeInTheDocument()
    expect(screen.getByText('ruya')).toBeInTheDocument()
  })

  it('no renderiza nada cuando no hay checkpoints', () => {
    withData({ ...SAMPLE, checkpoints_count: 0 })
    const { container } = render(<PhytoStatsCard headerId="h1" />)
    expect(container).toBeEmptyDOMElement()
  })
})
