import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { UsersSection } from './UsersSection'
import { useDeleteUser, useUsers } from '../hooks/useUsers'

vi.mock('../hooks/useUsers', () => ({
  useUsers: vi.fn(),
  useDeleteUser: vi.fn(),
}))

vi.mock('../dialogs/CreateUserDialog', () => ({
  CreateUserDialog: ({ open }: { open: boolean }) =>
    open ? <div role="dialog">Nuevo usuario</div> : null,
}))

vi.mock('../dialogs/ActivateUserDialog', () => ({
  ActivateUserDialog: ({ open }: { open: boolean }) =>
    open ? <div role="dialog">Usuarios pendientes</div> : null,
}))

vi.mock('../panel/UserModal', () => ({
  UserModal: ({ user }: { user: { username: string } }) => (
    <div role="dialog">Detalle de {user.username}</div>
  ),
}))

const USERS = [
  {
    id: 'user-1',
    username: 'ana.agro',
    email: 'ana@example.com',
    status: 'active',
    individual: { first_name: 'Ana', last_name: 'López' },
    user_role: { role_name: 'Gerente' },
  },
  {
    id: 'user-2',
    username: 'luis.campo',
    email: 'luis@example.com',
    status: 'pending_activation',
    individual: { first_name: 'Luis', last_name: 'Pérez' },
    user_role: { role_name: 'Técnico' },
  },
]

describe('UsersSection', () => {
  beforeEach(() => {
    vi.mocked(useUsers).mockReturnValue({
      data: USERS,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as never)
    vi.mocked(useDeleteUser).mockReturnValue({ mutate: vi.fn(), isPending: false } as never)
  })

  it('aplica encabezado, filtros, tabla y badges de estado', () => {
    render(<UsersSection />)

    expect(screen.getByRole('heading', { name: 'Usuarios', level: 1 })).toBeInTheDocument()
    expect(screen.getByRole('searchbox', { name: 'Buscar usuarios' })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Filtrar por rol' })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Filtrar por estado' })).toBeInTheDocument()
    expect(screen.getByText('Activo')).toBeInTheDocument()
    expect(screen.getByText('Pendiente')).toBeInTheDocument()
  })

  it('abre el detalle desde el dropdown de acciones', async () => {
    const user = userEvent.setup()
    render(<UsersSection />)

    await user.click(screen.getByRole('button', { name: 'Acciones de ana.agro' }))
    await user.click(screen.getByRole('menuitem', { name: 'Ver detalle' }))

    expect(screen.getByRole('dialog')).toHaveTextContent('Detalle de ana.agro')
  })
})
