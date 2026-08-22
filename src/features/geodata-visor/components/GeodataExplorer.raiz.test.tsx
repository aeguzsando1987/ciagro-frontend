/**
 * Raíz del árbol según el alcance del usuario.
 *
 * Un nivel con un solo hijo no se pinta: obligar a expandir un nodo que no ofrece
 * ninguna elección es trabajo sin información. Los niveles ocultos NO desaparecen del
 * modelo, viajan como ancestros implícitos, porque el dashboard y los mapas necesitan
 * saber de qué CIAgro cuelga lo seleccionado.
 *
 * La fila "Dashboard" va aparte del árbol: cuando la raíz colapsa, el nodo de CIAgro
 * deja de existir y con él se perdía el único camino de vuelta al panel de bienvenida.
 */
import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { useAuthStore } from '@/features/auth/useAuthStore'
import type { AuthUser } from '@/types/auth'

const orgsMock = vi.hoisted(() => vi.fn())

vi.mock('@/features/admin/hooks/useDataCentrals', () => ({
  useDataCentralMains: orgsMock,
  useDataCentrals: () => ({
    data: [{ id: 'dc-1', name: 'CIAgro Norte' }],
    isLoading: false,
    isError: false,
  }),
}))
vi.mock('@/features/admin/hooks/useProducers', () => ({
  useProducers: () => ({
    data: [{ id: 'prod-1', commercial_name: 'Agrounidad Uno', code: 'A1' }],
    isLoading: false,
  }),
}))
vi.mock('@/features/admin/hooks/useRanches', () => ({
  useRanches: () => ({
    data: [{ id: 'r-1', name: 'Rancho Uno', code: 'R1', producer: 'prod-1' }],
    isLoading: false,
    isError: false,
  }),
}))
vi.mock('@/features/admin/hooks/usePlots', () => ({
  usePlots: () => ({
    data: [{ id: 'p-1', code: 'P-001', ranch: 'r-1' }],
    isLoading: false,
    isError: false,
  }),
}))
vi.mock('../hooks/useAspersionSessionHeaders', () => ({
  useAspersionSessionHeaders: () => ({ data: [], isLoading: false }),
}))
vi.mock('../hooks/usePhytoSessionHeaders', () => ({
  usePhytoSessionHeaders: () => ({ data: [], isLoading: false }),
}))
vi.mock('../hooks/useNdviSessionHeaders', () => ({
  useNdviSessionHeaders: () => ({ data: [], isLoading: false }),
}))
vi.mock('../hooks/useSoilMapSessionHeaders', () => ({
  useSoilMapSessionHeaders: () => ({ data: [], isLoading: false }),
}))

import { GeodataExplorer } from './GeodataExplorer'

const BASE_USER: AuthUser = {
  id: 'u1',
  username: 'tec',
  email: 't@t.com',
  role_name: 'Tecnico',
  role_level: 2,
  requires_password_change: false,
  datacentrals: [],
}

function conAlcance(orgs: number, datacentrals: number) {
  orgsMock.mockReturnValue({
    data: Array.from({ length: orgs }, (_, i) => ({
      id: `org-${i}`,
      name: `Organización ${i}`,
      datacentrals_count: '1',
    })),
    isLoading: false,
    error: null,
  })
  useAuthStore.setState({
    user: {
      ...BASE_USER,
      datacentrals: Array.from({ length: datacentrals }, (_, i) => ({
        id: i === 0 ? 'dc-1' : `dc-${i}`,
        name: i === 0 ? 'CIAgro Norte' : `CIAgro ${i}`,
        slug: `dc-${i}`,
        is_owner: false,
      })),
    },
  })
  render(<GeodataExplorer selection={null} onSelect={vi.fn()} />)
}

describe('GeodataExplorer — raíz según el alcance', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthStore.setState({ user: null })
  })

  it('con una sola CIAgro arranca en agrounidad, sin niveles por encima', async () => {
    conAlcance(1, 1)
    await waitFor(() => expect(screen.getByText('Agrounidad Uno')).toBeInTheDocument())
    // Ni organización ni CIAgro: ninguno ofrecía una elección.
    expect(screen.queryByText('Organización 0')).not.toBeInTheDocument()
    expect(screen.queryByText('CIAgro Norte')).not.toBeInTheDocument()
  })

  it('con una organización y varias CIAgros arranca en CIAgro hija', async () => {
    conAlcance(1, 3)
    await waitFor(() => expect(screen.getByText('CIAgro Norte')).toBeInTheDocument())
    expect(screen.queryByText('Organización 0')).not.toBeInTheDocument()
    // Y no baja de más: la agrounidad sigue detrás de su CIAgro.
    expect(screen.queryByText('Agrounidad Uno')).not.toBeInTheDocument()
  })

  it('con varias organizaciones se ven todos los niveles', async () => {
    conAlcance(2, 4)
    await waitFor(() => expect(screen.getByText('Organización 0')).toBeInTheDocument())
    expect(screen.getByText('Organización 1')).toBeInTheDocument()
    expect(screen.queryByText('Agrounidad Uno')).not.toBeInTheDocument()
  })

  it('la fila Dashboard está cuando la raíz colapsa', async () => {
    conAlcance(1, 1)
    await waitFor(() => expect(screen.getByText('Dashboard')).toBeInTheDocument())
  })

  it('sin colapso no hace falta la fila: el nodo de CIAgro ya es el retorno', async () => {
    conAlcance(2, 4)
    await waitFor(() => expect(screen.getByText('Organización 0')).toBeInTheDocument())
    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument()
  })

  it('la fila Dashboard selecciona el nivel de CIAgro, con su organización', async () => {
    // Los ancestros implícitos tienen que viajar: sin ellos el panel no sabría de qué
    // CIAgro mostrar los totales.
    const onSelect = vi.fn()
    orgsMock.mockReturnValue({
      data: [{ id: 'org-0', name: 'Organización 0', datacentrals_count: '1' }],
      isLoading: false,
      error: null,
    })
    useAuthStore.setState({
      user: {
        ...BASE_USER,
        datacentrals: [{ id: 'dc-1', name: 'CIAgro Norte', slug: 'dc-1', is_owner: false }],
      },
    })
    render(<GeodataExplorer selection={null} onSelect={onSelect} />)

    await waitFor(() => expect(screen.getByText('Dashboard')).toBeInTheDocument())
    screen.getByText('Dashboard').click()

    expect(onSelect).toHaveBeenCalledWith({
      level: 'datacentral',
      org: { id: 'org-0', name: 'Organización 0' },
      datacentral: { id: 'dc-1', name: 'CIAgro Norte' },
    })
  })
})
