import { Link } from '@tanstack/react-router'
import { Building2, BookOpen, MapPinned, Sprout, Users } from 'lucide-react'
import type { FC } from 'react'
import { cn } from '@/lib/utils'
import { ROLE_LEVELS } from '@/lib/auth/roles'

/** Una sección del panel /admin, con su ruta y el nivel de rol mínimo para verla. */
interface AdminSection {
  label: string
  icon: FC<{ className?: string }>
  minRole: number
  to: '/admin/organizaciones' | '/admin/usuarios' | '/admin/agrounidades' | '/admin/catalogos' | '/admin/activos'
}

/**
 * Secciones del panel de administración. El minRole decide la visibilidad;
 * el backend aplica el scope real de datos (regla crítica #7).
 */
export const ADMIN_SECTIONS: AdminSection[] = [
  { label: 'Organizaciones', icon: Building2, minRole: ROLE_LEVELS.SUPER_ADMIN, to: '/admin/organizaciones' },
  { label: 'Usuarios', icon: Users, minRole: ROLE_LEVELS.SUPER_ADMIN, to: '/admin/usuarios' },
  { label: 'Agrounidades', icon: Sprout, minRole: ROLE_LEVELS.SUPERVISOR, to: '/admin/agrounidades' },
  { label: 'Catálogos', icon: BookOpen, minRole: ROLE_LEVELS.SUPERVISOR, to: '/admin/catalogos' },
  { label: 'Activos Agrícolas', icon: MapPinned, minRole: ROLE_LEVELS.SUPER_ADMIN, to: '/admin/activos' },
]

const BASE = 'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors'

/** Sidebar del panel /admin. Muestra solo las secciones que el rol del usuario alcanza. */
export function AdminSidebar({ roleLevel }: { roleLevel: number }) {
  const visible = ADMIN_SECTIONS.filter((s) => roleLevel >= s.minRole)

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r bg-background">
      <nav className="flex flex-col gap-0.5 p-2">
        {visible.map((section) => {
          const Icon = section.icon
          return (
            <Link
              key={section.to}
              to={section.to}
              className={cn(BASE, 'hover:bg-accent')}
              activeProps={{ className: cn(BASE, 'bg-accent font-medium') }}
            >
              <Icon className="h-4 w-4" />
              {section.label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
