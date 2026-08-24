import { useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { Building2, ChevronDown, LogOut, Menu, UserRound } from 'lucide-react'
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

interface ProductHeaderProps {
  /** Indicador de CIAgro activa. Sin el, no se pinta. */
  contextLabel?: string
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
          className="mr-2"
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

        {/* Indicador de CIAgro activa: solo donde el trabajo es DE una CIAgro
            concreta, o sea el Task Manager. En el Visor sobra, porque el propio
            explorador y sus migas de pan dicen a cada momento donde esta el usuario, y
            repetirlo arriba era ruido. */}
        {contextLabel && (
          <>
            <div className="mx-3 hidden h-6 w-px bg-border-light sm:block" aria-hidden="true" />
            <span
              className="hidden min-w-0 max-w-[260px] items-center gap-2 px-2 text-sm text-secondary sm:inline-flex"
              title={contextLabel}
            >
              <Building2 className="h-4 w-4 shrink-0 text-muted" />
              <span className="truncate">{contextLabel}</span>
            </span>
          </>
        )}

        <div className="ml-auto flex items-center gap-1.5">
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
