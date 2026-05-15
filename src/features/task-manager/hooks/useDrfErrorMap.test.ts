import { describe, it, expect, vi } from 'vitest'
import { applyDrfErrors } from './useDrfErrorMap'
import type { UseFormSetError } from 'react-hook-form'

type TestForm = { title: string; code: string; agro_unit: string; notes?: string }

function makeSetError() {
  return vi.fn() as unknown as UseFormSetError<TestForm>
}

describe('applyDrfErrors', () => {
  it('mapea un campo conocido al campo correcto del formulario', () => {
    const setError = makeSetError()
    applyDrfErrors(
      { title: ['Este campo es requerido.'] },
      setError,
      ['title', 'code', 'agro_unit', 'notes'] as const
    )
    expect(setError).toHaveBeenCalledWith('title', { message: 'Este campo es requerido.' })
  })

  it('acumula campos desconocidos en root', () => {
    const setError = makeSetError()
    applyDrfErrors(
      { unknown_field: ['Error desconocido'] },
      setError,
      ['title', 'code', 'agro_unit'] as const
    )
    expect(setError).toHaveBeenCalledWith('root', { message: 'Error desconocido' })
  })

  it('mapea non_field_errors a root', () => {
    const setError = makeSetError()
    applyDrfErrors(
      { non_field_errors: ['Las fechas se solapan.'] },
      setError,
      ['title', 'code'] as const
    )
    expect(setError).toHaveBeenCalledWith('root', { message: 'Las fechas se solapan.' })
  })

  it('solo usa el primer mensaje del array por campo', () => {
    const setError = makeSetError()
    applyDrfErrors(
      { code: ['Muy corto.', 'Debe ser único.'] },
      setError,
      ['title', 'code'] as const
    )
    expect(setError).toHaveBeenCalledWith('code', { message: 'Muy corto.' })
  })

  it('concatena múltiples mensajes de root con espacio', () => {
    const setError = makeSetError()
    applyDrfErrors(
      { non_field_errors: ['Error A.', 'Error B.'] },
      setError,
      ['title'] as const
    )
    expect(setError).toHaveBeenCalledWith('root', { message: 'Error A. Error B.' })
  })

  it('combina errores de campo conocido y non_field_errors correctamente', () => {
    const setError = makeSetError()
    applyDrfErrors(
      { title: ['Requerido.'], non_field_errors: ['Error global.'] },
      setError,
      ['title', 'code'] as const
    )
    expect(setError).toHaveBeenCalledWith('title', { message: 'Requerido.' })
    expect(setError).toHaveBeenCalledWith('root', { message: 'Error global.' })
  })
})
