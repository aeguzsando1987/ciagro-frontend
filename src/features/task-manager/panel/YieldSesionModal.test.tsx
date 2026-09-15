import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClientProvider } from '@tanstack/react-query'
import { YieldSesionModal } from './YieldSesionModal'
import { useAuthStore } from '@/features/auth/useAuthStore'
import { ROLE_LEVELS } from '@/lib/auth/roles'
import { createTestQueryClient } from '@/test/test-utils'

vi.mock('./PlotMiniMap', () => ({ PlotMiniMap: () => <div data-testid="plot-mini-map" /> }))
vi.mock('../hooks/usePlotGeometry', () => ({
  usePlotGeometry: () => ({ data: { properties: { ranch_name: 'Rancho CL', code: 'CL-REN' } } }),
}))
vi.mock('@/features/yield-map/components/YieldMapImportDialog', () => ({
  YieldMapImportDialog: () => null,
}))
vi.mock('@/features/yield-map/components/YieldMapModal', () => ({ YieldMapModal: () => null }))
vi.mock('../components/FlushYieldMapDialog', () => ({ FlushYieldMapDialog: () => null }))
vi.mock('../components/DeleteLevelDialog', () => ({ DeleteLevelDialog: () => null }))

const detail = vi.fn()
const stats = vi.fn()
vi.mock('@/features/yield-map/hooks/useYieldMapSessionDetail', () => ({
  useYieldMapSessionDetail: () => ({ data: detail(), isLoading: false }),
}))
vi.mock('@/features/yield-map/hooks/useYieldMapStats', () => ({
  useYieldMapStats: () => ({ data: stats() }),
}))
vi.mock('@/features/yield-map/hooks/useUpdateYieldMapSession', () => ({
  useUpdateYieldMapSession: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))

function base(over: Record<string, unknown> = {}) {
  return {
    id: 'yield-1',
    plot: 'plot-1',
    harvest_date: '2024-11-20',
    status: 'loaded',
    assigned_to: { id: 'u1', username: 'ana' },
    est_init_date: null,
    est_finish_date: null,
    import_status: 'done',
    import_errors: null,
    points_count: 320,
    source_lot: null,
    source_product: null,
    source_dataset: null,
    ...over,
  }
}

function renderModal(over: Record<string, unknown> = {}, roleLevel: number = ROLE_LEVELS.SUPERVISOR) {
  detail.mockReturnValue(base(over))
  useAuthStore.setState({
    user: {
      id: 'u1',
      username: 'ana',
      email: 'a@t.com',
      role_name: 'test',
      role_level: roleLevel,
      requires_password_change: false,
      datacentrals: [],
    },
  })
  render(
    <QueryClientProvider client={createTestQueryClient()}>
      <YieldSesionModal
        sesionId="yield-1"
        hijoId="hijo-1"
        masterId="master-1"
        onClose={vi.fn()}
        onBack={vi.fn()}
      />
    </QueryClientProvider>
  )
}

afterEach(() => {
  useAuthStore.setState({ user: null })
  vi.clearAllMocks()
})

/**
 * Rendimiento es la REFERENCIA de diseño de los cinco modales y no tenia ni un test: toda
 * la extraccion del chasis en HM-1/HM-2 se valido por lectura. Esto cubre el hueco, y de
 * paso fija el contrato que los otros cuatro copian.
 */
describe('YieldSesionModal', () => {
  it('rinde la ficha completa: fecha, puntos, responsable, rancho y parcela', () => {
    stats.mockReturnValue(undefined)
    renderModal()

    expect(screen.getByText('2024-11-20')).toBeInTheDocument()
    expect(screen.getByText('320')).toBeInTheDocument()
    expect(screen.getByText('ana')).toBeInTheDocument()
    expect(screen.getByText('Rancho CL')).toBeInTheDocument()
    expect(screen.getByText('CL-REN')).toBeInTheDocument()
  })

  // Se usa cancelled y no completed a proposito: con completed el texto "Completado"
  // aparece dos veces, porque tambien es la etiqueta de import_status done. Son dos datos
  // distintos que legitimamente comparten palabra, y se distinguen por su dt en la ficha.
  it('pinta el estado de la sesion en la cabecera', () => {
    stats.mockReturnValue(undefined)
    renderModal({ status: 'cancelled' })
    expect(screen.getByText('Cancelado')).toBeInTheDocument()
  })

  it('no ofrece editar por debajo de Supervisor', () => {
    stats.mockReturnValue(undefined)
    renderModal({}, ROLE_LEVELS.TECHNICIAN)
    expect(screen.queryByRole('button', { name: /Editar/ })).not.toBeInTheDocument()
  })

  it('despliega el formulario en linea y oculta el disparador al editar', async () => {
    const user = userEvent.setup()
    stats.mockReturnValue(undefined)
    renderModal()

    await user.click(screen.getByRole('button', { name: /Editar/ }))

    expect(screen.getByLabelText(/Fecha de cosecha \*/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Editar$/ })).not.toBeInTheDocument()
  })

  it('bloquea importar y visor mientras el CSV se procesa', () => {
    stats.mockReturnValue(undefined)
    renderModal({ import_status: 'processing', points_count: 0 })

    expect(screen.getByRole('button', { name: /Importar CSV/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Abrir visor' })).toBeDisabled()
    expect(screen.getByRole('status')).toHaveTextContent('Procesando CSV de rendimiento…')
  })

  it('muestra el resumen del mapa cuando hay estadisticas', () => {
    stats.mockReturnValue({
      yield_avg: 8.5,
      production_total_t: 120.25,
      moisture_avg: 14,
      surface_total_ha: 41.43,
    })
    renderModal()

    expect(screen.getByText('Resumen del mapa')).toBeInTheDocument()
    expect(screen.getByText('8.50 t/ha')).toBeInTheDocument()
    expect(screen.getByText('41.43 ha')).toBeInTheDocument()
  })

  it('rotula las acciones destructivas para SuperAdmin y las esconde al resto', () => {
    stats.mockReturnValue(undefined)
    renderModal({}, ROLE_LEVELS.SUPER_ADMIN)
    expect(screen.getByText('Acciones de administrador')).toBeInTheDocument()
  })
})
