import { createRoute, Outlet } from '@tanstack/react-router'
import { authenticatedRoute } from './_authenticated'
import { AppHeader } from '@/features/workspace/AppHeader'
import { AppSidebar } from '@/features/workspace/AppSidebar'

export const workspaceDcRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/w/$dc',
  component: WorkspaceLayout,
})

function WorkspaceLayout() {
  return (
    <div className="flex h-dvh flex-col">
      <AppHeader />
      <div className="flex flex-1 overflow-hidden">
        <AppSidebar />
        <main className="flex-1 overflow-auto p-6 pb-9">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
