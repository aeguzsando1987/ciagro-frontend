/**
 * Tests del SessionInfoCard: resuelve sesión → subprograma → maestro y arma los
 * enlaces (deep-link) con sus search params. Se mockean los hooks y el Link de
 * TanStack Router (que requiere RouterProvider) por un <a> que expone el search.
 */
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

vi.mock('@tanstack/react-router', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Link: ({ children, search }: any) => (
    <a data-search={JSON.stringify(search)}>{children}</a>
  ),
}))
vi.mock('@/features/task-manager/hooks/useAspersionSessionDetail', () => ({
  useAspersionSessionDetail: () => ({
    data: { id: 'sess-1', aspersion_date: '2026-03-23', status: 'completed', points_count: 120, program_id: 'hijo-1' },
  }),
}))
vi.mock('@/features/task-manager/hooks/useHijoDetail', () => ({
  useHijoDetail: () => ({ data: { id: 'hijo-1', title: 'Subprograma A', master_program: 'master-1' } }),
}))
vi.mock('@/features/task-manager/hooks/useMasterTree', () => ({
  useMasterTree: () => ({ data: { id: 'master-1', title: 'Programa Maestro X' } }),
}))

import { SessionInfoCard } from './SessionInfoCard'

describe('SessionInfoCard', () => {
  it('muestra info de la sesión y los nombres de subprograma y maestro', () => {
    render(<SessionInfoCard sessionId="sess-1" datacentralId="dc-1" />)
    expect(screen.getByText(/2026-03-23/)).toBeTruthy()
    expect(screen.getByText(/120 pts/)).toBeTruthy()
    expect(screen.getByText(/Subprograma A/)).toBeTruthy()
    expect(screen.getByText(/Programa Maestro X/)).toBeTruthy()
  })

  it('arma el deep-link de la sesión con los tres ids', () => {
    render(<SessionInfoCard sessionId="sess-1" datacentralId="dc-1" />)
    const sessionLink = screen.getByText(/Ver sesión/).closest('a')!
    const search = JSON.parse(sessionLink.getAttribute('data-search')!)
    expect(search).toMatchObject({ openSesion: 'sess-1', openHijo: 'hijo-1', openMaster: 'master-1', openSesionType: 'aspersion' })
  })

  it('sin datacentralId no resuelve enlaces (muestra aviso)', () => {
    render(<SessionInfoCard sessionId="sess-1" />)
    expect(screen.getByText(/Enlaces no disponibles/)).toBeTruthy()
  })
})
