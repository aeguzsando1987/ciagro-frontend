import { act, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '@/features/auth/useAuthStore'
import { ROLE_LEVELS } from '@/lib/auth/roles'
import { SessionReportToggle } from './SessionReportToggle'

vi.mock('@/features/task-manager/hooks/useAspersionSessionDetail', () => ({
  useAspersionSessionDetail: () => ({
    data: { import_status: 'done', points_count: '12' },
  }),
}))

vi.mock('@/features/task-manager/hooks/useSoilMapSessionDetail', () => ({
  useSoilMapSessionDetail: () => ({ data: null }),
}))

vi.mock('./SessionReportPanel', () => ({
  SessionReportPanel: () => null,
}))

function setRole(role_level: number | null) {
  act(() => {
    useAuthStore.setState({
      user: role_level == null ? null : {
        id: 'u1', username: 'user', email: 'u@test.com',
        role_name: 'test', role_level, requires_password_change: false, datacentrals: [],
      },
    })
  })
}

function renderToggle() {
  return render(<SessionReportToggle objectId="session-1" plotId="plot-1" />)
}

describe('SessionReportToggle', () => {
  afterEach(() => setRole(null))

  it('permite que Técnico vea el acceso a reportes de una sesión cargada', () => {
    setRole(ROLE_LEVELS.TECHNICIAN)
    renderToggle()
    expect(screen.getByRole('button', { name: /Reportes/i })).toBeTruthy()
  })

  it('oculta reportes para Invitado', () => {
    setRole(ROLE_LEVELS.GUEST)
    renderToggle()
    expect(screen.queryByRole('button', { name: /Reportes/i })).toBeNull()
  })
})