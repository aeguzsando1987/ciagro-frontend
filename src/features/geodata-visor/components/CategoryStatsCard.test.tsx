/**
 * Tests de CategoryStatsCard: % de área + ha por categoría y toggle de filtro.
 *
 * Importa helpers de AspersionMap (formatHa/areaShareByBucket), que a su vez importa
 * react-map-gl/maplibre (rompe JSDOM) → se mockea.
 */
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

vi.mock('react-map-gl/maplibre', () => ({
  default: () => null,
  Source: () => null,
  Layer: () => null,
  Popup: () => null,
  Marker: () => null,
}))

import { CategoryStatsCard, type CategoryStatsEntry } from './CategoryStatsCard'

const defs: CategoryStatsEntry[] = [
  { key: 'deficiente', label: 'Deficiente', color: '#dc2626', range: '< 80%' },
  { key: 'excelente', label: 'Excelente', color: '#16a34a', range: '95–105%' },
]

const areaByBucket = { deficiente: 1, excelente: 3, sin_meta: 96 }

describe('CategoryStatsCard', () => {
  it('muestra el % de área (base = categorías) y el área en ha por categoría', () => {
    render(
      <CategoryStatsCard
        legendDefs={defs}
        areaByBucket={areaByBucket}
        checkedBuckets={new Set(['deficiente', 'excelente'])}
        onToggle={vi.fn()}
      />,
    )
    // base = 1 + 3 = 4 (sin_meta excluido) → Excelente 75%, Deficiente 25%
    expect(screen.getByText(/75\.0% · 3/)).toBeTruthy()
    expect(screen.getByText(/25\.0% · 1/)).toBeTruthy()
  })

  it('no renderiza categorías ausentes de legendDefs (p. ej. sin_meta)', () => {
    render(
      <CategoryStatsCard
        legendDefs={defs}
        areaByBucket={areaByBucket}
        checkedBuckets={new Set(['deficiente', 'excelente'])}
        onToggle={vi.fn()}
      />,
    )
    expect(screen.queryByText(/sin.?meta/i)).toBeNull()
  })

  it('clic en una fila llama onToggle con su key', () => {
    const onToggle = vi.fn()
    render(
      <CategoryStatsCard
        legendDefs={defs}
        areaByBucket={areaByBucket}
        checkedBuckets={new Set(['deficiente', 'excelente'])}
        onToggle={onToggle}
      />,
    )
    fireEvent.click(screen.getByText('Excelente'))
    expect(onToggle).toHaveBeenCalledWith('excelente')
  })

  it('tacha la categoría no marcada', () => {
    render(
      <CategoryStatsCard
        legendDefs={defs}
        areaByBucket={areaByBucket}
        checkedBuckets={new Set(['excelente'])}
        onToggle={vi.fn()}
      />,
    )
    const label = screen.getByText('Deficiente')
    expect(label.className).toContain('line-through')
  })
})
