import { useState } from 'react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { usePendingUsers, useActivateUser } from '../hooks/usePendingUsers'
import { useUserRoles } from '../hooks/useUserCatalogs'

interface ActivateUserDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Activación de usuarios pendientes (auto-registrados sin rol).
 * Por cada pendiente se elige un rol de acceso y se confirma; el backend
 * (PATCH /users/{id}/activate/) le asigna el rol y lo pasa a status=active.
 */
export function ActivateUserDialog({ open, onOpenChange }: ActivateUserDialogProps) {
  const { data: pending = [], isLoading } = usePendingUsers()
  const { data: roles = [] } = useUserRoles()
  const activate = useActivateUser()
  // Rol elegido por cada usuario pendiente, indexado por su id.
  const [roleByUser, setRoleByUser] = useState<Record<string, string>>({})

  function handleActivate(userId: string) {
    const roleId = roleByUser[userId]
    if (!roleId) {
      toast.error('Selecciona un rol antes de activar.')
      return
    }
    activate.mutate(
      { userId, userRoleId: Number(roleId) },
      {
        onSuccess: () => toast.success('El usuario se activó correctamente.'),
        onError: (err) => toast.error(err.message),
      }
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Usuarios pendientes de activación</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Cargando…</p>
        ) : pending.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay usuarios pendientes.</p>
        ) : (
          <ul className="divide-y">
            {pending.map((u) => (
              <li key={u.id} className="flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{u.username}</p>
                  <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                </div>
                <Select
                  value={roleByUser[u.id]}
                  onValueChange={(v) => setRoleByUser((prev) => ({ ...prev, [u.id]: v }))}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Rol" />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((r) => (
                      <SelectItem key={r.id} value={String(r.id)}>
                        {r.role_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  disabled={activate.isPending}
                  onClick={() => handleActivate(u.id)}
                >
                  Activar
                </Button>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  )
}
