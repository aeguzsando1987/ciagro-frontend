import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw-server'
import { MaestroModal } from './MaestroModal'
import { useAuthStore } from '@/features/auth/useAuthStore'
import { createTestQueryClient } from '@/test/test-utils'
import type { MasterProgram } from '@/features/task-manager/types'

const BASE = 'http://localhost:8500'

const mockMaster: MasterProgram = {
  id: 'master-1',
  title: 'Programa Primavera',
  code: 'PROG-2026-A',
  status: 'pending',
  status_display: 'Pendiente',
  agro_unit: 'prod-1',
  est_start_date: '2026-06-01',
  est_finish_date: '2026-08-31',
  notes: 'Notas del programa',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

const mockTree = {
  programas: [
    {
      id: 'hijo-1',
      title: 'Subprograma Norte',
      status: 'pending',
      status_display: 'Pendiente',
      est_start_date: '2026-06-01',
      est_finish_date: '2026-07-31',
      aspersion_sessions: [],
      phyto_monitoring_headers: [],
    },
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
  useAuthStore.setState({ user: null })
  server.resetHandlers()
})

beforeEach(() =>
  server.use(
    http.get(`${BASE}/api/v1/organizations/`, () =>
      HttpResponse.json({
        count: 1,
        results: [{ id: 'prod-1', commercial_name: 'Rancho El Sol', code: 'RS-001' }],
      })
    )
  )
)

function renderModal(role_level: number) {
  setRole(role_level)
  const qc = createTestQueryClient()
  // Pre-cargamos el árbol en cache para evitar fetch de red en el test.
  // El árbol ya estaría cargado en prod si el Maestro fue expandido en el Gantt.
  qc.setQueryData(['master-tree', 'master-1'], mockTree)
  render(
    <QueryClientProvider client={qc}>
      <MaestroModal
        master={mockMaster}
        datacentral="dc-1"
        onClose={vi.fn()}
        onNavigateHijo={vi.fn()}
      />
    </QueryClientProvider>
  )
}

describe('MaestroModal', () => {
  it('renderiza título, código y fechas del Programa', async () => {
    renderModal(3)
    await waitFor(() => screen.getByRole('dialog'))
    expect(screen.getByText('Programa Primavera')).toBeInTheDocument()
    expect(screen.getByText('PROG-2026-A')).toBeInTheDocument()
    expect(screen.getByText('2026-06-01')).toBeInTheDocument()
    expect(screen.getByText('2026-08-31')).toBeInTheDocument()
  })

  it('Gerente (level 4) ve botón "Editar"', async () => {
    renderModal(4)
    await waitFor(() => screen.getByRole('dialog'))
    expect(screen.getByRole('button', { name: /Editar/i })).toBeInTheDocument()
  })

  it('Técnico (level 2) NO ve botón "Editar"', async () => {
    renderModal(2)
    await waitFor(() => screen.getByRole('dialog'))
    expect(screen.queryByRole('button', { name: /Editar/i })).not.toBeInTheDocument()
  })

  it('lista de subprogramas renderiza ítems del árbol en cache', async () => {
    renderModal(3)
    await waitFor(() => screen.getByRole('dialog'))
    expect(screen.getByText('Subprograma Norte')).toBeInTheDocument()
  })
})
