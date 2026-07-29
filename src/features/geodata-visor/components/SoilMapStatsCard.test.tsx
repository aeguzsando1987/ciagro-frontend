import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SoilMapStatsCard } from './SoilMapStatsCard'

const entries = [
  { key: 'high', label: 'Alto', color: '#FF0000' },
  { key: 'low', label: 'Bajo', color: '#0000FF' },
]

const bucketStats = {
  high: { count: 3, percentage: 75, areaHa: 15 },
  low: { count: 1, percentage: 25, areaHa: 5 },
}

describe('SoilMapStatsCard', () => {
  it('muestra el área total, porcentaje y hectáreas por filtro', () => {
    render(
      <SoilMapStatsCard
        layerLabel="Countrate"
        legendEntries={entries}
        bucketStats={bucketStats}
        totalAreaHa={20}
        checkedBuckets={new Set(['high', 'low'])}
        onToggle={vi.fn()}
      />
    )

    expect(screen.getByText(/Total: 20 ha/)).toBeInTheDocument()
    expect(screen.getByText(/75.0% · 15 ha/)).toBeInTheDocument()
    expect(screen.getByText(/25.0% · 5 ha/)).toBeInTheDocument()
  })

  it('comparte el toggle de filtros con el mapa', () => {
    const onToggle = vi.fn()
    render(
      <SoilMapStatsCard
        layerLabel="Countrate"
        legendEntries={entries}
        bucketStats={bucketStats}
        totalAreaHa={20}
        checkedBuckets={new Set(['high', 'low'])}
        onToggle={onToggle}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Ocultar Alto' }))
    expect(onToggle).toHaveBeenCalledWith('high')
    expect(screen.getByText(/% de superficie · Countrate/)).toBeInTheDocument()
  })
})
