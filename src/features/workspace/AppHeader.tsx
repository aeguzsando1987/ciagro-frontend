import { useNavigate, useParams } from '@tanstack/react-router'
import { Building2, ChevronDown, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAuthStore } from '@/features/auth/useAuthStore'
import { useLogout } from '@/features/auth/useLogout'
import { useWorkspaceStore } from './useWorkspaceStore'

export function AppHeader() {
  const { dc } = useParams({ from: '/_authenticated/w/$dc' })
  const user = useAuthStore((s) => s.user)
  const selectedDc = useWorkspaceStore((s) => s.selectedDc)
  const { mutate: logout, isPending: isLoggingOut } = useLogout()
  const navigate = useNavigate()

  // DC name: prefer workspace store (set al navegar desde selector),
  // fallback a user.datacentrals (disponible para rol < 4),
  // ultimo recurso: primeros 8 chars del UUID del param.
  const dcName =
    selectedDc?.id === dc
      ? selectedDc.name
      : (user?.datacentrals.find((d) => d.id === dc)?.name ?? dc.slice(0, 8))

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b bg-background px-4">
      <div className="flex items-center gap-3">
        <span className="font-bold tracking-tight">CIAgro</span>
        <span className="text-muted-foreground">/</span>
        <div className="flex items-center gap-1.5 text-sm font-medium">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          {dcName}
        </div>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-1.5">
            {user?.username ?? '...'}
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onSelect={() => void navigate({ to: '/workspaces' })}>
            Cambiar workspace
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => logout()}
            disabled={isLoggingOut}
            className="text-destructive focus:text-destructive"
          >
            <LogOut className="mr-2 h-4 w-4" />
            {isLoggingOut ? 'Cerrando sesion...' : 'Cerrar sesion'}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}
