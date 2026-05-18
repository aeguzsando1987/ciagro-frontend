import { createRoute } from '@tanstack/react-router'
import { authenticatedRoute } from './_authenticated'
import { AdminLayout } from '@/features/admin/AdminLayout'
import { UsersSection } from '@/features/admin/sections/UsersSection'
import { OrganizationsSection } from '@/features/admin/sections/OrganizationsSection'
import { AgroUnitsSection } from '@/features/admin/sections/AgroUnitsSection'
import { CatalogsSection } from '@/features/admin/sections/CatalogsSection'
import { AssetsSection } from '@/features/admin/sections/AssetsSection'

/**
 * Panel global de administración (caso de uso admin_control_usecases.md §1-§7).
 *
 * Ruta /admin hermana de /workspaces — fuera de cualquier workspace, porque crear
 * organizaciones o usuarios no pertenece a un workspace concreto. Las 5 secciones
 * son rutas hijas (deep-linkables, type-safe). El guard de rol vive en AdminLayout.
 */
export const adminRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/admin',
  component: AdminLayout,
})

/** Índice de /admin: bienvenida. No redirige a una sección porque el destino dependería del rol. */
export const adminIndexRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: '/',
  component: AdminHome,
})

export const adminUsersRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: '/usuarios',
  component: UsersSection,
})

export const adminOrganizationsRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: '/organizaciones',
  component: OrganizationsSection,
})

export const adminAgroUnitsRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: '/agrounidades',
  component: AgroUnitsSection,
})

export const adminCatalogsRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: '/catalogos',
  component: CatalogsSection,
})

export const adminAssetsRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: '/activos',
  component: AssetsSection,
})

function AdminHome() {
  return (
    <div className="space-y-1">
      <h1 className="text-2xl font-semibold">Panel de administración</h1>
      <p className="text-muted-foreground">
        Selecciona una sección en el menú lateral para comenzar.
      </p>
    </div>
  )
}
