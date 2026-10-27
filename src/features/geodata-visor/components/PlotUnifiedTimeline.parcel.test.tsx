import { fireEvent, render, screen, within } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import { createTestQueryClient } from '@/test/test-utils'

const fixtures = vi.hoisted(() => ({
  sessions: [
    { id: 'soil', kind: 'soil_map', date: '2024-04-01', points_count: 1, cycle: null },
    { id: 'ndvi', kind: 'ndvi', date: '2025-05-01', points_count: 1, cycle: 'Primavera-Verano-2025' },
    { id: 'planting', kind: 'planting_map', date: '2026-06-01', points_count: 1, cycle: 'Primavera-Verano-2026' },
    { id: 'planting', kind: 'planting_map', date: '2026-06-01', points_count: 1, cycle: 'Primavera-Verano-2026' },
  ],
  ndvi: [{ id: 'ndvi', session_date: '2025-05-01', has_ndvi: true, mean: 0.5 }],
}))

vi.mock('../hooks/usePlotSessionTree', () => ({
  usePlotSessionTree: () => ({ sessions: fixtures.sessions, total: 4, missing: 0, isLoading: false }),
}))
vi.mock('../hooks/useNdviTimeline', () => ({
  useNdviTimeline: () => ({ data: fixtures.ndvi, isLoading: false }),
}))

import { PlotUnifiedTimeline } from './PlotUnifiedTimeline'

function renderTimeline(onSelectSession = vi.fn()) {
  const client = createTestQueryClient()
  render(<QueryClientProvider client={client}>
    <PlotUnifiedTimeline plotId="plot" mode="parcel" onSelectSession={onSelectSession} />
  </QueryClientProvider>)
  return onSelectSession
}

describe('línea histórica de parcela', () => {
  it('muestra todos los años sin duplicados y permite filtrar y restaurar los ciclos', () => {
    const onSelect = renderTimeline()
    const selector = screen.getByRole('combobox', { name: 'Ciclo productivo' })
    expect(selector).toHaveValue('all')
    const timeline = within(screen.getByLabelText('Resumen agrícola apilado por parcela'))
    expect(timeline.getByText('Mapeo de suelo (1)')).toBeInTheDocument()
    expect(timeline.getByText('NDVI (1)')).toBeInTheDocument()
    expect(timeline.getByText('Siembra (1)')).toBeInTheDocument()
    expect(timeline.getAllByRole('button')).toHaveLength(3)
    fireEvent.click(timeline.getByRole('button', { name: /NDVI,.*2025/ }))
    expect(onSelect).toHaveBeenCalledWith({ id: 'ndvi', date: '2025-05-01', kind: 'ndvi' })

    fireEvent.change(selector, { target: { value: 'Primavera-Verano-2025' } })
    expect(timeline.getByText('NDVI (1)')).toBeInTheDocument()
    expect(timeline.queryByText('Mapeo de suelo (1)')).not.toBeInTheDocument()
    expect(timeline.queryByText('Siembra (1)')).not.toBeInTheDocument()

    fireEvent.change(selector, { target: { value: 'all' } })
    expect(timeline.getAllByRole('button')).toHaveLength(3)
  })

  it('inicia Play en la primera sesión cronológica y permite pausar', () => {
    const onSelect = renderTimeline()
    fireEvent.click(screen.getByRole('button', { name: 'Play' }))
    expect(onSelect).toHaveBeenCalledWith({ id: 'soil', date: '2024-04-01', kind: 'soil_map' })
    fireEvent.click(screen.getByRole('button', { name: 'Pausa' }))
    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument()
  })
})
