import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw-server'
import { tokens } from '@/lib/auth/tokens'
import { renderWithQueryClient } from '@/test/test-utils'

const mockNavigate = vi.fn()
vi.mock('@tanstack/react-router', async (importActual) => {
  const actual = await importActual<typeof import('@tanstack/react-router')>()
  return { ...actual, useNavigate: () => mockNavigate }
})

import { DataCentralMainSelector } from './DataCentralMainSelector'

const MAINS = [{ id: 'main-1', name: 'Org Alfa', slug: 'org-alfa', status: 'active', is_owner: true, created_at: '2026-01-01' }]
const CHILDREN = [{ id: 'dc-1', name: 'CIAgro Alfa 1', slug: 'ciagro-alfa-1', data_central_main: { id: 'main-1', name: 'Org Alfa' }, is_primary: true, is_owner: true, description: '', created_at: '2026-01-01' }]

const BASE_URL = 'http://localhost:8500/api/v1'

describe('DataCentralMainSelector', () => {
  beforeEach(() => {
    tokens.setAccess('test-token')
    server.use(
      http.get(`${BASE_URL}/organizations/data-centrals-main/`, () =>
        HttpResponse.json(MAINS),
      ),
      http.get(`${BASE_URL}/organizations/datacentrals/`, () =>
        HttpResponse.json(CHILDREN),
      ),
    )
  })

  afterEach(() => {
    tokens.clear()
    mockNavigate.mockClear()
  })

  it('fetches and displays DataCentralMain list', async () => {
    renderWithQueryClient(<DataCentralMainSelector />)

    await waitFor(() => {
      expect(screen.getByText('Org Alfa')).toBeInTheDocument()
    })
    expect(screen.getByText(/selecciona una organizacion/i)).toBeInTheDocument()
  })

  it('shows children after selecting a main', async () => {
    const user = userEvent.setup()
    renderWithQueryClient(<DataCentralMainSelector />)

    await waitFor(() => screen.getByText('Org Alfa'))
    await user.click(screen.getByText('Org Alfa'))

    await waitFor(() => {
      expect(screen.getByText('CIAgro Alfa 1')).toBeInTheDocument()
    })
  })
})
