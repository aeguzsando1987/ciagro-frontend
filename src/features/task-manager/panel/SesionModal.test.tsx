import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { SoilMapView } from './SesionModal'
import type { SoilMapSessionDetail } from '../hooks/useSoilMapSessionDetail'
import { useAuthStore } from '@/features/auth/useAuthStore'
import { ROLE_LEVELS } from '@/lib/auth/roles'

vi.mock('./PlotMiniMap', () => ({
  PlotMiniMap: ({ plotId }: { plotId: string | null }) => (
    <div data-testid="plot-mini-map">Parcela {plotId}</div>
  ),
}))

vi.mock('../components/AspersionMapModal', () => ({ AspersionMapModal: () => null }))
vi.mock('../components/PhytoMapModal', () => ({ PhytoMapModal: () => null }))
vi.mock('../components/SoilMapImportDialog', () => ({
  SoilMapImportDialog: ({ open }: { open: boolean }) =>
    open ? <div role="dialog">Importador de suelo</div> : null,
}))
vi.mock('../components/SoilMapMapModal', () => ({
  SoilMapMapModal: ({ open }: { open: boolean }) =>
    open ? <div data-testid="soil-map-modal">Visor de suelo</div> : null,
}))
const soilVarStats = vi.fn()
vi.mock('../hooks/useSoilMapVariableStats', () => ({
  useSoilMapVariableStats: () => soilVarStats(),
}))

vi.mock('react-map-gl/maplibre', () => ({
  default: () => null,
  Layer: () => null,
  Source: ({ children }: { children?: ReactNode }) => children ?? null,
  Popup: ({ children }: { children?: ReactNode }) => children ?? null,
}))

const detail: SoilMapSessionDetail = {
  id: 'soil-header-1',
  program: 'program-1',
  program_id: 'program-1',
  plot: 'plot-1',
  mapping_date: '2026-07-12',
  status: 'pending',
  assigned_to: { id: 'user-1', username: 'ana' },
  assigned_to_id: 'user-1',
  est_init_date: '2026-07-08',
  est_finish_date: '2026-07-09',
  real_init_date: '2026-07-10',
  real_finish_date: '2026-07-11',
  import_status: 'done',
  import_errors: null,
  imported_at: '2026-07-11T12:00:00Z',
  points_count: '3',
  created_at: '2026-07-01T00:00:00Z',
  updated_at: '2026-07-11T12:00:00Z',
}

function setRole(roleLevel: number) {
  act(() => {
    useAuthStore.setState({
      user: {
        id: 'user-1',
        username: 'ana',
        email: 'ana@example.com',
        role_name: 'test',
        role_level: roleLevel,
        requires_password_change: false,
        datacentrals: [],
      },
    })
  })
}

function renderView(
  detailOverrides: Partial<SoilMapSessionDetail> = {},
  roleLevel: number = ROLE_LEVELS.SUPERVISOR
) {
  setRole(roleLevel)
  const onEdit = vi.fn()
  // Con SUPER_ADMIN la vista monta los dialogos de vaciado y borrado, que usan react-query.
  // Antes ningun test llegaba a ese rol y por eso el provider no hacia falta.
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={qc}>
    <SoilMapView
      onDeleted={vi.fn()}
      detail={{ ...detail, ...detailOverrides }}
      plotId="plot-1"
      datacentralId="dc-1"
      transitions={[]}
      isMutatingStatus={false}
      statusError={null}
      onStatusChange={vi.fn()}
      onEdit={onEdit}
      onBack={vi.fn()}
    />
    </QueryClientProvider>
  )
  return { onEdit }
}

beforeEach(() => {
  soilVarStats.mockReturnValue({ data: undefined, isLoading: false, error: null })
})

afterEach(() => {
  act(() => {
    useAuthStore.setState({ user: null })
  })
})

/**
 * Mapeo de suelo NO mostraba ningun resumen, pese a que su endpoint /variable-stats/ existe
 * desde la FASE SL: lo consumian solo el Visor y el reporteador. Las tarjetas son lo que el
 * dev pidio replicar desde Rendimiento.
 */
