import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mutate = vi.fn()
vi.mock('../hooks/useFlushSession', () => ({
  useFlushSession: () => ({ mutate, isPending: false }),
}))

import { FlushNdviDialog } from './FlushNdviDialog'
import { FlushSoilMapDialog } from './FlushSoilMapDialog'

function getDeleteButton() {
  return screen.getByRole('button', { name: /Eliminar todo/ }) as HTMLButtonElement
}

/** El blindaje del código es el mismo para los tres tipos; se ejercita una vez por diálogo. */
function expectsConfirmationCode() {
  expect(getDeleteButton().disabled).toBe(true)

  const code = screen.getByText(/^\d{6}$/).textContent!
  const input = screen.getByPlaceholderText('Código de 6 dígitos')

  fireEvent.change(input, { target: { value: '000000' } })
  expect(getDeleteButton().disabled).toBe(true)

  fireEvent.change(input, { target: { value: code } })
  return code
}

describe('FlushNdviDialog', () => {
  beforeEach(() => vi.clearAllMocks())

  it('el botón Eliminar está deshabilitado hasta teclear el código correcto', async () => {
    render(<FlushNdviDialog open onClose={vi.fn()} sessionId="ndvi-1" />)

    expectsConfirmationCode()
    await waitFor(() => expect(getDeleteButton().disabled).toBe(false))
    fireEvent.click(getDeleteButton())
    expect(mutate).toHaveBeenCalledTimes(1)
  })

  it('avisa que también se descarta la coropleta ya generada', () => {
    render(<FlushNdviDialog open onClose={vi.fn()} sessionId="ndvi-1" />)
    expect(screen.getByText(/se descarta la coropleta ya generada/i)).toBeTruthy()
  })

  it('Cancelar llama onClose sin borrar', () => {
    const onClose = vi.fn()
    render(<FlushNdviDialog open onClose={onClose} sessionId="ndvi-1" />)
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(onClose).toHaveBeenCalled()
    expect(mutate).not.toHaveBeenCalled()
  })
})

describe('FlushSoilMapDialog', () => {
  beforeEach(() => vi.clearAllMocks())

  it('el botón Eliminar está deshabilitado hasta teclear el código correcto', async () => {
    render(<FlushSoilMapDialog open onClose={vi.fn()} sessionId="soil-1" />)

    expectsConfirmationCode()
    await waitFor(() => expect(getDeleteButton().disabled).toBe(false))
    fireEvent.click(getDeleteButton())
    expect(mutate).toHaveBeenCalledTimes(1)
  })

  it('nombra las muestras de suelo, no puntos genéricos', () => {
    render(<FlushSoilMapDialog open onClose={vi.fn()} sessionId="soil-1" />)
    expect(screen.getByText(/las muestras de suelo importadas en esta sesión/i)).toBeTruthy()
  })

  it('Cancelar llama onClose sin borrar', () => {
    const onClose = vi.fn()
    render(<FlushSoilMapDialog open onClose={onClose} sessionId="soil-1" />)
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(onClose).toHaveBeenCalled()
    expect(mutate).not.toHaveBeenCalled()
  })
})
