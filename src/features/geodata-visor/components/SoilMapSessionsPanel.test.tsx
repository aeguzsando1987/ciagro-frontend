import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const sessions = [
  { id: 'sm3', mapping_date: '2026-03-23', points_count: '24', status: 'completed' },
  { id: 'sm2', mapping_date: '2026-02-10', points_count: '12', status: 'loaded' },
  { id: 'sm1', mapping_date: '2026-01-05', points_count: '0', status: 'pending' },
]

vi.mock('../hooks/useSoilMapSessionHeaders', () => ({
  useSoilMapSessionHeaders: () => ({ data: sessions, isLoading: false }),
}))

import { SoilMapSessionsPanel } from './SoilMapSessionsPanel'

describe('SoilMapSessionsPanel', () => {
  beforeEach(() => vi.clearAllMocks())

  it('lista las sesiones usando mapping_date', () => {
    render(
      <SoilMapSessionsPanel plotId="plot-1" selectedSessionId={null} onSelectSession={vi.fn()} />
    )

    expect(screen.getByText('2026-03-23')).toBeInTheDocument()
    expect(screen.getByText('2026-02-10')).toBeInTheDocument()
    expect(screen.getByText('2026-01-05')).toBeInTheDocument()
    expect(screen.getByText('24 pts')).toBeInTheDocument()
  })

  it('filtra las sesiones por el rango de fechas en cliente', () => {
    render(
      <SoilMapSessionsPanel plotId="plot-1" selectedSessionId={null} onSelectSession={vi.fn()} />
    )

    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-02-01' } })
    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2026-02-28' } })

    expect(screen.queryByText('2026-03-23')).not.toBeInTheDocument()
    expect(screen.getByText('2026-02-10')).toBeInTheDocument()
    expect(screen.queryByText('2026-01-05')).not.toBeInTheDocument()
  })

  it('emite la sesión seleccionada con kind soil_map', () => {
    const onSelectSession = vi.fn()
    render(
      <SoilMapSessionsPanel
        plotId="plot-1"
        selectedSessionId={null}
        onSelectSession={onSelectSession}
      />
    )

    fireEvent.click(screen.getByText('2026-02-10'))

    expect(onSelectSession).toHaveBeenCalledWith({
      id: 'sm2',
      date: '2026-02-10',
      kind: 'soil_map',
    })
  })

  it('admite la variante de columna y puede minimizarse', () => {
    const { container } = render(
      <SoilMapSessionsPanel
        plotId="plot-1"
        selectedSessionId="sm3"
        onSelectSession={vi.fn()}
        floating={false}
      />
    )
    const root = container.firstElementChild as HTMLElement

    expect(root).toHaveClass('relative')
    expect(root).not.toHaveClass('absolute')
    fireEvent.click(screen.getByRole('button', { name: 'Minimizar' }))
    expect(screen.queryByText('2026-03-23')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Expandir' })).toBeInTheDocument()
  })
})
