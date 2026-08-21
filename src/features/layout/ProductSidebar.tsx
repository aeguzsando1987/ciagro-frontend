import { Link } from '@tanstack/react-router'
import {
  BookOpen,
  Building2,
  CalendarClock,
  LayoutDashboard,
  Map,
  MapPinned,
  SlidersHorizontal,
  Sprout,
  Users,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ROLE_LEVELS } from '@/lib/auth/roles'

interface ProductSidebarProps {
  roleLevel: number
  currentDcId?: string
  className?: string
  onNavigate?: () => void
}

const navItemClass =
  'flex min-h-10 items-center gap-3 rounded-lg px-3 py-2 text-sm text-secondary transition-colors duration-150 hover:bg-surface-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20'

const activeNavItem = 'bg-primary-soft font-medium text-primary-hover'

function NavGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="space-y-1.5">
      <h2 className="px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
        {label}
      </h2>
      <div className="space-y-0.5">{children}</div>
    </section>
  )
}

/** Navegación principal única de CIAgro. El backend mantiene el scope real de datos. */
export function ProductSidebar({
  roleLevel,
  currentDcId,
  className,
  onNavigate,
}: ProductSidebarProps) {
  const canManage = roleLevel >= ROLE_LEVELS.SUPERVISOR
  const canManageOrganizations = roleLevel >= ROLE_LEVELS.MANAGER
  const canManageUsersAndAssets = roleLevel >= ROLE_LEVELS.SUPER_ADMIN
  const canConfigureVariables = roleLevel >= ROLE_LEVELS.MANAGER

  return (
    <aside
      className={cn('flex w-64 shrink-0 flex-col border-r border-default bg-surface', className)}
    >
      <nav aria-label="Navegación principal" className="flex-1 space-y-6 overflow-y-auto p-3 py-5">
        <NavGroup label="General">
          {/* El Visor es la pantalla principal de una CIAgro: ya no hay un item
              "Dashboard" aparte, porque apuntaba a una pantalla intermedia que ahora
              solo redirige aquí. El panel de la CIAgro es el nivel raíz del Visor. */}
          {currentDcId ? (
            <Link
              to="/w/$dc/visor"
              params={{ dc: currentDcId }}
              className={navItemClass}
              activeProps={{ className: activeNavItem }}
              onClick={onNavigate}
            >
              <Map className="h-[18px] w-[18px]" />
              Visor agrícola
            </Link>
          ) : (
            <Link
              to="/workspaces"
              className={navItemClass}
              activeProps={{ className: activeNavItem }}
              onClick={onNavigate}
            >
              <LayoutDashboard className="h-[18px] w-[18px]" />
              Panel general
            </Link>
          )}


          {currentDcId && canManage && (
            <Link
              to="/w/$dc/task-manager"
              params={{ dc: currentDcId }}
              className={navItemClass}
              activeProps={{ className: activeNavItem }}
              onClick={onNavigate}
            >
              <CalendarClock className="h-[18px] w-[18px]" />
              Task Manager
            </Link>
          )}
        </NavGroup>

        {canManage && (
          <NavGroup label="Gestión">
            {canManageOrganizations && (
              <Link
                to="/admin/organizaciones"
                className={navItemClass}
                activeProps={{ className: activeNavItem }}
                onClick={onNavigate}
              >
                <Building2 className="h-[18px] w-[18px]" />
                Organizaciones
              </Link>
            )}

            {canManageUsersAndAssets && (
              <Link
                to="/admin/usuarios"
                className={navItemClass}
                activeProps={{ className: activeNavItem }}
                onClick={onNavigate}
              >
                <Users className="h-[18px] w-[18px]" />
                Usuarios
              </Link>
            )}

            <Link
              to="/admin/agrounidades"
              className={navItemClass}
              activeProps={{ className: activeNavItem }}
              onClick={onNavigate}
            >
              <Sprout className="h-[18px] w-[18px]" />
              Agrounidades
            </Link>

            {canManageUsersAndAssets && (
              <Link
                to="/admin/activos"
                className={navItemClass}
                activeProps={{ className: activeNavItem }}
                onClick={onNavigate}
              >
                <MapPinned className="h-[18px] w-[18px]" />
                Activos agrícolas
              </Link>
            )}
          </NavGroup>
        )}

        {canManage && (
          <NavGroup label="Configuración">
            <Link
              to="/admin/catalogos"
              className={navItemClass}
              activeProps={{ className: activeNavItem }}
              onClick={onNavigate}
            >
              <BookOpen className="h-[18px] w-[18px]" />
              Catálogos
            </Link>

            {canConfigureVariables && (
              <Link
                to="/admin/config-variables"
                className={navItemClass}
                activeProps={{ className: activeNavItem }}
                onClick={onNavigate}
              >
                <SlidersHorizontal className="h-[18px] w-[18px]" />
                Variables
              </Link>
            )}
          </NavGroup>
        )}
      </nav>
    </aside>
  )
}
