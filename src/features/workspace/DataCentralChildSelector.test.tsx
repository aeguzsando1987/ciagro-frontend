import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { useWorkspaceStore } from './useWorkspaceStore'

const mockNavigate = vi.fn()
vi.mock('@tanstack/react-router', async (importActual) => {
  const actual = await importActual<typeof import('@tanstack/react-router')>()
  return { ...actual, useNavigate: () => mockNavigate }
})

import { DataCentralChildSelector } from './DataCentralChildSelector'
import type { DataCentral } from '@/types/workspace'

const DATACENTRALS: DataCentral[] = [
  {
    id: 'dc-1',
    name: 'CIAgro Bajio',
    slug: 'ciagro-bajio',
    data_central_main: { id: 'main-1', name: 'Main Org' },
    is_primary: true,
    is_owner: true,
    description: '',
    created_at: '2026-01-01',
  },
  {
    id: 'dc-2',
    name: 'CIAgro Norte',
    slug: 'ciagro-norte',
    data_central_main: { id: 'main-1', name: 'Main Org' },
    is_primary: false,
    is_owner: false,
    description: '',
    created_at: '2026-01-02',
  },
]

describe('DataCentralChildSelector', () => {
  beforeEach(() => {
    mockNavigate.mockClear()
    useWorkspaceStore.setState({ selectedDc: null })
  })

  it('renders a card for each datacentral', () => {
    render(<DataCentralChildSelector datacentrals={DATACENTRALS} />)
    expect(screen.getByText('CIAgro Bajio')).toBeInTheDocument()
    expect(screen.getByText('CIAgro Norte')).toBeInTheDocument()
  })

  it('shows Dueno badge only for is_owner datacentrals', () => {
    render(<DataCentralChildSelector datacentrals={DATACENTRALS} />)
    expect(screen.getByText('Dueno')).toBeInTheDocument()
    // Only one badge (dc-2 is not owner)
    expect(screen.getAllByText('Dueno')).toHaveLength(1)
  })

  it('stores selectedDc and navigates on card click', async () => {
    const user = userEvent.setup()
    render(<DataCentralChildSelector datacentrals={DATACENTRALS} />)

    await user.click(screen.getByText('CIAgro Bajio'))

    expect(useWorkspaceStore.getState().selectedDc).toEqual({ id: 'dc-1', name: 'CIAgro Bajio' })
    expect(mockNavigate).toHaveBeenCalledWith({
      to: '/w/$dc/dashboard',
      params: { dc: 'dc-1' },
    })
  })
})
