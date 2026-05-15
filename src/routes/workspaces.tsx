import { createRoute } from '@tanstack/react-router'
import { authenticatedRoute } from './_authenticated'
import { WorkspaceSelector } from '@/features/workspace/WorkspaceSelector'

/**
 * Ruta protegida /workspaces — selector de CIAgro (Pasos 1.3-1.6 product-doc).
 */
export const workspacesRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/workspaces',
  component: WorkspacesPage,
})

function WorkspacesPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center p-8">
      <WorkspaceSelector />
    </div>
  )
}
