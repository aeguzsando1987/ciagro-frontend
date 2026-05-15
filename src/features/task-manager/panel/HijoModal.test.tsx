import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('./PlotMiniMap', () => ({ PlotMiniMap: () => null }))
import { QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw-server'
import { HijoModal } from './HijoModal'
import { useAuthStore } from '@/features/auth/useAuthStore'
import { createTestQueryClient } from '@/test/test-utils'
import type { ProgramaTree, MasterProgram } from '@/features/task-manager/types'

const BASE = 'http://localhost:8500'

const mockMaster: MasterProgram = {
  id: 'master-1',
  title: 'Programa Primavera',
  code: 'PROG-2026-A',
  status: 'in_progress',
  status_display: 'En progreso',
  agro_unit: 'prod-1',
  est_start_date: '2026-06-01',
  est_finish_date: '2026-08-31',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

const mockHijo: ProgramaTree = {
  id: 'hijo-1',
  title: 'Subprograma Norte',
  voucher_code: null,
  cycle: 'Primavera-2026',
  plot: null,
  status: 'pending',
  status_display: 'Pendiente',
  est_start_date: '2026-06-01',
  est_finish_date: '2026-07-15',
  aspersion_sessions: [
    { id: 'asp-1', type: 'aspersion', aspersion_date: '2026-06-10', import_status: 'pending' },
  ],
  phyto_monitoring_headers: [
    { id: 'phyto-1', type: 'phyto', session_date: '2026-06-20', import_status: 'done', status: 'completed' },
  ],
}

function setRole(role_level: number) {
  useAuthStore.setState({
    user: {
      id: 'u1',
      username: 'user',
      email: 'u@test.com',
      role_name: 'test',
      role_level,
      requires_password_change: false,
      datacentrals: [],
    },
  })
}

afterEach(() => {
  vi.restoreAllMocks()
  useAuthStore.setState({ user: null })
  server.resetHandlers()
})

// Aislamiento del flujo de auth: si una request escapa a Django (entorno de
// test) y devuelve 401, el interceptor llama forceLogout()→clearUser(), que
// vaciaría el store de roles y rompería las asserts de visibilidad por rol.
// Este test verifica renderizado por rol, no el flujo de logout — neutralizamos
// clearUser() para que el efecto secundario no contamine la prueba.
beforeEach(() => {
  vi.spyOn(useAuthStore.getState(), 'clearUser').mockImplementation(() => {})
  // useAgroUnits y useCrops se montan siempre (no son lazy); necesitan handler.
  server.use(
    http.get(`${BASE}/api/v1/organizations/`, () =>
      HttpResponse.json({ count: 0, results: [] })
    ),
    http.get(`${BASE}/api/v1/agro-catalogs/crops/`, () =>
      HttpResponse.json({ count: 0, results: [] })
    )
  )
})

function renderModal(role_level: number) {
  setRole(role_level)
  const qc = createTestQueryClient()
  render(
    <QueryClientProvider client={qc}>
      <HijoModal
        hijo={mockHijo}
        master={mockMaster}
        datacentralId="dc-1"
        onClose={vi.fn()}
        onBack={vi.fn()}
        onNavigateSesion={vi.fn()}
      />
    </QueryClientProvider>
  )
}

describe('HijoModal', () => {
  it('renderiza título y ciclo del Subprograma', async () => {
    renderModal(3)
    await waitFor(() => screen.getByRole('dialog'))
    expect(screen.getByText('Subprograma Norte')).toBeInTheDocument()
    expect(screen.getByText('Primavera-2026')).toBeInTheDocument()
  })

  it('lista de sesiones renderiza aspersión y fitosanitario mezclados', async () => {
    renderModal(3)
    await waitFor(() => screen.getByRole('dialog'))
    expect(screen.getByText(/Aspersión.*2026-06-10/i)).toBeInTheDocument()
    expect(screen.getByText(/Fitosanitario.*2026-06-20/i)).toBeInTheDocument()
  })

  it('Técnico (level 2) ve botón "+ Nueva Sesión"', async () => {
    renderModal(2)
    await waitFor(() => screen.getByRole('dialog'))
    expect(screen.getByRole('button', { name: /Nueva Sesión/i })).toBeInTheDocument()
  })

  it('Gerente (level 4) ve botón "Editar" y "+ Nueva Sesión"', async () => {
    renderModal(4)
    await waitFor(() => screen.getByRole('dialog'))
    expect(screen.getByRole('button', { name: /Editar/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Nueva Sesión/i })).toBeInTheDocument()
  })

  it('Supervisor (level 3) NO ve botón "Editar"', async () => {
    renderModal(3)
    await waitFor(() => screen.getByRole('dialog'))
    expect(screen.queryByRole('button', { name: /Editar/i })).not.toBeInTheDocument()
  })
})
