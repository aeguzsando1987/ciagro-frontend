import { screen, render, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw-server'
import { AssetsSection } from './AssetsSection'
import { createTestQueryClient } from '@/test/test-utils'

const BASE = 'http://localhost:8500'
const EMPTY_PAGE = { count: 0, results: [] }

// Fixture de un rancho aplanado para los mocks
const RANCH_FLAT = {
  id: 'uuid-r1',
  code: 'R-001',
  name: 'Rancho El Fresno',
  producer: 'uuid-p1',
  status: 'active' as const,
  area_uom: 'ha' as const,
  total_area: '250.00',
  city: 'Tlaltizapán',
  geom: null,
}

// ── Mocks globales ───────────────────────────────────────────────────────────

vi.mock('../hooks/useRanches', () => ({
  useRanches: vi.fn(() => ({ data: [RANCH_FLAT], isLoading: false, error: null })),
  useCreateRanch: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  useUpdateRanch: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  useDeleteRanch: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  ranchesQueryOptions: vi.fn(),
  ranchDetailQueryOptions: vi.fn(),
  useRanchDetail: vi.fn(() => ({ data: null })),
  RANCHES_KEY: ['admin', 'ranches'],
}))

vi.mock('../hooks/useProducers', () => ({
  useProducers: vi.fn(() => ({
    data: [{ id: 'uuid-p1', code: 'P-001', commercial_name: 'Productor Alpha' }],
  })),
  producersQueryOptions: vi.fn(),
  PRODUCERS_KEY: ['admin', 'producers'],
}))

vi.mock('../hooks/usePlots', () => ({
  usePlots: vi.fn(() => ({ data: [], isLoading: false, error: null })),
  useCreatePlot: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  useUpdatePlot: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  useDeletePlot: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  useImportPlotVertices: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  usePlotDetail: vi.fn(() => ({ data: null })),
  PLOTS_KEY: ['admin', 'plots'],
}))

vi.mock('../hooks/useRanchPartners', () => ({
  useRanchPartners: vi.fn(() => ({ data: [] })),
  useCreateRanchPartner: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  useDeleteRanchPartner: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  RANCH_PARTNERS_KEY: ['admin', 'ranch-partners'],
}))

vi.mock('../hooks/useGeography', () => ({
  useCountries: vi.fn(() => ({ data: [] })),
  useStates: vi.fn(() => ({ data: [] })),
}))

// MapLibre no funciona en JSDOM — mockear el minimapa para tests de UI
vi.mock('@/features/task-manager/panel/PlotMiniMap', () => ({
  PlotMiniMap: () => null,
}))

vi.mock('@/features/task-manager/hooks/usePlotGeometry', () => ({
  usePlotGeometry: vi.fn(() => ({ data: null, isLoading: false })),
}))

// useAuthStore mockeado a nivel de módulo (vi.mock hace hoisting, no admite closures)
vi.mock('@/features/auth/useAuthStore', () => ({
  useAuthStore: vi.fn((sel: (s: { user: { role_level: number } | null }) => unknown) =>
    sel({ user: { role_level: 5 } })
  ),
}))

beforeEach(() => {
  server.use(
    http.get(`${BASE}/api/v1/geography/countries/`, () => HttpResponse.json(EMPTY_PAGE)),
    http.get(`${BASE}/api/v1/geo_assets/ranches/`, () => HttpResponse.json(EMPTY_PAGE)),
    http.get(`${BASE}/api/v1/organizations/`, () => HttpResponse.json(EMPTY_PAGE)),
  )
})

function renderSection() {
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <AssetsSection />
    </QueryClientProvider>
  )
}

describe('AssetsSection', () => {
  it('renderiza el encabezado "Activos agrícolas"', () => {
    renderSection()
    expect(screen.getByRole('heading', { name: /Activos agrícolas/i })).toBeInTheDocument()
  })

  it('muestra el botón "Nuevo rancho" cuando el nivel de rol es ≥4 (Manager)', () => {
    renderSection()
    expect(screen.getByRole('button', { name: /Nuevo rancho/i })).toBeInTheDocument()
  })

  it('renderiza la fila del rancho en la tabla', () => {
    renderSection()
    expect(screen.getByText('R-001')).toBeInTheDocument()
    expect(screen.getByText('Rancho El Fresno')).toBeInTheDocument()
    expect(screen.getByText('Tlaltizapán')).toBeInTheDocument()
  })

  it('muestra el nombre del productor resuelto en la tabla', () => {
    renderSection()
    expect(screen.getByText('Productor Alpha')).toBeInTheDocument()
  })

  it('abre el formulario de creación al hacer click en "Nuevo rancho"', () => {
    renderSection()
    fireEvent.click(screen.getByRole('button', { name: /Nuevo rancho/i }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})
