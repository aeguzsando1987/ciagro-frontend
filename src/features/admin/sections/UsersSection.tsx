import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useUsers, useDeleteUser } from '../hooks/useUsers'
import { CreateUserDialog } from '../dialogs/CreateUserDialog'
import { ActivateUserDialog } from '../dialogs/ActivateUserDialog'
import { UserModal } from '../panel/UserModal'
import type { UserStatus } from '../types'

const STATUS_LABELS: Record<UserStatus, string> = {
  active: 'Activo',
  disabled: 'Desactivado',
  pending_activation: 'Pendiente',
}

/** Sección Usuarios del panel /admin — caso de uso §2. */
export function UsersSection() {
  const { data: users = [], isLoading, error } = useUsers()
  const deleteUser = useDeleteUser()
  const [createOpen, setCreateOpen] = useState(false)
  const [activateOpen, setActivateOpen] = useState(false)
  // Se guarda el id (no el objeto): así el modal lee siempre la fila viva de la
  // lista y refleja los cambios tras editar, sin snapshot obsoleto.
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const selectedUser = users.find((u) => u.id === selectedUserId) ?? null

  function handleDelete(e: React.MouseEvent, userId: string, username: string) {
    e.stopPropagation()
    if (!window.confirm(`¿Eliminar al usuario "${username}"?`)) return
    deleteUser.mutate(userId, {
      onSuccess: () => toast.success('El usuario se eliminó correctamente.'),
      onError: (err) => toast.error(err.message),
    })
  }

  return (
    <div className="space-y-4">
      <header className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Usuarios</h1>
          <p className="text-sm text-muted-foreground">
            Alta, edición y activación de usuarios del sistema.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setActivateOpen(true)}>
            Pendientes de activación
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            + Nuevo Usuario
          </Button>
        </div>
      </header>

      {isLoading && <p className="text-muted-foreground">Cargando usuarios…</p>}
      {error && <p className="text-destructive">Error al cargar los usuarios.</p>}
      {users.length === 0 && !isLoading && !error && (
        <p className="text-muted-foreground">No hay usuarios todavía.</p>
      )}

      {users.length > 0 && (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Usuario</th>
                <th className="px-3 py-2 font-medium">Nombre</th>
                <th className="px-3 py-2 font-medium">Correo</th>
                <th className="px-3 py-2 font-medium">Rol</th>
                <th className="px-3 py-2 font-medium">Estado</th>
                <th className="px-3 py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr
                  key={u.id}
                  onClick={() => setSelectedUserId(u.id)}
                  className="cursor-pointer border-b last:border-0 hover:bg-accent"
                >
                  <td className="px-3 py-2 font-medium">{u.username}</td>
                  <td className="px-3 py-2">
                    {u.individual
                      ? `${u.individual.first_name} ${u.individual.last_name}`
                      : '—'}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{u.email}</td>
                  <td className="px-3 py-2">{u.user_role?.role_name ?? '—'}</td>
                  <td className="px-3 py-2">
                    <Badge variant="outline">
                      {STATUS_LABELS[u.status as UserStatus] ?? u.status}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={(e) => handleDelete(e, u.id, u.username)}
                    >
                      Eliminar
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CreateUserDialog open={createOpen} onOpenChange={setCreateOpen} />
      <ActivateUserDialog open={activateOpen} onOpenChange={setActivateOpen} />
      {selectedUser && (
        <UserModal user={selectedUser} onClose={() => setSelectedUserId(null)} />
      )}
    </div>
  )
}
