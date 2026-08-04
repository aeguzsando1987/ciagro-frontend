import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { NdviImportSummary } from './NdviImportSummary'
import { createTestQueryClient } from '@/test/test-utils'

const mocks = vi.hoisted(() => ({ stats: vi.fn() }))

vi.mock('../hooks/useNdviVariableStats', () => ({
  useNdviVariableStats: () => mocks.stats(),
}))

function renderSummary() {
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <NdviImportSummary headerId="ndvi-1" />
    </QueryClientProvider>,
  )
}

describe('NdviImportSummary', () => {
  it('lista cada índice con sus métricas', () => {
    mocks.stats.mockReturnValue({
      isLoading: false,
      error: null,
      data: {
        header_id: 'ndvi-1',
        points_count: 1024,
        variables: [
          { key: 'ndvi', label: 'NDVI', count: 1024, mean: 0.7239, min: 0.364, max: 0.826, stddev: 0.0974 },
          { key: 'gndvi', label: 'GNDVI', count: 1024, mean: 0.6858, min: 0.391, max: 0.77, stddev: 0.0707 },
        ],
      },
    })

    renderSummary()

    expect(screen.getByText('NDVI')).toBeInTheDocument()
    expect(screen.getByText('GNDVI')).toBeInTheDocument()
    // Tres decimales: con dos, indices de rango estrecho saldrian iguales.
    expect(screen.getByText('0.724')).toBeInTheDocument()
    expect(screen.getByText('0.364')).toBeInTheDocument()
    expect(screen.getByText(/1,024 puntos/)).toBeInTheDocument()
  })

  it('muestra un guion en los índices sin datos en vez de omitir la fila', () => {
    mocks.stats.mockReturnValue({
      isLoading: false,
      error: null,
      data: {
        header_id: 'ndvi-1',
        points_count: 10,
        variables: [
          { key: 'psri', label: 'PSRI', count: 0, mean: null, min: null, max: null, stddev: null },
        ],
      },
    })

    renderSummary()

    expect(screen.getByText('PSRI')).toBeInTheDocument()
    expect(screen.getAllByText('—')).toHaveLength(4)
  })

  it('avisa cuando el resumen no se pudo cargar', () => {
    mocks.stats.mockReturnValue({ isLoading: false, error: new Error('boom'), data: undefined })
    renderSummary()
    expect(screen.getByText(/No se pudo cargar el resumen/i)).toBeInTheDocument()
  })
})
