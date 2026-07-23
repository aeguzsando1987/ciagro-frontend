import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('./PlotMiniMap', () => ({ PlotMiniMap: () => null }))

// useHijoDetail hace fetch real que escapa a MSW en jsdom; al mockearlo
// aquí evitamos dependencia de red y detail siempre está disponible.
vi.mock('@/features/task-manager/hooks/useHijoDetail', () => ({
  useHijoDetail: () => ({
    data: {
      id: 'hijo-1',
      voucher_code: null,
      title: 'Subprograma Norte',
      cycle: 'Primavera-2026',
      status: 'pending',
      status_display: 'Pendiente',
      crop: null,
      crop_variety: null,
      individual: null,
      agro_unit: 'prod-1',
      plot: null,
      master_program: 'master-1',
      est_start_date: '2026-06-01T00:00:00Z',
      est_finish_date: '2026-07-15T00:00:00Z',
      actual_start_date: null,
      actual_finish_date: null,
      location_url: null,
      attachments_url: [],
    },
    isLoading: false,
  }),
  hijoDetailQueryOptions: (id: string) => ({ queryKey: ['hijo-detail', id] }),
}))
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
  soil_map_headers: [],
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
  // useCrops y useHijoDetail se montan siempre; necesitan handler.
  server.use(
    http.get(`${BASE}/api/v1/organizations/`, () =>
      HttpResponse.json({ count: 0, results: [] })
    ),
    http.get(`${BASE}/api/v1/agro-catalogs/crops/`, () =>
      HttpResponse.json({ count: 0, results: [] })
    ),
    // Detalle del Subprograma (GET /tasks/{id}/) — useHijoDetail lo consume
    // para el formulario de edición (fechas reales + cultivo).
    http.get(`${BASE}/api/v1/field_ops/tasks/:id/`, () =>
      HttpResponse.json({
        id: 'hijo-1',
        voucher_code: null,
        title: 'Subprograma Norte',
        cycle: 'Primavera-2026',
        status: 'pending',
        status_display: 'Pendiente',
        crop: null,
        crop_variety: null,
        individual: null,
        agro_unit: 'prod-1',
        plot: null,
        master_program: 'master-1',
        est_start_date: '2026-06-01',
        est_finish_date: '2026-07-15',
        actual_start_date: null,
        actual_finish_date: null,
        location_url: null,
        attachments_url: [],
      })
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
    expect(screen.getByRole('button', { name: /^Editar$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Nueva Sesión/i })).toBeInTheDocument()
  })

  it('Supervisor (level 3) NO ve botón "Editar"', async () => {
    renderModal(3)
    await waitFor(() => screen.getByRole('dialog'))
    expect(screen.queryByRole('button', { name: /Editar/i })).not.toBeInTheDocument()
  })
})
