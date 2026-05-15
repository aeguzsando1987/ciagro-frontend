import { render, screen } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { createTestQueryClient } from '@/test/test-utils'
import { QueryClientProvider } from '@tanstack/react-query'
import { useAuthStore } from '@/features/auth/useAuthStore'
import type { AuthUser } from '@/types/auth'

// useNavigate debe estar disponible antes de importar WorkspaceSelector
const mockNavigate = vi.fn()
vi.mock('@tanstack/react-router', async (importActual) => {
  const actual = await importActual<typeof import('@tanstack/react-router')>()
  return { ...actual, useNavigate: () => mockNavigate }
})

// useDataCentralsMain se llama dentro de DataCentralMainSelector (lazy, al renderizar).
// Lo mockeamos para evitar el fetch cuando role_level >= 4.
vi.mock('@/features/workspace/useDataCentralsMain', () => ({
  useDataCentralsMain: () => ({ data: [], isLoading: false }),
}))

import { WorkspaceSelector } from './WorkspaceSelector'

const BASE_USER: AuthUser = {
  id: 'u1',
  username: 'testuser',
  email: 'test@test.com',
  role_name: 'Tecnico',
  role_level: 2,
  requires_password_change: false,
  datacentrals: [],
}

function renderSelector() {
  const queryClient = createTestQueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <WorkspaceSelector />
    </QueryClientProvider>,
  )
}

describe('WorkspaceSelector', () => {
  beforeEach(() => {
    mockNavigate.mockClear()
    useAuthStore.setState({ user: null })
  })

  it('shows NoAccessScreen when user has no datacentrals', () => {
    useAuthStore.setState({ user: { ...BASE_USER, datacentrals: [] } })
    renderSelector()
    expect(screen.getByText(/sin acceso/i)).toBeInTheDocument()
  })

  it('calls navigate to /w/$dc/dashboard when user has exactly 1 datacentral', () => {
    useAuthStore.setState({
      user: {
        ...BASE_USER,
        datacentrals: [{ id: 'dc-uuid', name: 'DC Prueba', slug: 'dc-prueba', is_owner: true }],
      },
    })
    renderSelector()
    expect(mockNavigate).toHaveBeenCalledWith({
      to: '/w/$dc/dashboard',
      params: { dc: 'dc-uuid' },
    })
  })

  it('renders DataCentralMainSelector when role_level >= 4', () => {
    useAuthStore.setState({
      user: {
        ...BASE_USER,
        role_level: 4,
        datacentrals: [
          { id: 'dc-1', name: 'DC Alpha', slug: 'dc-alpha', is_owner: true },
          { id: 'dc-2', name: 'DC Beta', slug: 'dc-beta', is_owner: false },
        ],
      },
    })
    renderSelector()
    expect(screen.getByText(/selecciona una organizacion/i)).toBeInTheDocument()
  })

  it('renders DataCentralChildSelector when role_level < 4', () => {
    useAuthStore.setState({
      user: {
        ...BASE_USER,
        role_level: 2,
        datacentrals: [
          { id: 'dc-1', name: 'DC Alpha', slug: 'dc-alpha', is_owner: true },
          { id: 'dc-2', name: 'DC Beta', slug: 'dc-beta', is_owner: false },
        ],
      },
    })
    renderSelector()
    expect(screen.getByText('DC Alpha')).toBeInTheDocument()
    expect(screen.getByText('DC Beta')).toBeInTheDocument()
  })
})
