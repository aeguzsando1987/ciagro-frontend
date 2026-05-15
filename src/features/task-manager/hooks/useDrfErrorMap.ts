import type { UseFormSetError, FieldValues, Path } from 'react-hook-form'

/**
 * Toma la respuesta de error DRF ({ field: ["msg", ...], non_field_errors: [...] })
 * y la mapea a llamadas form.setError para que react-hook-form muestre los mensajes
 * inline en el campo correspondiente.
 *
 * Los campos desconocidos (no presentes en el formulario) se acumulan en `root`.
 * `non_field_errors` también va a `root`.
 */
export function applyDrfErrors<T extends FieldValues>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  errors: Record<string, any>,
  setError: UseFormSetError<T>,
  knownFields: readonly (Path<T>)[]
): void {
  const knownSet = new Set<string>(knownFields)
  const rootMessages: string[] = []

  for (const [field, messages] of Object.entries(errors)) {
    const msgs: string[] = Array.isArray(messages) ? messages.map(String) : [String(messages)]
    if (field === 'non_field_errors' || !knownSet.has(field)) {
      rootMessages.push(...msgs)
    } else {
      setError(field as Path<T>, { message: msgs[0] ?? 'Error' })
    }
  }

  if (rootMessages.length > 0) {
    setError('root' as Path<T>, { message: rootMessages.join(' ') })
  }
}
