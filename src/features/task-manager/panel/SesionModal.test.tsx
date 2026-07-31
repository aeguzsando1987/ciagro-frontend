import { afterEach, describe, expect, it, vi } from 'vitest'
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
  render(
    <SoilMapView
      detail={{ ...detail, ...detailOverrides }}
      plotId="plot-1"
      transitions={[]}
      isMutatingStatus={false}
      statusError={null}
      onStatusChange={vi.fn()}
      onEdit={onEdit}
    />
  )
  return { onEdit }
}

afterEach(() => {
  act(() => {
    useAuthStore.setState({ user: null })
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

  it.each([
    ['rol insuficiente', ROLE_LEVELS.SUPERVISOR - 1, 'done', '3', false],
    ['importación incompleta', ROLE_LEVELS.SUPERVISOR, 'processing', '3', false],
    ['sin puntos', ROLE_LEVELS.SUPERVISOR, 'done', '0', false],
    ['datos disponibles', ROLE_LEVELS.SUPERVISOR, 'done', '3', true],
  ] as const)(
    'aplica el gate cuando hay %s',
    (_case, roleLevel, importStatus, pointsCount, expected) => {
      renderView(
        {
          import_status: importStatus,
          points_count: pointsCount,
        },
        roleLevel
      )

      const readiness = screen.queryByTestId('soil-map-ready')
      if (expected) expect(readiness).toBeInTheDocument()
      else expect(readiness).not.toBeInTheDocument()
    }
  )
})
