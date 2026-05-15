import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw-server'
import { CreateMasterDialog } from './CreateMasterDialog'
import { createTestQueryClient } from '@/test/test-utils'

const BASE = 'http://localhost:8500'

beforeEach(() =>
  server.use(
    http.get(`${BASE}/api/v1/organizations/`, () =>
      HttpResponse.json({
        count: 1,
        results: [{ id: 'prod-1', commercial_name: 'Rancho El Sol', code: 'RS-001' }],
      })
    )
  )
)
afterEach(() => server.resetHandlers())

function renderDialog(open = true) {
  const onOpenChange = vi.fn()
  const qc = createTestQueryClient()
  render(
    <QueryClientProvider client={qc}>
      <CreateMasterDialog open={open} onOpenChange={onOpenChange} datacentral="dc-1" />
    </QueryClientProvider>
  )
  return { onOpenChange }
}

describe('CreateMasterDialog', () => {
  it('no renderiza nada cuando open=false', () => {
    renderDialog(false)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('renderiza los campos requeridos cuando open=true', async () => {
    renderDialog()
    await waitFor(() => screen.getByRole('dialog'))
    expect(screen.getByLabelText(/Título/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Código/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Fecha inicio/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Fecha fin/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Notas/i)).toBeInTheDocument()
  })

  it('muestra errores zod al enviar el formulario vacío', async () => {
    const user = userEvent.setup()
    renderDialog()
    await waitFor(() => screen.getByRole('dialog'))

    await user.click(screen.getByRole('button', { name: /Crear Programa/i }))

    await waitFor(() => {
      const errors = screen.getAllByText('Requerido')
      expect(errors.length).toBeGreaterThanOrEqual(2)
    })
  })

  it('no cierra el dialog si falta el campo agro_unit (validación zod)', async () => {
    server.use(
      http.post(`${BASE}/api/v1/field_ops/master-programs/create/`, () =>
        HttpResponse.json({ id: 'master-new', title: 'Nuevo' }, { status: 201 })
      )
    )
    const user = userEvent.setup()
    const { onOpenChange } = renderDialog()
    await waitFor(() => screen.getByRole('dialog'))

    await user.type(screen.getByLabelText(/Título/i), 'Programa Primavera')
    await user.type(screen.getByLabelText(/Código/i), 'PROG-2026-A')
    await user.type(screen.getByLabelText(/Fecha inicio/i), '2026-06-01')
    await user.type(screen.getByLabelText(/Fecha fin/i), '2026-08-31')

    // Sin seleccionar agro_unit (Radix Select no interaccionable en jsdom),
    // el schema zod debe rechazar el submit y el dialog no debe cerrarse.
    await user.click(screen.getByRole('button', { name: /Crear Programa/i }))
    await new Promise((r) => setTimeout(r, 100))
    expect(onOpenChange).not.toHaveBeenCalledWith(false)
  })
})
