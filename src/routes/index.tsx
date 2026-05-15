import { createRoute, redirect } from '@tanstack/react-router'
import { rootRoute } from './__root'
import { tokens } from '@/lib/auth/tokens'

/**
 * Ruta índice /: redirige según estado de auth.
 * Con token activo → /workspaces. Sin token → /login.
 */
export const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: () => {
    if (tokens.getAccess()) {
      throw redirect({ to: '/workspaces' })
    }
    throw redirect({ to: '/login' })
  },
})
