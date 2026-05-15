import { useEffect } from 'react'
import { createRoute, redirect, Outlet, useNavigate, useLocation } from '@tanstack/react-router'
import { rootRoute } from './__root'
import { tokens } from '@/lib/auth/tokens'
import { useCurrentUser } from '@/features/auth/useCurrentUser'

/**
 * Layout route autenticado (pathless).
 *
 * Dos capas de proteccion:
 * 1. beforeLoad (sincrono): sin access token → /login.
 * 2. Componente (reactivo): requires_password_change=true → /change-password.
 *    Se implementa en el componente porque requiere datos del servidor.
 */
export const authenticatedRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: '_authenticated',
  beforeLoad: () => {
    if (!tokens.getAccess()) {
      throw redirect({ to: '/login' })
    }
  },
  component: AuthenticatedLayout,
})

function AuthenticatedLayout() {
  const { data: user, isLoading } = useCurrentUser()
  const navigate = useNavigate()
  const { pathname } = useLocation()

  // Regla critica #4: requires_password_change bloquea todas las rutas hasta cambiar password.
  useEffect(() => {
    if (!isLoading && user?.requires_password_change && pathname !== '/change-password') {
      void navigate({ to: '/change-password' })
    }
  }, [user, isLoading, pathname, navigate])

  if (isLoading && !user) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <p className="text-muted-foreground">Cargando...</p>
      </div>
    )
  }

  return <Outlet />
}
