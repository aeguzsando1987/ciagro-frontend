import { screen, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import { useAuthStore } from '@/features/auth/useAuthStore'
import { renderInWorkspaceRoute } from '@/test/test-utils'
import { AppSidebar } from './AppSidebar'
import type { AuthUser } from '@/types/auth'

const BASE_USER: AuthUser = {
  id: 'u1',
  username: 'test',
  email: 'test@test.com',
  role_name: 'Guest',
  role_level: 1,
  requires_password_change: false,
  datacentrals: [],
}

describe('AppSidebar — module visibility by role_level', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null })
  })

  it('GUEST (level 1): shows only Dashboard', async () => {
    useAuthStore.setState({ user: { ...BASE_USER, role_level: 1 } })
    renderInWorkspaceRoute(AppSidebar)

    await waitFor(() => screen.getByText('Dashboard'))

    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.queryByText('Programas')).not.toBeInTheDocument()
    expect(screen.queryByText('Administracion')).not.toBeInTheDocument()
  })

  it('TECHNICIAN (level 2): shows Dashboard + Sesiones + Mapa (NO Programas, Supervisor+ only)', async () => {
    useAuthStore.setState({ user: { ...BASE_USER, role_level: 2 } })
    renderInWorkspaceRoute(AppSidebar)

    await waitFor(() => screen.getByText('Dashboard'))

    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.queryByText('Programas')).not.toBeInTheDocument()
    expect(screen.getByText('Sesiones')).toBeInTheDocument()
    expect(screen.getByText('Mapa')).toBeInTheDocument()
    expect(screen.queryByText('Central de datos')).not.toBeInTheDocument()
  })

  it('SUPERVISOR (level 3): shows Programas (level minimo del modulo)', async () => {
    useAuthStore.setState({ user: { ...BASE_USER, role_level: 3 } })
    renderInWorkspaceRoute(AppSidebar)

    await waitFor(() => screen.getByText('Dashboard'))

    expect(screen.getByText('Programas')).toBeInTheDocument()
    expect(screen.queryByText('Central de datos')).not.toBeInTheDocument()
  })

  it('MANAGER (level 4): shows all modules including admin ones', async () => {
    useAuthStore.setState({ user: { ...BASE_USER, role_level: 4 } })
    renderInWorkspaceRoute(AppSidebar)

    await waitFor(() => screen.getByText('Dashboard'))

    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Programas')).toBeInTheDocument()
    expect(screen.getByText('Central de datos')).toBeInTheDocument()
    expect(screen.getByText('Catalogos')).toBeInTheDocument()
    expect(screen.getByText('Administracion')).toBeInTheDocument()
  })
})
