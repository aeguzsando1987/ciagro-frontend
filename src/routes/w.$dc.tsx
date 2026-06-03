import { useEffect, useRef } from 'react'
import { createRoute, redirect, Outlet, useNavigate, useParams } from '@tanstack/react-router'
import { toast } from 'sonner'
import { authenticatedRoute } from './_authenticated'
import { useAuthStore } from '@/features/auth/useAuthStore'
import { AppHeader } from '@/features/workspace/AppHeader'
import { AppSidebar } from '@/features/workspace/AppSidebar'

/**
 * Layout de una CIAgra (workspace). Guard de acceso a la CIA:
 *   user.datacentrals (de /users/me/) ya excluye las CIAs de organizaciones inactivas.
 *   - beforeLoad: al cargar/navegar, si el dc no está entre las CIAs accesibles → /workspaces.
 *   - useEffect reactivo: si la org se desactiva DURANTE la sesión (al refrescar /me el
 *     store deja de incluir la CIA), expulsa al usuario "en caliente".
 */
export const workspaceDcRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/w/$dc',
  beforeLoad: ({ params }) => {
    const user = useAuthStore.getState().user
    // _authenticated.beforeLoad ya pobló el user; si por algún motivo no está, no
    // bloqueamos aquí (el guard de auth lo maneja).
    if (user && !user.datacentrals?.some((d) => d.id === params.dc)) {
      throw redirect({ to: '/workspaces' })
    }
  },
  component: WorkspaceLayout,
})

function WorkspaceLayout() {
  const { dc } = useParams({ from: '/_authenticated/w/$dc' })
  const user = useAuthStore((s) => s.user)
  const navigate = useNavigate()
  const warned = useRef(false)

  // Expulsión en caliente: si la CIA deja de estar accesible (org desactivada → /me la
  // excluye al refrescar), salir al selector con un aviso.
  useEffect(() => {
    if (user && !user.datacentrals?.some((d) => d.id === dc)) {
      if (!warned.current) {
        warned.current = true
        toast.warning('Esta organización ya no está disponible.')
      }
      void navigate({ to: '/workspaces' })
    }
  }, [user, dc, navigate])

  return (
    <div className="flex h-dvh flex-col">
      <AppHeader />
      <div className="flex flex-1 overflow-hidden">
        <AppSidebar />
        <main className="flex-1 overflow-auto p-6 pb-9">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
