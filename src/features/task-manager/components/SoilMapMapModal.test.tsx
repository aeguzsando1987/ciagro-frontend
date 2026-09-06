import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '@/features/auth/useAuthStore'
import { ROLE_LEVELS } from '@/lib/auth/roles'

vi.mock('@/features/geodata-visor/components/SoilMap', () => ({
  SoilMap: ({
    toolbarStart,
    toolbarEnd,
  }: {
    toolbarStart?: React.ReactNode
    toolbarEnd?: React.ReactNode
  }) => (
    <div data-testid="soil-map">
      {toolbarStart}
      {toolbarEnd}
    </div>
  ),
}))
// El panel de reportes arrastra ReportMapCapture -> AspersionMap -> maplibre, que
// necesita WebGL y revienta en JSDOM. Mismo mock que SessionReportPanel.test.tsx.
vi.mock('@/features/geodata-visor/components/AspersionMap', () => ({
  AspersionMap: () => <div data-testid="aspersion-map" />,
}))

const mockDetail = vi.fn()
vi.mock('@/features/task-manager/hooks/useSoilMapSessionDetail', () => ({
  useSoilMapSessionDetail: () => mockDetail(),
}))

import { SoilMapMapModal } from './SoilMapMapModal'

function setRole(role_level: number) {
  useAuthStore.setState({
    user: {
      id: 'u1', username: 'user', email: 'u@test.com',
      role_name: 'test', role_level, requires_password_change: false, datacentrals: [],
    },
  })
}

function renderModal(props: Partial<React.ComponentProps<typeof SoilMapMapModal>> = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <SoilMapMapModal
        open
        onClose={vi.fn()}
        sessionId="soil-header-1"
        plotId="plot-1"
        {...props}
      />
    </QueryClientProvider>
  )
}

describe('SoilMapMapModal', () => {
  // Sin dato por defecto el mock devolveria undefined y el toggle reventaria al
  // desestructurar en cualquier re-render suelto.
  beforeEach(() => {
    mockDetail.mockReturnValue({ data: undefined })
    useAuthStore.setState({ user: null })
  })

  it('monta el visor y permite cerrarlo con su botón', () => {
    const onClose = vi.fn()
    renderModal({ onClose })

    expect(screen.getByTestId('soil-map')).toBeInTheDocument()
    expect(screen.getByText('Mapa de suelo')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '✕ Cerrar' }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('no monta el visor cuando está cerrado', () => {
    renderModal({ open: false })

    expect(screen.queryByTestId('soil-map')).not.toBeInTheDocument()
  })

  // H10: hasta RS-12 el visor de suelo no tenia entrada al reporteador.
  it('ofrece el reporteador con sesión cargada y rol suficiente', () => {
    setRole(ROLE_LEVELS.SUPERVISOR)
    mockDetail.mockReturnValue({ data: { import_status: 'done', points_count: '16944' } })
    renderModal()

    expect(screen.getByRole('button', { name: '📋 Reportes' })).toBeInTheDocument()
  })

  it('no ofrece el reporteador si la sesión no tiene puntos', () => {
    setRole(ROLE_LEVELS.SUPERVISOR)
    mockDetail.mockReturnValue({ data: { import_status: 'done', points_count: '0' } })
    renderModal()

    expect(screen.queryByRole('button', { name: '📋 Reportes' })).not.toBeInTheDocument()
  })

  it('no ofrece el reporteador a un rol por debajo de supervisor', () => {
    setRole(ROLE_LEVELS.TECHNICIAN)
    mockDetail.mockReturnValue({ data: { import_status: 'done', points_count: '16944' } })
    renderModal()

    expect(screen.queryByRole('button', { name: '📋 Reportes' })).not.toBeInTheDocument()
  })
})
