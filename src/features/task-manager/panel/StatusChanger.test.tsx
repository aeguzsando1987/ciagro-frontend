import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { StatusChanger } from './StatusChanger'
import { useAuthStore } from '@/features/auth/useAuthStore'
import type { ProgramaStatus } from '@/features/task-manager/types'

/**
 * StatusChanger no hace fetch — solo lee useAuthStore y renderiza botones.
 * No necesita QueryClientProvider ni MSW.
 */

function setRole(role_level: number) {
  useAuthStore.setState({
    user: {
      id: 'u1',
      username: 'user',
      email: 'u@test.com',
      role_name: 'test',
      role_level,
      requires_password_change: false,
      datacentrals: [],
    },
  })
}

afterEach(() => useAuthStore.setState({ user: null }))

function renderChanger(currentStatus: ProgramaStatus, onChangeStatus = vi.fn()) {
  return render(<StatusChanger currentStatus={currentStatus} onChangeStatus={onChangeStatus} />)
}

describe('StatusChanger', () => {
  it('no renderiza nada cuando no hay transiciones disponibles (completed)', () => {
    setRole(4)
    const { container } = renderChanger('completed')
    expect(container.firstChild).toBeNull()
  })

  it('no renderiza nada cuando no hay transiciones disponibles (cancelled)', () => {
    setRole(4)
    const { container } = renderChanger('cancelled')
    expect(container.firstChild).toBeNull()
  })

  it('Técnico (level 2) desde pending ve solo En progreso', () => {
    setRole(2)
    renderChanger('pending')
    expect(screen.getByRole('button', { name: /En progreso/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Completado/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Cancelado/i })).not.toBeInTheDocument()
  })

  it('Técnico (level 2) desde loaded NO ve Completado ni Cancelado', () => {
    setRole(2)
    renderChanger('loaded')
    expect(screen.getByRole('button', { name: /En progreso/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Completado/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Cancelado/i })).not.toBeInTheDocument()
  })

  it('Gerente (level 4) desde loaded ve En progreso, Completado y Cancelado', () => {
    setRole(4)
    renderChanger('loaded')
    expect(screen.getByRole('button', { name: /En progreso/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Completado/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Cancelado/i })).toBeInTheDocument()
  })

  it('llama onChangeStatus con el nuevo status al hacer click', async () => {
    const user = userEvent.setup()
    setRole(2)
    const onChangeStatus = vi.fn()
    renderChanger('pending', onChangeStatus)
    await user.click(screen.getByRole('button', { name: /En progreso/i }))
    expect(onChangeStatus).toHaveBeenCalledOnce()
    expect(onChangeStatus).toHaveBeenCalledWith('in_progress')
  })
})
