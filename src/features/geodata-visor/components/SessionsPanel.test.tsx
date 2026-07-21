/**
 * Tests del SessionsPanel: lista de sesiones, filtro por rango de fechas (cliente) y
 * emisión de la selección al hacer clic.
 */
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const sessions = [
  { id: 's3', aspersion_date: '2026-03-23', points_count: 100, import_status: 'done' },
  { id: 's2', aspersion_date: '2026-02-10', points_count: 50, import_status: 'done' },
  { id: 's1', aspersion_date: '2026-01-05', points_count: 0, import_status: 'done' },
]

vi.mock('../hooks/useAspersionSessionHeaders', () => ({
  useAspersionSessionHeaders: () => ({ data: sessions, isLoading: false }),
}))

import { SessionsPanel } from './SessionsPanel'

describe('SessionsPanel', () => {
  beforeEach(() => vi.clearAllMocks())

  it('lista todas las sesiones por defecto (orden del backend)', () => {
    render(<SessionsPanel plotId="p1" selectedSessionId={null} onSelectSession={vi.fn()} />)
    expect(screen.getByText('2026-03-23')).toBeTruthy()
    expect(screen.getByText('2026-02-10')).toBeTruthy()
    expect(screen.getByText('2026-01-05')).toBeTruthy()
  })

  it('filtra por fecha "Desde"', () => {
    render(<SessionsPanel plotId="p1" selectedSessionId={null} onSelectSession={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-02-01' } })
    expect(screen.getByText('2026-03-23')).toBeTruthy()
    expect(screen.getByText('2026-02-10')).toBeTruthy()
    expect(screen.queryByText('2026-01-05')).toBeNull() // fuera del rango
  })

  it('emite la sesión seleccionada al hacer clic', () => {
    const onSelectSession = vi.fn()
    render(<SessionsPanel plotId="p1" selectedSessionId={null} onSelectSession={onSelectSession} />)
    fireEvent.click(screen.getByText('2026-02-10'))
    expect(onSelectSession).toHaveBeenCalledWith({ id: 's2', date: '2026-02-10', kind: 'aspersion' })
  })

  it('floating={false} usa variante de columna (sin posicionamiento absoluto)', () => {
    const { container } = render(
      <SessionsPanel plotId="p1" selectedSessionId={null} onSelectSession={vi.fn()} floating={false} />,
    )
    const root = container.firstElementChild as HTMLElement
    expect(root.className).toContain('relative')
    expect(root.className).not.toContain('absolute')
    // la lista sigue presente
    expect(screen.getByText('2026-03-23')).toBeTruthy()
  })
})
