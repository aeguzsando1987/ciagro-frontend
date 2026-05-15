import { createRoute, useParams } from '@tanstack/react-router'
import { workspaceDcRoute } from './w.$dc'
import { useAuthStore } from '@/features/auth/useAuthStore'
import { useWorkspaceStore } from '@/features/workspace/useWorkspaceStore'

export const workspaceDashboardRoute = createRoute({
  getParentRoute: () => workspaceDcRoute,
  path: '/dashboard',
  component: DashboardPage,
})

function DashboardPage() {
  const { dc } = useParams({ from: '/_authenticated/w/$dc/dashboard' })
  const user = useAuthStore((s) => s.user)
  const selectedDc = useWorkspaceStore((s) => s.selectedDc)

  const dcName =
    selectedDc?.id === dc
      ? selectedDc.name
      : (user?.datacentrals.find((d) => d.id === dc)?.name ?? dc.slice(0, 8))

  return (
    <div className="space-y-1">
      <h1 className="text-2xl font-semibold">
        Bienvenido, {user?.username ?? ''}
      </h1>
      <p className="text-muted-foreground">
        Workspace activo: <span className="font-medium text-foreground">{dcName}</span>
      </p>
    </div>
  )
}
