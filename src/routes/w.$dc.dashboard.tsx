import { createRoute, redirect } from '@tanstack/react-router'
import { workspaceDcRoute } from './w.$dc'

/**
 * `/w/$dc/dashboard` — redirección al Visor.
 *
 * El foco de una CIAgro pasó a ser el Visor de Datos Agrícolas: al entrar se ve
 * directamente el explorador con el panel de la CIAgro, en vez de una pantalla de
 * bienvenida intermedia que no llevaba a ninguna parte.
 *
 * La ruta se conserva en lugar de borrarse para que los enlaces guardados, los
 * marcadores del navegador y cualquier redirección antigua sigan funcionando.
 */
export const workspaceDashboardRoute = createRoute({
  getParentRoute: () => workspaceDcRoute,
  path: '/dashboard',
  beforeLoad: ({ params }) => {
    throw redirect({ to: '/w/$dc/visor', params: { dc: params.dc } })
  },
})
