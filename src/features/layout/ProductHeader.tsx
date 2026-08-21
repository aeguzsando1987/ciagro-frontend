import { useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { Building2, ChevronDown, LogOut, Map, Menu, Settings, UserRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAuthStore } from '@/features/auth/useAuthStore'
import { useLogout } from '@/features/auth/useLogout'
import { ProfileModal } from '@/features/workspace/ProfileModal'
import { AnimatedAgroindustryLogo } from '@/features/auth/AnimatedAgroindustryLogo'
import { ROLE_LEVELS } from '@/lib/auth/roles'

interface ProductHeaderProps {
  contextLabel: string
  currentDcId?: string
  onOpenNavigation: () => void
}

function initials(username?: string) {
  return username?.trim().slice(0, 2).toUpperCase() || 'CI'
}

/** Header global de CIAgro: marca, contexto, módulos principales y cuenta. */
export function ProductHeader({ contextLabel, currentDcId, onOpenNavigation }: ProductHeaderProps) {
  const user = useAuthStore((state) => state.user)
  const { mutate: logout, isPending: isLoggingOut } = useLogout()
  const navigate = useNavigate()
  const [showProfile, setShowProfile] = useState(false)
  const canManage = (user?.role_level ?? 0) >= ROLE_LEVELS.SUPERVISOR

  const brand = (
    <span className="flex min-w-0 items-center gap-3">
      <AnimatedAgroindustryLogo
        className="w-[118px] sm:w-[132px]"
        gearClassName="cia-header-gear"
      />
      <span className="hidden text-lg font-semibold tracking-tight text-foreground md:inline">
        CIAgro
      </span>
    </span>
  )

  return (
    <>
      <header className="flex h-16 shrink-0 items-center border-b border-default bg-surface px-3 sm:px-4 lg:px-6">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="mr-2 lg:hidden"
          onClick={onOpenNavigation}
          aria-label="Abrir navegación"
        >
          <Menu />
        </Button>

        {currentDcId ? (
          <Link to="/w/$dc/visor" params={{ dc: currentDcId }} className="shrink-0">
            {brand}
          </Link>
        ) : (
          <Link to="/workspaces" className="shrink-0">
            {brand}
          </Link>
        )}

        <div className="mx-3 hidden h-6 w-px bg-border-light sm:block" aria-hidden="true" />

        <Button
          asChild
          variant="ghost"
          size="sm"
          className="hidden min-w-0 max-w-[260px] justify-start px-2 sm:inline-flex"
        >
          <Link to="/workspaces" title={`Cambiar contexto: ${contextLabel}`}>
            <Building2 className="text-muted" />
            <span className="truncate">{contextLabel}</span>
            <ChevronDown className="text-muted" />
          </Link>
        </Button>

        <div className="ml-auto flex items-center gap-1.5">
          {canManage && (
            <nav aria-label="Accesos principales" className="hidden items-center gap-1 lg:flex">
              <Button asChild variant="ghost" size="sm">
                <Link
                  to="/visor-datos"
                  activeProps={{ className: 'bg-primary-soft text-primary-hover' }}
                >
                  <Map />
                  Visor
                </Link>
              </Button>
              <Button asChild variant="ghost" size="sm">
                <Link
                  to="/admin"
                  activeOptions={{ exact: false }}
                  activeProps={{ className: 'bg-primary-soft text-primary-hover' }}
                >
                  <Settings />
                  Administración
                </Link>
              </Button>
            </nav>
          )}

          <div className="mx-1 hidden h-6 w-px bg-border-light lg:block" aria-hidden="true" />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-10 gap-2 px-1.5 sm:px-2"
                aria-label="Abrir menú de cuenta"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-soft text-xs font-semibold text-primary-hover">
                  {initials(user?.username)}
                </span>
                <span className="hidden max-w-32 truncate text-sm font-medium xl:inline">
                  {user?.username ?? 'Usuario'}
                </span>
                <ChevronDown className="hidden text-muted xl:block" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel className="normal-case tracking-normal">
                <span className="block truncate text-sm font-semibold text-foreground">
                  {user?.username ?? 'Usuario'}
                </span>
                <span className="mt-0.5 block truncate text-xs font-normal text-muted">
                  {user?.email || user?.role_name}
                </span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setShowProfile(true)}>
                <UserRound />
                Editar perfil
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void navigate({ to: '/workspaces' })}>
                <Building2 />
                Cambiar organización
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => logout()}
                disabled={isLoggingOut}
                className="text-danger-foreground focus:bg-danger-soft focus:text-danger-foreground"
              >
                <LogOut />
                {isLoggingOut ? 'Cerrando sesión…' : 'Cerrar sesión'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {showProfile && <ProfileModal onClose={() => setShowProfile(false)} />}
    </>
  )
}
