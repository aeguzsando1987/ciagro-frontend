import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, it, expect } from 'vitest'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
  RouterProvider,
  Outlet,
} from '@tanstack/react-router'
import { tokens } from '@/lib/auth/tokens'

// Router mínimo que replica el guard de token de _authenticated.tsx
// sin importar el componente real (evita cascada de dependencias de useCurrentUser).
function buildGuardedRouter(initialPath: string) {
  const rootRoute = createRootRoute({ component: Outlet })

  const loginRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/login',
    component: () => <div>Login</div>,
  })

  const authRoute = createRoute({
    getParentRoute: () => rootRoute,
    id: '_authenticated',
    beforeLoad: () => {
      if (!tokens.getAccess()) throw redirect({ to: '/login' })
    },
    component: Outlet,
  })

  const workspacesRoute = createRoute({
    getParentRoute: () => authRoute,
    path: '/workspaces',
    component: () => <div>Workspaces</div>,
  })

  const routeTree = rootRoute.addChildren([loginRoute, authRoute.addChildren([workspacesRoute])])
  const history = createMemoryHistory({ initialEntries: [initialPath] })
  return createRouter({ routeTree, history })
}

describe('_authenticated guard (beforeLoad)', () => {
  afterEach(() => {
    tokens.clear()
  })

  it('redirects to /login when no access token', async () => {
    const router = buildGuardedRouter('/workspaces')
    render(<RouterProvider router={router} />)

    await waitFor(() => {
      expect(screen.getByText('Login')).toBeInTheDocument()
    })
  })

  it('shows protected content when access token is present', async () => {
    tokens.setAccess('valid-test-token')
    const router = buildGuardedRouter('/workspaces')
    render(<RouterProvider router={router} />)

    await waitFor(() => {
      expect(screen.getByText('Workspaces')).toBeInTheDocument()
    })
  })
})

// El guard requires_password_change (useEffect en AuthenticatedLayout) se verifica
// en el test E2E flow-1-required-password-change.spec.ts (requiere GAP-BACKEND-001).
