import { screen, waitFor, render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useAgroUnits } from '../hooks/useAgroUnits'
import { useAgroSectors } from '../hooks/useAgroSectors'
import { QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw-server'
import { AgroUnitsSection } from './AgroUnitsSection'
import { createTestQueryClient } from '@/test/test-utils'

const BASE = 'http://localhost:8500'
const EMPTY_PAGE = { count: 0, results: [] }

// --- Mocks de hooks ---

vi.mock('@/features/auth/useAuthStore', () => ({
  useAuthStore: vi.fn((selector: (s: { user: { role_level: number } | null }) => unknown) =>
    selector({ user: { role_level: 5 } })
  ),
}))

vi.mock('../hooks/useAgroUnits', () => ({
  useAgroUnits: vi.fn(() => ({ data: [], isLoading: false, error: null })),
  useCreateAgroUnit: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
}))

const deleteSectorMutate = vi.fn()
vi.mock('../hooks/useAgroSectors', () => ({
  useAgroSectors: vi.fn(() => ({ data: [], isLoading: false, error: null })),
  useCreateAgroSector: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  useUpdateAgroSector: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  useDeleteAgroSector: vi.fn(() => ({ mutateAsync: deleteSectorMutate, isPending: false })),
}))

// El dialog de crear unidad necesita countries
beforeEach(() => {
  // Estado base por test: sin sectores (los tests que los necesitan lo sobrescriben).
  vi.mocked(useAgroSectors).mockReturnValue({ data: [], isLoading: false, error: null } as never)
  deleteSectorMutate.mockClear()
  server.use(
    http.get(`${BASE}/api/v1/geography/countries/`, () => HttpResponse.json(EMPTY_PAGE)),
  )
})

function renderSection() {
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <AgroUnitsSection />
    </QueryClientProvider>
  )
}

describe('AgroUnitsSection', () => {
  it('renders tabs Unidades and Sectores', () => {
    renderSection()
    expect(screen.getByRole('tab', { name: /Unidades/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Sectores/i })).toBeInTheDocument()
  })

  it('supervisor (level 5) sees create button', () => {
    renderSection()
    expect(screen.getByRole('button', { name: /Nueva Unidad/i })).toBeInTheDocument()
  })

  it('shows empty state when no units', () => {
    renderSection()
    expect(screen.getByText(/No hay agrounidades registradas/i)).toBeInTheDocument()
  })

  it('opens CreateAgroUnitDialog on button click', async () => {
    const user = userEvent.setup()
    renderSection()
    await user.click(screen.getByRole('button', { name: /Nueva Unidad/i }))
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getByText('Nueva agrounidad')).toBeInTheDocument()
    })
  })

  const sampleSector = {
    id: 7, sector_name: 'Granos básicos', scian_code: '111140',
    activity_name: 'Cultivo de maíz', description: '',
  }

  it('supervisor sees Editar/Eliminar actions for each sector', async () => {
    const user = userEvent.setup()
    vi.mocked(useAgroSectors).mockReturnValue({ data: [sampleSector], isLoading: false, error: null } as never)
    renderSection()
    await user.click(screen.getByRole('tab', { name: /Sectores/i }))
    await waitFor(() => expect(screen.getByText('Granos básicos')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: /Editar/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Eliminar/i })).toBeInTheDocument()
  })

  it('confirms and calls delete on Eliminar click', async () => {
    const user = userEvent.setup()
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    vi.mocked(useAgroSectors).mockReturnValue({ data: [sampleSector], isLoading: false, error: null } as never)
    renderSection()
    await user.click(screen.getByRole('tab', { name: /Sectores/i }))
    await user.click(await screen.findByRole('button', { name: /Eliminar/i }))
    expect(confirmSpy).toHaveBeenCalled()
    expect(deleteSectorMutate).toHaveBeenCalledWith(7)
    confirmSpy.mockRestore()
  })

  it('renders units in table when data present', () => {
    vi.mocked(useAgroUnits).mockReturnValueOnce({
      data: [{
        id: 'abc-123', code: 'U-001', commercial_name: 'Rancho Prueba',
        unit_type: 'Productor' as const, status: 'active' as const,
        agro_sector: null, slug: 'rancho-prueba',
        created_at: '', updated_at: '',
        company_name: null, tax_id: null, tax_type: null,
        headcount: null, phone: null, email: null, website: null,
        address_line_1: null, address_line_2: null, location_url: null,
        country: null, state: null, default_contact: null,
        additional_params: null, attachments_url: null,
      }],
      isLoading: false,
      error: null,
    } as never)
    renderSection()
    expect(screen.getByText('Rancho Prueba')).toBeInTheDocument()
    expect(screen.getByText('U-001')).toBeInTheDocument()
  })
})
