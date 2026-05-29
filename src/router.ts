import { createRouter } from '@tanstack/react-router'
import { rootRoute } from './routes/__root'
import { indexRoute } from './routes/index'
import { loginRoute } from './routes/login'
import { authenticatedRoute } from './routes/_authenticated'
import { workspacesRoute } from './routes/workspaces'
import { visorDatosRoute } from './routes/visor-datos'
import { changePasswordRoute } from './routes/change-password'
import { workspaceDcRoute } from './routes/w.$dc'
import { workspaceDashboardRoute } from './routes/w.$dc.dashboard'
import { workspaceTaskManagerRoute } from './routes/w.$dc.task-manager'
import {
  adminRoute,
  adminIndexRoute,
  adminUsersRoute,
  adminOrganizationsRoute,
  adminAgroUnitsRoute,
  adminCatalogsRoute,
  adminAssetsRoute,
} from './routes/admin'

/**
 * Arbol de rutas de la aplicacion.
 * Sprint 1.A + 1.B: auth + workspace selector + dashboard.
 * Sprint 2.A: + task-manager (Gantt).
 * Modulo admin: + panel global /admin (hermano de /workspaces).
 */
const routeTree = rootRoute.addChildren([
  indexRoute,
  loginRoute,
  authenticatedRoute.addChildren([
    workspacesRoute,
    visorDatosRoute,
    changePasswordRoute,
    adminRoute.addChildren([
      adminIndexRoute,
      adminUsersRoute,
      adminOrganizationsRoute,
      adminAgroUnitsRoute,
      adminCatalogsRoute,
      adminAssetsRoute,
    ]),
    workspaceDcRoute.addChildren([workspaceDashboardRoute, workspaceTaskManagerRoute]),
  ]),
])

export const router = createRouter({ routeTree })

// Registro de tipos global: habilita type-safety en useNavigate, Link,
// useParams y useSearch en toda la app (regla 2.3 TS strict).
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
