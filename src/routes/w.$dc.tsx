import { useEffect, useRef } from 'react'
import {
  createRoute,
  redirect,
  Outlet,
  useMatchRoute,
  useNavigate,
  useParams,
} from '@tanstack/react-router'
import { toast } from 'sonner'
import { authenticatedRoute } from './_authenticated'
import { useAuthStore } from '@/features/auth/useAuthStore'
import { ProductShell } from '@/features/layout/ProductShell'
import { useWorkspaceStore } from '@/features/workspace/useWorkspaceStore'

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
  const selectedDc = useWorkspaceStore((s) => s.selectedDc)
  const navigate = useNavigate()
  const matchRoute = useMatchRoute()
  const enVisor = !!matchRoute({ to: '/w/$dc/visor', fuzzy: true })
  const warned = useRef(false)
  const dcName =
    selectedDc?.id === dc
      ? selectedDc.name
      : (user?.datacentrals.find((item) => item.id === dc)?.name ?? 'Organización activa')

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
    <ProductShell
      contextLabel={dcName}
      currentDcId={dc}
      // El Visor es una interfaz de mapa: ocupa todo el espacio disponible, sin el
      // margen del resto de pantallas y sin scroll propio. Con el margen y el
      // `overflow-auto` por defecto aparecia una barra de desplazamiento que dejaba
      // ver el borde inferior del visor, que no deberia poder moverse.
      mainClassName={enVisor ? 'overflow-hidden p-0 pb-0 sm:p-0 lg:p-0' : undefined}
    >
      <Outlet />
    </ProductShell>
  )
}
