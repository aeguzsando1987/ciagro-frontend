import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect } from 'vitest'
import { QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
  Outlet,
} from '@tanstack/react-router'
import { render } from '@testing-library/react'
import { z } from 'zod'
import { FilterBar } from './FilterBar'
import { createTestQueryClient } from '@/test/test-utils'

/**
 * Monta FilterBar dentro de un router con la misma estructura de path/search
 * que la ruta real /w/$dc/task-manager para que useParams + useSearch funcionen.
 */
function renderFilterBar(initialSearch = '') {
  const queryClient = createTestQueryClient()
  const rootRoute = createRootRoute({ component: Outlet })
  const authRoute = createRoute({ getParentRoute: () => rootRoute, id: '_authenticated', component: Outlet })
  const workspaceRoute = createRoute({
    getParentRoute: () => authRoute,
    path: '/w/$dc',
    component: Outlet,
  })
  const tmRoute = createRoute({
    getParentRoute: () => workspaceRoute,
    path: '/task-manager',
    validateSearch: z.object({
      status: z.string().optional().catch(undefined),
      agro_unit: z.string().optional().catch(undefined),
    }),
    component: FilterBar,
  })
  const routeTree = rootRoute.addChildren([
    authRoute.addChildren([workspaceRoute.addChildren([tmRoute])]),
  ])
  const history = createMemoryHistory({
    initialEntries: [`/w/test-dc/task-manager${initialSearch}`],
  })
  const router = createRouter({ routeTree, history })

  const utils = render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
  return { ...utils, router }
}

describe('FilterBar', () => {
  it('renderiza el select de Estado con "Todos" + los 5 status del backend', async () => {
    renderFilterBar()
    await waitFor(() => screen.getByLabelText('Estado'))

    const select = screen.getByLabelText('Estado') as HTMLSelectElement
    const optionLabels = Array.from(select.options).map((o) => o.textContent)

    expect(optionLabels).toEqual([
      'Todos',
      'Pendiente',
      'En progreso',
      'Cargado',
      'Completado',
      'Cancelado',
    ])
  })

  it('al cambiar el estado, actualiza el search param status en la URL', async () => {
    const user = userEvent.setup()
    const { router } = renderFilterBar()
    await waitFor(() => screen.getByLabelText('Estado'))

    await user.selectOptions(screen.getByLabelText('Estado'), 'in_progress')

    await waitFor(() => {
      expect(router.state.location.search).toMatchObject({ status: 'in_progress' })
    })
  })

  it('muestra el boton "Limpiar filtros" solo cuando hay filtros activos', async () => {
    const user = userEvent.setup()
    renderFilterBar()
    await waitFor(() => screen.getByLabelText('Estado'))

    // Sin filtros: no se ve el boton.
    expect(screen.queryByText('Limpiar filtros')).not.toBeInTheDocument()

    // Aplicar un filtro -> aparece el boton.
    await user.selectOptions(screen.getByLabelText('Estado'), 'pending')
    await waitFor(() => screen.getByText('Limpiar filtros'))

    // Click en limpiar -> desaparece.
    await user.click(screen.getByText('Limpiar filtros'))
    await waitFor(() => {
      expect(screen.queryByText('Limpiar filtros')).not.toBeInTheDocument()
    })
  })

  it('no renderiza el filtro de Productor si no se pasan agroUnits', async () => {
    renderFilterBar()
    await waitFor(() => screen.getByLabelText('Estado'))

    expect(screen.queryByLabelText('Productor')).not.toBeInTheDocument()
  })
})
