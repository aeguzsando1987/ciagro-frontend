import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect } from 'vitest'

// Mock useLogout para aislar NoAccessScreen de QueryClient y navegación.
const mockLogout = vi.fn()
vi.mock('@/features/auth/useLogout', () => ({
  useLogout: () => ({ mutate: mockLogout, isPending: false }),
}))

import { NoAccessScreen } from './NoAccessScreen'

describe('NoAccessScreen', () => {
  it('renders the no-access message', () => {
    render(<NoAccessScreen />)
    expect(screen.getByText(/sin acceso/i)).toBeInTheDocument()
    expect(screen.getByText(/contacta a tu administrador/i)).toBeInTheDocument()
  })

  it('calls logout when the logout button is clicked', async () => {
    const user = userEvent.setup()
    render(<NoAccessScreen />)

    await user.click(screen.getByRole('button', { name: /cerrar sesion/i }))

    expect(mockLogout).toHaveBeenCalledOnce()
  })
})
