import { screen, waitFor, render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw-server'
import { CreateUserDialog } from './CreateUserDialog'
import { createTestQueryClient } from '@/test/test-utils'

const BASE = 'http://localhost:8500'

// El diálogo carga roles, roles laborales y países al montar — se mockean vacíos.
beforeEach(() =>
  server.use(
    http.get(`${BASE}/api/v1/users/roles/`, () => HttpResponse.json({ count: 0, results: [] })),
    http.get(`${BASE}/api/v1/users/work-roles/`, () => HttpResponse.json({ count: 0, results: [] })),
    http.get(`${BASE}/api/v1/geography/countries/`, () => HttpResponse.json({ count: 0, results: [] }))
  )
)
afterEach(() => server.resetHandlers())

function renderDialog(open = true) {
  const onOpenChange = vi.fn()
  render(
    <QueryClientProvider client={createTestQueryClient()}>
      <CreateUserDialog open={open} onOpenChange={onOpenChange} />
    </QueryClientProvider>
  )
  return { onOpenChange }
}

describe('CreateUserDialog', () => {
  it('no renderiza nada cuando open=false', () => {
    renderDialog(false)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('renderiza las tres secciones del formulario cuando open=true', async () => {
    renderDialog()
    await waitFor(() => screen.getByRole('dialog'))
    expect(screen.getByText('Nuevo usuario')).toBeInTheDocument()
    expect(screen.getByText('Cuenta')).toBeInTheDocument()
    expect(screen.getByText('Perfil')).toBeInTheDocument()
    expect(screen.getByText('Ubicación')).toBeInTheDocument()
  })

  it('muestra errores zod al enviar el formulario vacío', async () => {
    const user = userEvent.setup()
    const { onOpenChange } = renderDialog()
    await waitFor(() => screen.getByRole('dialog'))

    await user.click(screen.getByRole('button', { name: /Crear usuario/i }))

    // username, first_name y last_name son obligatorios → al menos 3 "Requerido".
    await waitFor(() => {
      expect(screen.getAllByText('Requerido').length).toBeGreaterThanOrEqual(3)
    })
    // El formulario inválido no cierra el diálogo.
    expect(onOpenChange).not.toHaveBeenCalledWith(false)
  })
})
