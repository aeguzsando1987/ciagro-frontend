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

// useDataCentralsMain se llama dentro de ManagerEntry/SuperAdminEntry y de
// DataCentralMainSelector. Mock controlable por test (variables prefijadas con mock
// para satisfacer las reglas de hoisting de Vitest).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mockMainsData: any[] = []
let mockMainsLoading = false
vi.mock('@/features/workspace/useDataCentralsMain', () => ({
  useDataCentralsMain: () => ({ data: mockMainsData, isLoading: mockMainsLoading }),
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
    mockMainsData = []
    mockMainsLoading = false
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

  it('renders DataCentralMainSelector when role_level >= 4 and has orgs', () => {
    // Manager con orgs visibles → siempre muestra selector jerárquico (incluso si
    // alguna org no tiene CIAs hijas todavía).
    mockMainsData = [{ id: 'org-1', name: 'Org Uno', is_owner: true, datacentrals_count: '0' }]
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

  it('Manager dueño de una org sin CIAs hijas igual ve el selector de organizaciones', () => {
    // El bug reportado: Manager + 0 datacentrals (porque su única org no tiene CIAs)
    // antes caía en NoAccessScreen. Ahora debe ver la org en el selector.
    mockMainsData = [{ id: 'org-1', name: 'Mi Org', is_owner: true, datacentrals_count: '0' }]
    useAuthStore.setState({
      user: { ...BASE_USER, role_level: 4, datacentrals: [] },
    })
    renderSelector()
    expect(screen.getByText(/selecciona una organizacion/i)).toBeInTheDocument()
    expect(screen.queryByText(/sin acceso/i)).not.toBeInTheDocument()
  })

  it('shows first-use wizard for SuperAdmin when there are no organizations', () => {
    // El mock de useDataCentralsMain devuelve [] → sistema sin organizaciones.
    useAuthStore.setState({
      user: { ...BASE_USER, role_level: 5, datacentrals: [] },
    })
    renderSelector()
    expect(screen.getByText(/bienvenido a ciagro/i)).toBeInTheDocument()
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
