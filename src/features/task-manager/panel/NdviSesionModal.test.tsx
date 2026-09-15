import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { NdviSesionModal } from './NdviSesionModal'
import { useAuthStore } from '@/features/auth/useAuthStore'
import { ROLE_LEVELS } from '@/lib/auth/roles'
import { createTestQueryClient } from '@/test/test-utils'

vi.mock('./PlotMiniMap', () => ({ PlotMiniMap: () => <div data-testid="plot-mini-map" /> }))
vi.mock('../hooks/usePlotGeometry', () => ({
  usePlotGeometry: () => ({ data: { properties: { ranch_name: 'Rancho CL', code: 'CL-NDVI' } } }),
}))
vi.mock('../components/NdviImportDialog', () => ({ NdviImportDialog: () => null }))
vi.mock('../components/NdviMapModal', () => ({ NdviMapModal: () => null }))
vi.mock('../components/NdviImportSummary', () => ({
  NdviImportSummary: () => <div data-testid="ndvi-summary" />,
}))
vi.mock('../components/FlushNdviDialog', () => ({ FlushNdviDialog: () => null }))
vi.mock('../components/DeleteLevelDialog', () => ({ DeleteLevelDialog: () => null }))

const varStats = vi.fn()
vi.mock('../hooks/useNdviVariableStats', () => ({
  useNdviVariableStats: () => varStats(),
}))

const detail = vi.fn()
vi.mock('../hooks/useNdviSessionDetail', () => ({
  useNdviSessionDetail: () => ({ data: detail(), isLoading: false }),
}))

function base(over: Record<string, unknown> = {}) {
  return {
    id: 'ndvi-1',
    plot: 'plot-1',
    session_date: '2024-03-29',
    status: 'loaded',
    assigned_to: { id: 'u1', username: 'ana' },
    import_status: 'done',
    import_errors: null,
    points_count: '280',
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
      <NdviSesionModal
        sesionId="ndvi-1"
        hijoId="hijo-1"
        masterId="master-1"
        onClose={vi.fn()}
        onBack={vi.fn()}
      />
    </QueryClientProvider>
  )
}

// Sin estadisticas por defecto: cada test que las necesite las declara. Va en beforeEach
// y no dentro de renderModal para que ningun test herede el valor del anterior.
beforeEach(() => {
  varStats.mockReturnValue({ data: undefined, isLoading: false, error: null })
})

afterEach(() => {
  useAuthStore.setState({ user: null })
  vi.clearAllMocks()
})

/**
 * NDVI se reescribio entero sobre el chasis compartido y no tenia ningun test. Lo que se
 * fija aqui es lo que la homologacion le AÑADIO, que es justo lo que puede desaparecer sin
 * que nadie se entere: estado de sesion, responsable, rancho y parcela.
 */
describe('NdviSesionModal', () => {
  // Las tarjetas informativas son lo que el dev pidio replicar desde Rendimiento: NDVI
  // tenia el dato, pero enterrado en una tabla de 15 filas con media, minimo, maximo y
  // desviacion. La tabla se queda como detalle; el titular sube a tarjetas.
  it('pinta las tarjetas de indices principales encima del detalle', () => {
    varStats.mockReturnValue({
      isLoading: false,
      error: null,
      data: {
        points_count: 280,
        variables: [
          { key: 'ndvi', label: 'NDVI', count: 280, mean: 0.7241 },
          { key: 'ndre', label: 'NDRE', count: 280, mean: 0.3642 },
          { key: 'osavi', label: 'OSAVI', count: 280, mean: 0.51 },
          { key: 'vari', label: 'VARI', count: 280, mean: 0.12 },
        ],
      },
    })
    renderModal()

    expect(screen.getByText('Índices principales')).toBeInTheDocument()
    expect(screen.getByText('280 puntos importados')).toBeInTheDocument()
    // Tres decimales: con dos, NDVI y NDRE de rango estrecho saldrian indistinguibles.
    expect(screen.getByText('0.724')).toBeInTheDocument()
  })

  it('no pinta tarjetas si la sesion no tiene ninguna variable con datos', () => {
    varStats.mockReturnValue({
      isLoading: false,
      error: null,
      data: { points_count: 0, variables: [{ key: 'ndvi', label: 'NDVI', count: 0, mean: null }] },
    })
    renderModal()

    expect(screen.queryByText('Índices principales')).not.toBeInTheDocument()
  })

  it('muestra el estado de la sesion, que antes no se veia en ningun sitio', () => {
    renderModal({ status: 'cancelled' })
    expect(screen.getByText('Cancelado')).toBeInTheDocument()
  })

  it('muestra responsable, rancho y parcela, que venian en el detalle y no se pintaban', () => {
    renderModal()
    expect(screen.getByText('ana')).toBeInTheDocument()
    expect(screen.getByText('Rancho CL')).toBeInTheDocument()
    expect(screen.getByText('CL-NDVI')).toBeInTheDocument()
  })

  it('usa la redaccion canonica del estado de importacion', () => {
    renderModal({ import_status: 'done' })
    expect(screen.getByText('Completado')).toBeInTheDocument()
  })

  it('normaliza points_count, que el serializer sirve como string', () => {
    renderModal({ points_count: '280' })
    expect(screen.getByText('280')).toBeInTheDocument()
  })

  // Antes se podia lanzar una segunda importacion encima de una en curso.
  it('bloquea importar mientras hay una importacion en curso', () => {
    renderModal({ import_status: 'processing', points_count: '0' })
    expect(screen.getByRole('button', { name: /importar csv/i })).toBeDisabled()
    expect(screen.getByRole('status')).toHaveTextContent('Procesando CSV de NDVI…')
  })

  it('alterna Importar y Reimportar segun haya datos', () => {
    renderModal({ points_count: '0', import_status: 'pending' })
    expect(screen.getByRole('button', { name: 'Importar CSV' })).toBeInTheDocument()
  })

  it('deshabilita el visor mientras no haya puntos importados', () => {
    renderModal({ points_count: '0', import_status: 'pending' })
    expect(screen.getByRole('button', { name: 'Abrir visor' })).toBeDisabled()
  })

  it('explica el fallo de importacion en vez de dejar la sesion muda', () => {
    renderModal({ import_status: 'error', import_errors: { error: 'bad_csv' } })
    expect(screen.getByText('La importación falló')).toBeInTheDocument()
    expect(screen.getByText(/bad_csv/)).toBeInTheDocument()
  })

  it('solo ofrece las acciones de administrador a SuperAdmin', () => {
    renderModal({}, ROLE_LEVELS.SUPERVISOR)
    expect(screen.queryByText('Acciones de administrador')).not.toBeInTheDocument()
  })

  it('rotula las acciones destructivas para SuperAdmin', () => {
    renderModal({}, ROLE_LEVELS.SUPER_ADMIN)
    expect(screen.getByText('Acciones de administrador')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Eliminar los datos de esta sesión/ })
    ).toBeInTheDocument()
  })
})
