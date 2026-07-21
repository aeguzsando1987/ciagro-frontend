/**
 * Tests del PhytoSessionsPanel: lista de sesiones fitosanitarias, filtro por rango de
 * fechas (cliente) y emisión de la selección (kind='phyto') al hacer clic.
 */
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const sessions = [
  { id: 'ph3', estimated_start_date: '2026-03-23', checkpoints_count: 24, status: 'completed' },
  { id: 'ph2', estimated_start_date: '2026-02-10', checkpoints_count: 12, status: 'loaded' },
  { id: 'ph1', estimated_start_date: '2026-01-05', checkpoints_count: 0, status: 'pending' },
]

vi.mock('../hooks/usePhytoSessionHeaders', () => ({
  usePhytoSessionHeaders: () => ({ data: sessions, isLoading: false }),
}))

import { PhytoSessionsPanel } from './PhytoSessionsPanel'

describe('PhytoSessionsPanel', () => {
  beforeEach(() => vi.clearAllMocks())

  it('lista todas las sesiones por defecto (orden del backend)', () => {
    render(<PhytoSessionsPanel plotId="p1" selectedSessionId={null} onSelectSession={vi.fn()} />)
    expect(screen.getByText('2026-03-23')).toBeTruthy()
    expect(screen.getByText('2026-02-10')).toBeTruthy()
    expect(screen.getByText('2026-01-05')).toBeTruthy()
  })

  it('filtra por fecha "Desde"', () => {
    render(<PhytoSessionsPanel plotId="p1" selectedSessionId={null} onSelectSession={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-02-01' } })
    expect(screen.getByText('2026-03-23')).toBeTruthy()
    expect(screen.getByText('2026-02-10')).toBeTruthy()
    expect(screen.queryByText('2026-01-05')).toBeNull() // fuera del rango
  })

  it('emite la sesión seleccionada con kind="phyto" al hacer clic', () => {
    const onSelectSession = vi.fn()
    render(<PhytoSessionsPanel plotId="p1" selectedSessionId={null} onSelectSession={onSelectSession} />)
    fireEvent.click(screen.getByText('2026-02-10'))
    expect(onSelectSession).toHaveBeenCalledWith({ id: 'ph2', date: '2026-02-10', kind: 'phyto' })
  })

  it('floating={false} usa variante de columna (sin posicionamiento absoluto)', () => {
    const { container } = render(
      <PhytoSessionsPanel plotId="p1" selectedSessionId={null} onSelectSession={vi.fn()} floating={false} />,
    )
    const root = container.firstElementChild as HTMLElement
    expect(root.className).toContain('relative')
    expect(root.className).not.toContain('absolute')
    expect(screen.getByText('2026-03-23')).toBeTruthy()
  })
})
