import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect } from 'vitest'
import { ChangePasswordForm } from './ChangePasswordForm'

describe('ChangePasswordForm', () => {
  it('renders 3 password fields and the mandatory-change notice', () => {
    render(<ChangePasswordForm onSubmit={vi.fn()} />)
    expect(screen.getByLabelText('Contraseña actual')).toBeInTheDocument()
    expect(screen.getByLabelText('Nueva contraseña')).toBeInTheDocument()
    expect(screen.getByLabelText('Confirmar nueva contraseña')).toBeInTheDocument()
    expect(screen.getByText(/tu administrador requiere/i)).toBeInTheDocument()
  })

  it('shows zod refine error when new passwords do not match', async () => {
    const onSubmit = vi.fn()
    const user = userEvent.setup()
    render(<ChangePasswordForm onSubmit={onSubmit} />)

    await user.type(screen.getByLabelText('Contraseña actual'), 'vieja')
    await user.type(screen.getByLabelText('Nueva contraseña'), 'nueva123')
    await user.type(screen.getByLabelText('Confirmar nueva contraseña'), 'diferente')
    await user.click(screen.getByRole('button', { name: /cambiar/i }))

    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getAllByText(/no coinciden/i).length).toBeGreaterThanOrEqual(1)
  })

  it('calls onSubmit with correct values when passwords match', async () => {
    const onSubmit = vi.fn()
    const user = userEvent.setup()
    render(<ChangePasswordForm onSubmit={onSubmit} />)

    await user.type(screen.getByLabelText('Contraseña actual'), 'vieja')
    await user.type(screen.getByLabelText('Nueva contraseña'), 'nueva123')
    await user.type(screen.getByLabelText('Confirmar nueva contraseña'), 'nueva123')
    await user.click(screen.getByRole('button', { name: /cambiar/i }))

    // react-hook-form llama onSubmit(data, event)
    expect(onSubmit).toHaveBeenCalledOnce()
    expect(onSubmit).toHaveBeenCalledWith(
      { old_password: 'vieja', new_password: 'nueva123', new_password_confirm: 'nueva123' },
      expect.anything(),
    )
  })
})
