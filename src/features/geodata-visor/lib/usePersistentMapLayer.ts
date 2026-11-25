import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'

/** Preferencia por tipo de sesión y parcela. Sobrevive al desmontaje durante Play. */
export function usePersistentMapLayer<T extends string | number>(
  kind: string,
  scope: string | null | undefined,
  plotId: string | null | undefined,
  initial: T,
  allowed: readonly T[],
): [T, Dispatch<SetStateAction<T>>] {
  const key = ['ciagro', 'visor', 'layer', 'v1', scope || 'sin-organizacion', plotId || 'sin-parcela', kind].join(':')
  const allowedKey = JSON.stringify(allowed)
  const allowedValues = useMemo(() => JSON.parse(allowedKey) as T[], [allowedKey])
  const read = useCallback((): T => {
    try {
      const stored = window.sessionStorage.getItem(key)
      return allowedValues.find((candidate) => String(candidate) === stored) ?? initial
    } catch {
      return initial
    }
  }, [allowedValues, initial, key])
  const [value, setValue] = useState<T>(read)
  useEffect(() => { setValue(read()) }, [read])
  const save: Dispatch<SetStateAction<T>> = useCallback((next) => {
    setValue((previous) => {
      const selected = typeof next === 'function'
        ? (next as (old: T) => T)(previous)
        : next
      if (allowedValues.includes(selected)) {
        try { window.sessionStorage.setItem(key, String(selected)) } catch { /* almacenamiento opcional */ }
      }
      return selected
    })
  }, [allowedValues, key])
  return [value, save]
}
