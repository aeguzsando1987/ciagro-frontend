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

describe('AppSidebar — navegación global por role_level', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null })
  })

  it('GUEST (level 1): muestra únicamente Dashboard', async () => {
    useAuthStore.setState({ user: { ...BASE_USER, role_level: 1 } })
    renderInWorkspaceRoute(AppSidebar)

    await waitFor(() => screen.getByText('Dashboard'))

    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.queryByText('Visor agrícola')).not.toBeInTheDocument()
    expect(screen.queryByText('Task Manager')).not.toBeInTheDocument()
    expect(screen.queryByText('Agrounidades')).not.toBeInTheDocument()
  })

  it('TECHNICIAN (level 2): no muestra herramientas de Supervisor', async () => {
    useAuthStore.setState({ user: { ...BASE_USER, role_level: 2 } })
    renderInWorkspaceRoute(AppSidebar)

    await waitFor(() => screen.getByText('Dashboard'))

    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.queryByText('Visor agrícola')).not.toBeInTheDocument()
    expect(screen.queryByText('Task Manager')).not.toBeInTheDocument()
    expect(screen.queryByText('Catálogos')).not.toBeInTheDocument()
  })

  it('SUPERVISOR (level 3): muestra visor, tareas y gestión permitida', async () => {
    useAuthStore.setState({ user: { ...BASE_USER, role_level: 3 } })
    renderInWorkspaceRoute(AppSidebar)

    await waitFor(() => screen.getByText('Dashboard'))

    expect(screen.getByText('Visor agrícola')).toBeInTheDocument()
    expect(screen.getByText('Task Manager')).toBeInTheDocument()
    expect(screen.getByText('Agrounidades')).toBeInTheDocument()
    expect(screen.getByText('Catálogos')).toBeInTheDocument()
    expect(screen.queryByText('Organizaciones')).not.toBeInTheDocument()
    expect(screen.queryByText('Usuarios')).not.toBeInTheDocument()
  })

  it('MANAGER (level 4): agrega organizaciones y variables sin accesos SuperAdmin', async () => {
    useAuthStore.setState({ user: { ...BASE_USER, role_level: 4 } })
    renderInWorkspaceRoute(AppSidebar)

    await waitFor(() => screen.getByText('Dashboard'))

    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Task Manager')).toBeInTheDocument()
    expect(screen.getByText('Organizaciones')).toBeInTheDocument()
    expect(screen.getByText('Variables')).toBeInTheDocument()
    expect(screen.queryByText('Usuarios')).not.toBeInTheDocument()
    expect(screen.queryByText('Activos agrícolas')).not.toBeInTheDocument()
  })

  it('SUPER_ADMIN (level 5): muestra todos los accesos de gestión', async () => {
    useAuthStore.setState({ user: { ...BASE_USER, role_level: 5 } })
    renderInWorkspaceRoute(AppSidebar)

    await waitFor(() => screen.getByText('Dashboard'))

    expect(screen.getByText('Usuarios')).toBeInTheDocument()
    expect(screen.getByText('Activos agrícolas')).toBeInTheDocument()
    expect(screen.getByText('Variables')).toBeInTheDocument()
  })
})
