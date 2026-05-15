import { type ReactNode } from 'react'
import { render, type RenderResult } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
  Outlet,
} from '@tanstack/react-router'
import type { FC } from 'react'

export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  })
}

export function renderWithQueryClient(ui: ReactNode): RenderResult {
  const queryClient = createTestQueryClient()
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
}

/**
 * Monta Component dentro de una ruta /_authenticated/w/$dc con dc='test-dc-id'.
 * Necesario para componentes que usan useParams({ from: '/_authenticated/w/$dc' }).
 */
export function renderInWorkspaceRoute(Component: FC, dc = 'test-dc-id'): RenderResult {
  const queryClient = createTestQueryClient()
  const rootRoute = createRootRoute({ component: Outlet })
  const authRoute = createRoute({ getParentRoute: () => rootRoute, id: '_authenticated', component: Outlet })
  const workspaceRoute = createRoute({
    getParentRoute: () => authRoute,
    path: '/w/$dc',
    component: Component,
  })
  const routeTree = rootRoute.addChildren([authRoute.addChildren([workspaceRoute])])
  const history = createMemoryHistory({ initialEntries: [`/w/${dc}`] })
  const router = createRouter({ routeTree, history })

  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
}

/** Monta Component dentro de un router mínimo en la ruta dada. */
export function renderInRouter(
  Component: FC,
  { path = '/', initialPath }: { path?: string; initialPath?: string } = {},
) {
  const queryClient = createTestQueryClient()
  const rootRoute = createRootRoute({ component: Outlet })
  const testRoute = createRoute({ getParentRoute: () => rootRoute, path, component: Component })
  const routeTree = rootRoute.addChildren([testRoute])
  const history = createMemoryHistory({ initialEntries: [initialPath ?? path] })
  const router = createRouter({ routeTree, history })

  return {
    ...render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    ),
    router,
  }
}
