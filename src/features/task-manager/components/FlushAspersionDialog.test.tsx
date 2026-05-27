import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mutate = vi.fn()
vi.mock('../hooks/useFlushAspersion', () => ({
  useFlushAspersion: () => ({ mutate, isPending: false }),
}))

import { FlushAspersionDialog } from './FlushAspersionDialog'

function getDeleteButton() {
  return screen.getByRole('button', { name: /Eliminar todo/ })
}

describe('FlushAspersionDialog', () => {
  beforeEach(() => vi.clearAllMocks())

  it('el botón Eliminar está deshabilitado hasta teclear el código correcto', async () => {
    render(<FlushAspersionDialog open onClose={vi.fn()} sessionId="sess-1" />)

    const delBtn = getDeleteButton()
    expect((delBtn as HTMLButtonElement).disabled).toBe(true)

    // El código de 6 dígitos se muestra en el cuerpo (font-mono). Lo leemos del DOM.
    const code = screen.getByText(/^\d{6}$/).textContent!
    const input = screen.getByPlaceholderText('Código de 6 dígitos')

    // Código incorrecto → sigue deshabilitado
    fireEvent.change(input, { target: { value: '000000' } })
    expect((getDeleteButton() as HTMLButtonElement).disabled).toBe(true)

    // Código correcto → habilitado y dispara la mutación
    fireEvent.change(input, { target: { value: code } })
    await waitFor(() => expect((getDeleteButton() as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(getDeleteButton())
    expect(mutate).toHaveBeenCalledTimes(1)
  })

  it('Cancelar llama onClose sin borrar', () => {
    const onClose = vi.fn()
    render(<FlushAspersionDialog open onClose={onClose} sessionId="sess-1" />)
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(onClose).toHaveBeenCalled()
    expect(mutate).not.toHaveBeenCalled()
  })
})
