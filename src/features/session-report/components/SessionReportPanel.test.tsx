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
// Los entregables (FASE RP) usan mutaciones propias; se mockean por lo mismo.
vi.mock('../hooks/useReportAssets', () => ({
  useUploadReportAssets: () => ({ mutate: vi.fn(), isPending: false }),
  useDownloadReportPdf: () => ({ mutate: vi.fn(), isPending: false }),
  useDownloadReportKmz: () => ({ mutate: vi.fn(), isPending: false }),
  useDownloadReportCsv: () => ({ mutate: vi.fn(), isPending: false }),
}))
// El flujo de publicacion por capas consulta catalogo y stats con react-query; se
// prueba aparte, en SoilPublishFlow.test.tsx.
vi.mock('./SoilPublishFlow', () => ({
  SoilPublishFlow: () => <div data-testid="soil-publish-flow" />,
}))
// La seccion de capas consulta catalogo y estadisticos con react-query; aqui las
// dependencias se sustituyen hook por hook y no hay QueryClientProvider.
vi.mock('./SoilLayerSection', () => ({
  SoilLayerSection: () => <div data-testid="soil-layer-block" />,
}))
// El formulario consulta el clima con su propia mutación (FASE KM); sin mock
// pediría un QueryClient que este test no monta.
vi.mock('../hooks/useReportWeather', () => ({
  useReportWeather: () => ({ mutate: vi.fn(), isPending: false }),
}))
vi.mock('../hooks/useSessionIssues', () => ({
  useSessionIssues: () => ({ data: [], isLoading: false }),
  useCreateSessionIssue: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateSessionIssue: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteSessionIssue: () => ({ mutate: vi.fn(), isPending: false }),
}))
vi.mock('@/features/geodata-visor/components/AspersionMap', () => ({
  AspersionMap: () => <div data-testid="aspersion-map" />,
}))
// El bloque de capas consulta el catalogo y los estadisticos con react-query; aqui
// las dependencias se sustituyen hook por hook y no hay QueryClientProvider. Su
// contenido se prueba en SoilLayerBlock.test.tsx; al panel solo le toca montarlo.

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

/** Reporte de suelo: sin semáforo ni telemetría, con las 49 capas resumidas. */
const REPORT_SUELO: SessionReport = {
  ...REPORT,
  id: 'r2', session_type: 'soilmap', activity_label: 'Mapeo de Suelo',
  general_snapshot: { productor: 'Productor X', rancho: 'Rancho Y' },
  stats_snapshot: {
    points_count: 16944,
    scale_note: 'Escala relativa a esta sesión.',
    layers_summary: [
      { key: 'ph', label: 'pH del suelo', kind: 'numeric', count: 16944 },
      { key: 'clay', label: 'Arcilla', kind: 'numeric', count: 16944 },
      { key: 'leak', label: 'Fuga', kind: 'numeric', count: 0 },
    ],
    published_layers: [],
    layers: {},
  },
} as unknown as SessionReport

function renderPanel(sessionType: 'aspersion' | 'soilmap' = 'aspersion') {
  return render(
    <SessionReportPanel
      open
      onClose={vi.fn()}
      objectId="h1"
      plotId="p1"
      sessionType={sessionType}
    />
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

  // RS-12: el panel se escribio para aspersion. Con un reporte de suelo mostraba
  // dosis, volumen y semaforo, todos en "—": no truena, pero miente.
  it('reporte de suelo: cambia la ficha y no muestra la telemetría de aspersión', () => {
    setRole(3)
    mockReport.mockReturnValue({
      data: REPORT_SUELO, isLoading: false, isError: false, refetch: vi.fn(),
    })
    renderPanel('soilmap')

    // Sale dos veces: en la descripcion del panel y en el titulo de la tarjeta.
    expect(screen.getAllByText(/mapeo de suelo/i).length).toBeGreaterThan(1)
    expect(screen.getByText('Muestras')).toBeTruthy()
    // 2 de 3 capas con datos: `leak` viene con count 0.
    expect(screen.getByText('2 de 3')).toBeTruthy()
    expect(screen.getByText('Escala relativa a esta sesión.')).toBeTruthy()

    expect(screen.queryByText('Dosis promedio (L/ha)')).toBeNull()
    expect(screen.queryByText('Volumen total (L)')).toBeNull()
    expect(screen.queryByText('Proporción meta')).toBeNull()
    expect(screen.queryByText('Clasificación de cobertura')).toBeNull()
    // La unidad de analisis de suelo es la capa: el bloque sustituye al semaforo.
    expect(screen.getByTestId('soil-layer-block')).toBeTruthy()
  })

  it('aspersión conserva su ficha completa', () => {
    setRole(3)
    mockReport.mockReturnValue({ data: REPORT, isLoading: false, isError: false, refetch: vi.fn() })
    renderPanel()

    expect(screen.getByText('Dosis promedio (L/ha)')).toBeTruthy()
    expect(screen.getByText('Proporción meta')).toBeTruthy()
    expect(screen.queryByText('Capas con datos')).toBeNull()
    expect(screen.queryByTestId('soil-layer-block')).toBeNull()
  })

  it('reporte NO publicado: ofrece Publicar y no muestra la liga pública', () => {
    setRole(3)
    mockReport.mockReturnValue({ data: REPORT, isLoading: false, isError: false, refetch: vi.fn() })
    renderPanel()
    expect(screen.getByRole('button', { name: /Publicar reporte/i })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Copiar liga p/i })).toBeNull()
  })

  it('reporte publicado: muestra la liga pública y ya no ofrece Publicar', () => {
    setRole(3)
    mockReport.mockReturnValue({
      data: { ...REPORT, status: 'publicado', map_snapshot: '/media/x.png' },
      isLoading: false, isError: false, refetch: vi.fn(),
    })
    renderPanel()
    expect(screen.getByRole('button', { name: /Copiar liga p/i })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Publicar reporte/i })).toBeNull()
    // La liga es el UUID que el reporte ya tiene: revocar = despublicar.
    expect(screen.getByText(new RegExp(`/r/${REPORT.id}/`))).toBeTruthy()
  })

  it('con reporte: ofrece Exportar KML aunque no haya captura del mapa', () => {
    setRole(3)
    // REPORT no tiene `map_snapshot`: el PDF se deshabilita por eso, pero el KMZ
    // no depende de la captura y debe quedar disponible igual (FASE KM).
    mockReport.mockReturnValue({ data: REPORT, isLoading: false, isError: false, refetch: vi.fn() })
    renderPanel()
    const kml = screen.getByRole('button', { name: /Exportar KML/i })
    expect((kml as HTMLButtonElement).disabled).toBe(false)
    expect((screen.getByRole('button', { name: /Descargar PDF/i }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('con reporte: al pulsar Generar en estado vacío aparece el formulario de creación', () => {
    setRole(3)
    mockReport.mockReturnValue({ data: null, isLoading: false, isError: false, refetch: vi.fn() })
    renderPanel()
    fireEvent.click(screen.getByRole('button', { name: /Generar reporte de actividad/i }))
    expect(screen.getByLabelText(/Observaciones/i)).toBeTruthy()
  })
})
