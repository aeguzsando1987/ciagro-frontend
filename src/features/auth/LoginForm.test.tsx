import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect } from 'vitest'
import { LoginForm } from './LoginForm'

describe('LoginForm', () => {
  it('renders username, password fields and submit button', () => {
    render(<LoginForm onSubmit={vi.fn()} />)
    expect(screen.getByLabelText(/usuario/i)).toBeInTheDocument()
    expect(screen.getByLabelText('Contraseña')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /entrar/i })).toBeInTheDocument()
  })

  it('displays error message from prop', () => {
    render(<LoginForm onSubmit={vi.fn()} error="Usuario o contraseña incorrectos" />)
    expect(screen.getByText(/usuario o contraseña incorrectos/i)).toBeInTheDocument()
  })

  it('disables submit button when isPending', () => {
    render(<LoginForm onSubmit={vi.fn()} isPending />)
    expect(screen.getByRole('button', { name: /ingresando/i })).toBeDisabled()
  })

  it('calls onSubmit with form values on valid submit', async () => {
    const onSubmit = vi.fn()
    const user = userEvent.setup()
    render(<LoginForm onSubmit={onSubmit} />)

    await user.type(screen.getByLabelText(/usuario/i), 'gerente01')
    await user.type(screen.getByLabelText('Contraseña'), 'secreto123')
    await user.click(screen.getByRole('button', { name: /entrar/i }))

    // react-hook-form llama onSubmit(data, event) — el segundo arg es el SubmitEvent
    expect(onSubmit).toHaveBeenCalledOnce()
    expect(onSubmit).toHaveBeenCalledWith(
      { username: 'gerente01', password: 'secreto123' },
      expect.anything(),
    )
  })

  it('shows zod validation errors when submitting empty fields', async () => {
    const onSubmit = vi.fn()
    const user = userEvent.setup()
    render(<LoginForm onSubmit={onSubmit} />)

    await user.click(screen.getByRole('button', { name: /entrar/i }))

    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getAllByText(/requerido/i).length).toBeGreaterThanOrEqual(1)
  })
})
