import { Link, Navigate, Outlet } from '@tanstack/react-router'
import { LogOut } from 'lucide-react'
import { useAuthStore } from '@/features/auth/useAuthStore'
import { useLogout } from '@/features/auth/useLogout'
import { ROLE_LEVELS } from '@/lib/auth/roles'
import { Button } from '@/components/ui/button'
import { AdminSidebar } from './AdminSidebar'

/**
 * Layout del panel global de administración (/admin).
 *
 * Ruta hermana de /workspaces — no vive dentro de un workspace, por eso tiene
 * header y sidebar propios (no reutiliza AppHeader, que depende del param $dc).
 * Guard de rol en el componente (no en beforeLoad) porque el usuario se carga
 * de forma asíncrona en el layout _authenticated; en beforeLoad aún podría ser null.
 */
export function AdminLayout() {
  const user = useAuthStore((s) => s.user)
  const roleLevel = user?.role_level ?? ROLE_LEVELS.GUEST
  const { mutate: logout, isPending: isLoggingOut } = useLogout()

  // Mínimo Supervisor para entrar al panel; cada sección re-gatea por minRole.
  if (roleLevel < ROLE_LEVELS.SUPERVISOR) {
    return <Navigate to="/workspaces" />
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex h-14 shrink-0 items-center justify-between border-b bg-background px-4">
        <div className="flex items-center gap-3">
          <img src="/tierra_inteligente.svg" alt="Tierra Inteligente" className="h-7" draggable={false} />
          <span className="font-bold tracking-tight">CIAgro</span>
          <span className="text-muted-foreground">/</span>
          <span className="text-sm font-medium">Administración</span>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link to="/workspaces">Volver a workspaces</Link>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-muted-foreground"
            onClick={() => logout()}
            disabled={isLoggingOut}
          >
            <LogOut className="h-4 w-4" />
            {isLoggingOut ? 'Cerrando sesión…' : 'Cerrar sesión'}
          </Button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <AdminSidebar roleLevel={roleLevel} />
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
