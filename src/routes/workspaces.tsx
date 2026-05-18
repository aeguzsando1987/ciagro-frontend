import { createRoute } from '@tanstack/react-router'
import { LogOut } from 'lucide-react'
import { authenticatedRoute } from './_authenticated'
import { WorkspaceSelector } from '@/features/workspace/WorkspaceSelector'
import { useLogout } from '@/features/auth/useLogout'
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
      <Button
        variant="ghost"
        size="sm"
        className="absolute right-8 top-8 gap-1.5 text-muted-foreground"
        onClick={() => logout()}
        disabled={isPending}
      >
        <LogOut className="h-4 w-4" />
        {isPending ? 'Cerrando sesión…' : 'Cerrar sesión'}
      </Button>
      <WorkspaceSelector />
    </div>
  )
}
