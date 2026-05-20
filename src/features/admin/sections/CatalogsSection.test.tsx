import { screen, waitFor, render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { QueryClientProvider } from '@tanstack/react-query'
import { useCrops } from '../hooks/useCrops'
import { usePhytosanitaryCatalogs } from '../hooks/usePhytosanitary'
import { CatalogsSection } from './CatalogsSection'
import { createTestQueryClient } from '@/test/test-utils'

// ── Mocks ──

vi.mock('@/features/auth/useAuthStore', () => ({
  useAuthStore: vi.fn((selector: (s: { user: { role_level: number } | null }) => unknown) =>
    selector({ user: { role_level: 3 } }) // supervisor por defecto
  ),
}))

vi.mock('../hooks/useCrops', () => ({
  useCrops: vi.fn(() => ({ data: [], isLoading: false, error: null })),
  useCropDetail: vi.fn(() => ({ data: undefined, isLoading: false })),
  useCreateCrop: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  useUpdateCrop: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
}))

vi.mock('../hooks/usePhytosanitary', () => ({
  usePhytosanitaryCatalogs: vi.fn(() => ({ data: [], isLoading: false, error: null })),
  usePhytosanitaryDetail: vi.fn(() => ({ data: undefined, isLoading: false })),
  useCreatePhytosanitary: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  useUpdatePhytosanitary: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  useCreatePhytoPhoto: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  useDeletePhytoPhoto: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
}))

function renderSection() {
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <CatalogsSection />
    </QueryClientProvider>
  )
}

// ── Tests ──

describe('CatalogsSection', () => {
  it('renders tabs Cultivos and Fitosanitarios', () => {
    renderSection()
    expect(screen.getByRole('tab', { name: /Cultivos/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Fitosanitarios/i })).toBeInTheDocument()
  })

  it('supervisor (level 3) sees "+ Nuevo Cultivo" button', () => {
    renderSection()
    expect(screen.getByRole('button', { name: /Nuevo Cultivo/i })).toBeInTheDocument()
  })

  it('supervisor (level 3) sees "+ Nuevo Fitosanitario" button after switching tab', async () => {
    const user = userEvent.setup()
    renderSection()
    await user.click(screen.getByRole('tab', { name: /Fitosanitarios/i }))
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Nuevo Fitosanitario/i })).toBeInTheDocument()
    })
  })

  it('shows empty state for crops when useCrops returns []', () => {
    renderSection()
    expect(screen.getByText(/No hay cultivos registrados/i)).toBeInTheDocument()
  })

  it('shows empty state for fitosanitarios when usePhytosanitaryCatalogs returns []', async () => {
    const user = userEvent.setup()
    renderSection()
    await user.click(screen.getByRole('tab', { name: /Fitosanitarios/i }))
    await waitFor(() => {
      expect(screen.getByText(/No hay fitosanitarios registrados/i)).toBeInTheDocument()
    })
  })

  it('renders crop in table when useCrops returns data', () => {
    vi.mocked(useCrops).mockReturnValueOnce({
      data: [{
        id: 1, name: 'Mango Manila', code: 'MNG-MNL', variety: 'Manila',
        description: null, photo: '', additional_params: null, attachments_url: null,
      }],
      isLoading: false,
      error: null,
    } as never)
    renderSection()
    expect(screen.getByText('Mango Manila')).toBeInTheDocument()
    expect(screen.getByText('MNG-MNL')).toBeInTheDocument()
  })

  it('click on crop row opens CropPanel', async () => {
    vi.mocked(useCrops).mockReturnValueOnce({
      data: [{
        id: 1, name: 'Mango Manila', code: null, variety: null,
        description: null, photo: '', additional_params: null, attachments_url: null,
      }],
      isLoading: false,
      error: null,
    } as never)
    const user = userEvent.setup()
    renderSection()
    await user.click(screen.getByText('Mango Manila'))
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })
  })

  it('click on phyto row opens PhytosanitaryPanel', async () => {
    vi.mocked(usePhytosanitaryCatalogs).mockReturnValueOnce({
      data: [{
        id: 2, name: 'Antracnosis', type: 'Enfermedad',
        default_crop: { id: 1, name: 'Mango Manila', code: null, variety: null, description: null, photo: '', additional_params: null, attachments_url: null },
        default_crop_id: 1, description: null, min_ref_value: null, max_ref_value: null,
        stage_photos: [], additional_params: null, attachments_url: null,
      }],
      isLoading: false,
      error: null,
    } as never)
    const user = userEvent.setup()
    renderSection()
    await user.click(screen.getByRole('tab', { name: /Fitosanitarios/i }))
    await user.click(screen.getByText('Antracnosis'))
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })
  })
})
