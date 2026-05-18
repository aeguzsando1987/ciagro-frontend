import { createRoute, Link } from '@tanstack/react-router'
import { LogOut, ShieldCheck } from 'lucide-react'
import { authenticatedRoute } from './_authenticated'
import { WorkspaceSelector } from '@/features/workspace/WorkspaceSelector'
import { useLogout } from '@/features/auth/useLogout'
import { useAuthStore } from '@/features/auth/useAuthStore'
import { ROLE_LEVELS } from '@/lib/auth/roles'
import { Button } from '@/components/ui/button'

/**
 * Ruta protegida /workspaces — selector de CIAgro (Pasos 1.3-1.6 product-doc).
 */
export const workspacesRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/workspaces',
  component: WorkspacesPage,
})

function WorkspacesPage() {
  const { mutate: logout, isPending } = useLogout()
  const roleLevel = useAuthStore((s) => s.user?.role_level ?? ROLE_LEVELS.GUEST)

  return (
    <div className="relative flex min-h-dvh items-center justify-center p-8">
      <div className="absolute left-8 top-8 flex flex-col items-start gap-1">
        <img
          src="/tierra_inteligente.svg"
          alt="Tierra Inteligente"
          className="w-56"
          draggable={false}
        />
        <span className="text-xs text-muted-foreground">CIAgro (ver. Alpha 1.0)</span>
      </div>
      <div className="absolute right-8 top-8 flex items-center gap-2">
        {/* El panel /admin es accesible desde Supervisor+; el backend gatea los datos. */}
        {roleLevel >= ROLE_LEVELS.SUPERVISOR && (
          <Button asChild variant="ghost" size="sm" className="gap-1.5">
            <Link to="/admin">
              <ShieldCheck className="h-4 w-4" />
              Administración
            </Link>
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-muted-foreground"
          onClick={() => logout()}
          disabled={isPending}
        >
          <LogOut className="h-4 w-4" />
          {isPending ? 'Cerrando sesión…' : 'Cerrar sesión'}
        </Button>
      </div>
      <WorkspaceSelector />
    </div>
  )
}
