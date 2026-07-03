/**
 * Tests del panel: gate de escritura (rol) + estados sin/ con reporte. Los hooks de datos y
 * mutación se mockean para no requerir red ni QueryClient.
 */
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { useAuthStore } from '@/features/auth/useAuthStore'
import type { SessionReport } from '../types'

// ─── Mocks de hooks ──────────────────────────────────────────────────────────
const mockReport = vi.fn()
vi.mock('../hooks/useSessionReport', async () => {
  const actual = await vi.importActual<typeof import('../hooks/useSessionReport')>(
    '../hooks/useSessionReport'
  )
  return {
    ...actual,
    useSessionReport: () => mockReport(),
    useCreateSessionReport: () => ({ mutate: vi.fn(), isPending: false }),
    useUpdateSessionReport: () => ({ mutate: vi.fn(), isPending: false }),
    useSyncSessionReport: () => ({ mutate: vi.fn(), isPending: false }),
  }
})
vi.mock('../hooks/useSessionIssues', () => ({
  useSessionIssues: () => ({ data: [], isLoading: false }),
  useCreateSessionIssue: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateSessionIssue: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteSessionIssue: () => ({ mutate: vi.fn(), isPending: false }),
}))

import { SessionReportPanel } from './SessionReportPanel'

function setRole(role_level: number) {
  useAuthStore.setState({
    user: {
      id: 'u1', username: 'user', email: 'u@test.com',
      role_name: 'test', role_level, requires_password_change: false, datacentrals: [],
    },
  })
}

const REPORT: SessionReport = {
  id: 'r1', session_type: 'aspersion', object_id: 'h1', activity_label: 'Aspersión',
  plot: 'p1', resume_text: 'Resumen', report_date: '2026-06-30',
  general_snapshot: { productor: 'Productor X', rancho: 'Rancho Y' },
  stats_snapshot: { points_count: 10, semaforo: { excelente: { color: 'verde', area_ha: 1, pct_area_total: 100 } } },
  day_temperature: null, lead: '', ranch_manager: '', status: 'en_proceso',
  status_display: 'En proceso', issues: [],
  created_at: '2026-06-30T00:00:00Z', updated_at: '2026-06-30T00:00:00Z',
} as unknown as SessionReport

function renderPanel() {
  return render(
    <SessionReportPanel open onClose={vi.fn()} objectId="h1" plotId="p1" />
  )
}

beforeEach(() => mockReport.mockReset())
afterEach(() => useAuthStore.setState({ user: null }))

describe('SessionReportPanel', () => {
  it('sin reporte: muestra el botón Generar (habilitado con rol técnico+)', () => {
    setRole(3)
    mockReport.mockReturnValue({ data: null, isLoading: false, isError: false, refetch: vi.fn() })
    renderPanel()
    const btn = screen.getByRole('button', { name: /Generar reporte de actividad/i })
    expect(btn).toBeTruthy()
    expect((btn as HTMLButtonElement).disabled).toBe(false)
  })

  it('sin reporte y rol Guest: el botón Generar queda deshabilitado', () => {
    setRole(1)
    mockReport.mockReturnValue({ data: null, isLoading: false, isError: false, refetch: vi.fn() })
    renderPanel()
    const btn = screen.getByRole('button', { name: /Generar reporte de actividad/i })
    expect((btn as HTMLButtonElement).disabled).toBe(true)
  })

  it('con reporte: muestra la tarjeta (datos denormalizados) y el semáforo', () => {
    setRole(3)
    mockReport.mockReturnValue({ data: REPORT, isLoading: false, isError: false, refetch: vi.fn() })
    renderPanel()
    expect(screen.getByText('Productor X')).toBeTruthy()
    expect(screen.getByText('Excelente')).toBeTruthy()
    expect(screen.getByText('Temas de atención y observaciones')).toBeTruthy()
  })

  it('con reporte: al pulsar Generar en estado vacío aparece el formulario de creación', () => {
    setRole(3)
    mockReport.mockReturnValue({ data: null, isLoading: false, isError: false, refetch: vi.fn() })
    renderPanel()
    fireEvent.click(screen.getByRole('button', { name: /Generar reporte de actividad/i }))
    expect(screen.getByLabelText(/Observaciones/i)).toBeTruthy()
  })
})
