import { Link, useParams } from '@tanstack/react-router'
import { BarChart3, BookOpen, ClipboardList, GanttChart, LayoutDashboard, Map, ShieldCheck } from 'lucide-react'
import type { FC } from 'react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/features/auth/useAuthStore'
import { ROLE_LEVELS } from '@/lib/auth/roles'

type NavRoute = '/w/$dc/dashboard' | '/w/$dc/task-manager' | '/admin'

interface NavModule {
  label: string
  icon: FC<{ className?: string }>
  minRole: number
  implemented: boolean
  to?: NavRoute
}

const NAV_MODULES: NavModule[] = [
  { label: 'Dashboard', icon: LayoutDashboard, minRole: ROLE_LEVELS.GUEST, implemented: true, to: '/w/$dc/dashboard' },
  { label: 'Programas', icon: GanttChart, minRole: ROLE_LEVELS.SUPERVISOR, implemented: true, to: '/w/$dc/task-manager' },
  { label: 'Sesiones', icon: ClipboardList, minRole: ROLE_LEVELS.TECHNICIAN, implemented: false },
  { label: 'Mapa', icon: Map, minRole: ROLE_LEVELS.TECHNICIAN, implemented: false },
  { label: 'Central de datos', icon: BarChart3, minRole: ROLE_LEVELS.MANAGER, implemented: false },
  { label: 'Catalogos', icon: BookOpen, minRole: ROLE_LEVELS.MANAGER, implemented: false },
  { label: 'Administracion', icon: ShieldCheck, minRole: ROLE_LEVELS.SUPERVISOR, implemented: true, to: '/admin' },
]

const BASE = 'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors'

export function AppSidebar() {
  const { dc } = useParams({ from: '/_authenticated/w/$dc' })
  const roleLevel = useAuthStore((s) => s.user?.role_level ?? ROLE_LEVELS.GUEST)

  const visible = NAV_MODULES.filter((m) => roleLevel >= m.minRole)

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r bg-background">
      <nav className="flex flex-col gap-0.5 p-2">
        {visible.map((mod) => {
          const Icon = mod.icon

          if (!mod.implemented) {
            return (
              <div
                key={mod.label}
                className={cn(BASE, 'cursor-not-allowed text-muted-foreground opacity-50')}
              >
                <Icon className="h-4 w-4" />
                {mod.label}
              </div>
            )
          }

          // /admin es ruta global: no recibe el param $dc, a diferencia de las rutas de workspace.
          if (mod.to === '/admin') {
            return (
              <Link
                key={mod.label}
                to="/admin"
                className={cn(BASE, 'hover:bg-accent')}
                activeProps={{ className: cn(BASE, 'bg-accent font-medium') }}
              >
                <Icon className="h-4 w-4" />
                {mod.label}
              </Link>
            )
          }

          return (
            <Link
              key={mod.label}
              to={mod.to!}
              params={{ dc }}
              activeOptions={{ exact: true }}
              className={cn(BASE, 'hover:bg-accent')}
              activeProps={{ className: cn(BASE, 'bg-accent font-medium') }}
            >
              <Icon className="h-4 w-4" />
              {mod.label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
