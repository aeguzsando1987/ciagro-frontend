import { useMemo, useState } from 'react'
import { Eye, MoreHorizontal, Plus, Trash2, UserRoundCheck } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DataToolbar } from '@/components/ui/data-toolbar'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { PageHeader } from '@/components/ui/page-header'
import { IconButton } from '@/components/ui/icon-button'
import { TableSkeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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

function statusVariant(status: UserStatus) {
  if (status === 'active') return 'success' as const
  if (status === 'pending_activation') return 'warning' as const
  return 'secondary' as const
}

/** Sección Usuarios del panel /admin — caso de uso §2. */
export function UsersSection() {
  const { data: users = [], isLoading, error, refetch } = useUsers()
  const deleteUser = useDeleteUser()
  const [createOpen, setCreateOpen] = useState(false)
  const [activateOpen, setActivateOpen] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [roleFilter, setRoleFilter] = useState('all')
  const selectedUser = users.find((user) => user.id === selectedUserId) ?? null

  const roles = useMemo(
    () =>
      Array.from(
        new Set(users.map((user) => user.user_role?.role_name).filter(Boolean) as string[])
      ).sort((a, b) => a.localeCompare(b, 'es')),
    [users]
  )

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('es-MX')
    return users.filter((user) => {
      const individualName = user.individual
        ? `${user.individual.first_name} ${user.individual.last_name}`
        : ''
      const matchesSearch =
        !query ||
        `${user.username} ${individualName} ${user.email} ${user.user_role?.role_name ?? ''}`
          .toLocaleLowerCase('es-MX')
          .includes(query)
      const matchesStatus = statusFilter === 'all' || user.status === statusFilter
      const matchesRole = roleFilter === 'all' || user.user_role?.role_name === roleFilter
      return matchesSearch && matchesStatus && matchesRole
    })
  }, [users, search, statusFilter, roleFilter])

  function handleDelete(userId: string, username: string) {
    if (!window.confirm(`¿Eliminar al usuario "${username}"?`)) return
    deleteUser.mutate(userId, {
      onSuccess: () => toast.success('El usuario se eliminó correctamente.'),
      onError: (deleteError) => toast.error(deleteError.message),
    })
  }

  const hasFilters = Boolean(search || statusFilter !== 'all' || roleFilter !== 'all')

  return (
    <div className="space-y-6">
      <PageHeader
        title="Usuarios"
        description="Alta, edición y activación de usuarios del sistema."
        actions={
          <>
            <Button variant="secondary" onClick={() => setActivateOpen(true)}>
              <UserRoundCheck />
              Pendientes
            </Button>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus />
              Nuevo usuario
            </Button>
          </>
        }
      />

      <DataToolbar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Buscar usuario…"
        searchLabel="Buscar usuarios"
        resultCount={filteredUsers.length}
        resultLabel={filteredUsers.length === 1 ? 'usuario' : 'usuarios'}
        hasActiveFilters={hasFilters}
        onClearFilters={() => {
          setSearch('')
          setStatusFilter('all')
          setRoleFilter('all')
        }}
        filters={
          <>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-44" aria-label="Filtrar por rol">
                <SelectValue placeholder="Rol" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los roles</SelectItem>
                {roles.map((role) => (
                  <SelectItem key={role} value={role}>
                    {role}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-44" aria-label="Filtrar por estado">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                <SelectItem value="active">Activos</SelectItem>
                <SelectItem value="pending_activation">Pendientes</SelectItem>
                <SelectItem value="disabled">Desactivados</SelectItem>
              </SelectContent>
            </Select>
          </>
        }
      />

      {isLoading && <TableSkeleton columns={6} label="Cargando usuarios…" />}
      {error && (
        <ErrorState
          title="No pudimos cargar los usuarios"
          description="Revisa tu conexión e inténtalo nuevamente."
          onRetry={() => void refetch()}
        />
      )}
      {!isLoading && !error && filteredUsers.length === 0 && (
        <EmptyState
          title={hasFilters ? 'No encontramos usuarios' : 'No hay usuarios todavía'}
          description={
            hasFilters ? 'Ajusta o limpia los filtros para ver más resultados.' : undefined
          }
        />
      )}

      {filteredUsers.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Usuario</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>Correo</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="w-20 text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers.map((user) => (
              <TableRow
                key={user.id}
                onClick={() => setSelectedUserId(user.id)}
                className="cursor-pointer"
              >
                <TableCell className="font-medium">{user.username}</TableCell>
                <TableCell>
                  {user.individual
                    ? `${user.individual.first_name} ${user.individual.last_name}`
                    : '—'}
                </TableCell>
                <TableCell className="text-secondary">{user.email}</TableCell>
                <TableCell>{user.user_role?.role_name ?? '—'}</TableCell>
                <TableCell>
                  <Badge variant={statusVariant(user.status as UserStatus)}>
                    {STATUS_LABELS[user.status as UserStatus] ?? user.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <IconButton
                        label={`Acciones de ${user.username}`}
                        variant="ghost"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <MoreHorizontal />
                      </IconButton>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => setSelectedUserId(user.id)}>
                        <Eye />
                        Ver detalle
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-danger focus:bg-danger-soft focus:text-danger"
                        onSelect={() => handleDelete(user.id, user.username)}
                      >
                        <Trash2 />
                        Eliminar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <CreateUserDialog open={createOpen} onOpenChange={setCreateOpen} />
      <ActivateUserDialog open={activateOpen} onOpenChange={setActivateOpen} />
      {selectedUser && <UserModal user={selectedUser} onClose={() => setSelectedUserId(null)} />}
    </div>
  )
}