describe('SoilMapView · tarjetas informativas', () => {
  it('pinta los titulares del analisis de suelo con su conteo de puntos', () => {
    soilVarStats.mockReturnValue({
      isLoading: false,
      error: null,
      data: {
        points_count: 1200,
        variables: [
          { key: 'Clay', label: 'Arcilla', count: 1200, mean: 22.4 },
          { key: 'pH', label: 'pH', count: 1200, mean: 6.81 },
          { key: 'OM', label: 'Materia orgánica', count: 1200, mean: 3.42 },
        ],
      },
    })
    renderView({ import_status: 'done' })

    expect(screen.getByText('Resumen del análisis de suelo')).toBeInTheDocument()
    expect(screen.getByText('1,200 puntos importados')).toBeInTheDocument()
    // pH y OM son titulares declarados y van PRIMERO aunque el backend liste Arcilla antes.
    expect(screen.getByText('6.81')).toBeInTheDocument()
    expect(screen.getByText('3.42')).toBeInTheDocument()
  })

  it('no consulta ni pinta el resumen si la importacion no ha terminado', () => {
    renderView({ import_status: 'pending', points_count: '0' })
    expect(screen.queryByText('Resumen del análisis de suelo')).not.toBeInTheDocument()
  })
})

describe('SoilMapView', () => {
  it('muestra los metadatos propios de suelo y conserva PlotMiniMap', () => {
    const { onEdit } = renderView()

    expect(screen.getByText('2026-07-12')).toBeInTheDocument()
    expect(screen.getByText('ana')).toBeInTheDocument()
    expect(screen.getByText('Puntos importados')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByTestId('plot-mini-map')).toHaveTextContent('plot-1')
    expect(screen.queryByText('Evaluación')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Editar' }))
    expect(onEdit).toHaveBeenCalledOnce()
  })

  it('abre el diálogo de importación de suelo', () => {
    renderView()

    fireEvent.click(screen.getByRole('button', { name: 'Reimportar datos' }))

    expect(screen.getByRole('dialog')).toHaveTextContent('Importador de suelo')
  })

  it('abre el visor de suelo cuando la sesión tiene puntos importados', () => {
    renderView()

    fireEvent.click(screen.getByRole('button', { name: 'Abrir visor de datos de suelo' }))

    expect(screen.getByTestId('soil-map-modal')).toHaveTextContent('Visor de suelo')
  })

  // El gate tiene DOS ejes que antes se colapsaban en uno solo: el ROL decide si la accion
  // existe, y los DATOS deciden si esta habilitada. Ofrecer un visor deshabilitado a quien
  // nunca podra abrirlo genera preguntas; ocultarselo a un supervisor que solo tiene que
  // importar el CSV le esconde el camino. Se separan, como en el modal de Rendimiento.
  it('no ofrece el visor a un rol por debajo de Supervisor, ni siquiera deshabilitado', () => {
    renderView({ import_status: 'done', points_count: '3' }, ROLE_LEVELS.SUPERVISOR - 1)
    expect(screen.queryByTestId('soil-map-ready')).not.toBeInTheDocument()
  })

  it.each([
    ['importación incompleta', 'processing', '3'],
    ['sin puntos', 'done', '0'],
  ] as const)('ofrece el visor deshabilitado al Supervisor cuando hay %s', (_caso, importStatus, puntos) => {
    renderView({ import_status: importStatus, points_count: puntos }, ROLE_LEVELS.SUPERVISOR)

    const visor = screen.getByTestId('soil-map-ready')
    expect(visor).toBeDisabled()
    expect(visor).toHaveAttribute('title', 'Importa datos para habilitar el visor')
  })

  it('habilita el visor cuando la importación terminó y hay puntos', () => {
    renderView({ import_status: 'done', points_count: '3' }, ROLE_LEVELS.SUPERVISOR)
    expect(screen.getByTestId('soil-map-ready')).toBeEnabled()
  })

  it.each([
    ['sin puntos', '0', false],
    ['con puntos', '3', true],
  ] as const)(
    'el boton de vaciar datos solo aparece %s',
    (_caso, pointsCount, esperado) => {
      // Una sesion recien creada no tiene nada que vaciar: ofrecerlo confunde, porque
      // sugiere que hay datos donde no los hay. El borrado de la sesion COMPLETA si debe
      // seguir disponible, y por eso no se gatea.
      renderView({ points_count: pointsCount }, ROLE_LEVELS.SUPER_ADMIN)

      const vaciar = screen.queryByRole('button', { name: /Eliminar los datos de esta sesión/ })
      if (esperado) expect(vaciar).toBeInTheDocument()
      else expect(vaciar).not.toBeInTheDocument()

      expect(
        screen.getByRole('button', { name: /Eliminar la sesión completa/ })
      ).toBeInTheDocument()
    }
  )
})
