import { useEffect } from 'react'
import { createRoute, redirect, Outlet, useNavigate, useLocation } from '@tanstack/react-router'
import { rootRoute } from './__root'
import { tokens } from '@/lib/auth/tokens'
import { doRefresh } from '@/lib/api/client'
import { queryClient } from '@/lib/queryClient'
import { fetchCurrentUser, useCurrentUser } from '@/features/auth/useCurrentUser'
import { useAuthStore } from '@/features/auth/useAuthStore'

/**
 * Layout route autenticado (pathless).
 *
 * Dos capas de proteccion:
 * 1. beforeLoad (async): sin access token en memoria, intenta restaurar la sesion con
 *    el refresh token de localStorage (recarga de pagina / pestaña nueva). Solo si no
 *    hay refresh token o el refresh falla → /login.
 * 2. Componente (reactivo): requires_password_change=true → /change-password.
 *    Se implementa en el componente porque requiere datos del servidor.
 */
export const authenticatedRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: '_authenticated',
  beforeLoad: async () => {
    // 1. Asegurar access token (refresh-on-load para recargas / pestañas nuevas).
    if (!tokens.getAccess()) {
      if (!tokens.getRefresh()) throw redirect({ to: '/login' })
      try {
        await doRefresh()
      } catch {
        tokens.clear()
        throw redirect({ to: '/login' })
      }
    }
    // 2. Asegurar que useAuthStore.user esté poblado ANTES de que corran los guards
    //    sincronicos de los hijos (p.ej. task-manager comprueba role_level). En pestaña
    //    nueva el store está vacío hasta que useCurrentUser fetchea, demasiado tarde.
    if (!useAuthStore.getState().user) {
      try {
        const user = await fetchCurrentUser()
        useAuthStore.getState().setUser(user)
        queryClient.setQueryData(['me'], user) // evita refetch redundante en useCurrentUser
      } catch {
        tokens.clear()
        throw redirect({ to: '/login' })
      }
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
