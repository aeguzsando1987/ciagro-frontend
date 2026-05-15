import { useAuthStore } from '@/features/auth/useAuthStore'
import { ROLE_LEVELS } from '@/lib/auth/roles'
import { Button } from '@/components/ui/button'
import type { ProgramaStatus } from '@/features/task-manager/types'

const STATUS_LABELS: Record<ProgramaStatus, string> = {
  pending: 'Pendiente',
  in_progress: 'En progreso',
  loaded: 'Cargado',
  completed: 'Completado',
  cancelled: 'Cancelado',
}

/** Transiciones válidas por status actual, sin restricción de rol. */
const TRANSITIONS: Record<ProgramaStatus, ProgramaStatus[]> = {
  pending: ['in_progress'],
  in_progress: ['pending', 'loaded'],
  loaded: ['in_progress', 'completed', 'cancelled'],
  completed: [],
  cancelled: [],
}

/** Statuses que solo puede asignar un MANAGER (level >= 4). */
const MANAGER_ONLY: ProgramaStatus[] = ['completed', 'cancelled']

interface StatusChangerProps {
  currentStatus: ProgramaStatus
  onChangeStatus: (newStatus: ProgramaStatus) => void
  isLoading?: boolean
}

export function StatusChanger({ currentStatus, onChangeStatus, isLoading }: StatusChangerProps) {
  const roleLevel = useAuthStore((s) => s.user?.role_level ?? ROLE_LEVELS.GUEST)
  const isManager = roleLevel >= ROLE_LEVELS.MANAGER

  const available = TRANSITIONS[currentStatus].filter(
    (s) => !MANAGER_ONLY.includes(s) || isManager
  )

  if (available.length === 0) return null

  return (
    <div className="flex flex-wrap gap-2">
      <span className="self-center text-xs text-muted-foreground">Cambiar a:</span>
      {available.map((s) => (
        <Button
          key={s}
          size="sm"
          variant="outline"
          disabled={isLoading}
          onClick={() => onChangeStatus(s)}
        >
          {STATUS_LABELS[s]}
        </Button>
      ))}
    </div>
  )
}
