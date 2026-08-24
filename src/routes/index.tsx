import { createRoute, redirect } from '@tanstack/react-router'
import { rootRoute } from './__root'
import { tokens } from '@/lib/auth/tokens'

/**
 * Ruta índice `/`: redirige según estado de auth.
 * Con token activo → el Visor. Sin token → /login.
 *
 * Va al Visor y no a `/workspaces` porque el Visor es la pantalla principal del
 * producto. Las tres condiciones de entrada —una CIAgro, varias, o ninguna— las
 * resuelve el despachador de `/visor-datos`, no esta ruta.
 */
export const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: () => {
    if (tokens.getAccess()) {
      throw redirect({ to: '/visor-datos' })
    }
    throw redirect({ to: '/login' })
  },
})
