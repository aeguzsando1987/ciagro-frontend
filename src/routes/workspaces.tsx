import { createRoute } from '@tanstack/react-router'
import { authenticatedRoute } from './_authenticated'
import { WorkspaceSelector } from '@/features/workspace/WorkspaceSelector'
import { ProductShell } from '@/features/layout/ProductShell'

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
    <ProductShell contextLabel="Selecciona una organización">
      <div className="mx-auto w-full max-w-6xl py-3 sm:py-5">
        <WorkspaceSelector />
      </div>
    </ProductShell>
  )
}
