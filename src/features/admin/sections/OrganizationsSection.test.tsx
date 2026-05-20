import { screen, waitFor, render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useDataCentralMains } from '../hooks/useDataCentrals'
import { QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw-server'
import { OrganizationsSection } from './OrganizationsSection'
import { createTestQueryClient } from '@/test/test-utils'

const BASE = 'http://localhost:8500'
const EMPTY_PAGE = { count: 0, results: [] }

vi.mock('@/features/auth/useAuthStore', () => ({
  useAuthStore: vi.fn((selector: (s: { user: { role_level: number } | null }) => unknown) =>
    selector({ user: { role_level: 5 } })
  ),
}))

vi.mock('../hooks/useDataCentrals', () => ({
  useDataCentralMains: vi.fn(() => ({ data: [], isLoading: false, error: null })),
  useCreateDataCentralMain: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  useDataCentrals: vi.fn(() => ({ data: [], isLoading: false, error: null })),
  useUpdateDataCentralMain: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  useCreateDataCentral: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
}))

vi.mock('../hooks/useGeography', () => ({
  useCountries: vi.fn(() => ({ data: [] })),
  useStates: vi.fn(() => ({ data: [] })),
}))

vi.mock('../hooks/useUsers', () => ({
  useUsers: vi.fn(() => ({ data: [] })),
}))

beforeEach(() => {
  server.use(
    http.get(`${BASE}/api/v1/geography/countries/`, () => HttpResponse.json(EMPTY_PAGE)),
    http.get(`${BASE}/api/v1/users/`, () => HttpResponse.json(EMPTY_PAGE)),
  )
})

function renderSection() {
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <OrganizationsSection />
    </QueryClientProvider>
  )
}

const SAMPLE_ORG = {
  id: 'org-uuid-1',
  name: 'Organización Demo',
  slug: 'organizacion-demo',
  description: 'Descripción demo',
  country: null,
  status: 'active' as const,
  owner: 'owner-uuid-1',
  is_owner: 'false',
  owner_username: 'gerente01',
  datacentrals_count: '2',
  created_at: '2025-01-01T00:00:00Z',
}

describe('OrganizationsSection', () => {
  it('renders Organizaciones header', () => {
    renderSection()
    expect(screen.getByRole('heading', { name: /Organizaciones/i })).toBeInTheDocument()
  })

  it('superadmin (level 5) sees + Nueva Organización button', () => {
    renderSection()
    expect(screen.getByRole('button', { name: /Nueva Organización/i })).toBeInTheDocument()
  })

  it('shows empty state when no orgs', () => {
    renderSection()
    expect(screen.getByText(/No hay organizaciones registradas/i)).toBeInTheDocument()
  })

  it('renders org table when data present', () => {
    vi.mocked(useDataCentralMains).mockReturnValueOnce({
      data: [SAMPLE_ORG],
      isLoading: false,
      error: null,
    } as never)
    renderSection()
    expect(screen.getByText('Organización Demo')).toBeInTheDocument()
    expect(screen.getByText('gerente01')).toBeInTheDocument()
    expect(screen.getByText('Activo')).toBeInTheDocument()
  })

  it('click on row opens DataCentralMainPanel', async () => {
    vi.mocked(useDataCentralMains).mockReturnValueOnce({
      data: [SAMPLE_ORG],
      isLoading: false,
      error: null,
    } as never)
    const user = userEvent.setup()
    renderSection()
    await user.click(screen.getByText('Organización Demo'))
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })
  })

  it('opens CreateDataCentralMainDialog on button click', async () => {
    const user = userEvent.setup()
    renderSection()
    await user.click(screen.getByRole('button', { name: /Nueva Organización/i }))
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getByText('Nueva organización')).toBeInTheDocument()
    })
  })
})
