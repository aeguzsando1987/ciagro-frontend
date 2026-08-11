/**
 * Selector múltiple con buscador (fase AS).
 *
 * El use case lo pide explícitamente: "escribe 'La tij' e inmediatamente muestra
 * coincidencias como 'La tijera', 'La tijereña'". El filtrado real ocurre en el
 * backend (`?search=`), no en cliente, porque los catálogos superan la página que
 * cabe en una sola petición.
 *
 * No se instala ninguna librería de combobox: `components/ui/` no tiene una y el
 * comportamiento que hace falta -buscar, marcar, quitar- cabe en un input, una lista
 * y unos chips.
 */
import { useEffect, useState } from 'react'
import { Loader2, X } from 'lucide-react'
import { Input } from '@/components/ui/input'

export interface SelectOption {
  id: string
  label: string
}

interface MultiSelectSearchProps {
  label: string
  placeholder?: string
  options: SelectOption[]
  selected: string[]
  onChange: (ids: string[]) => void
  /** Texto de búsqueda actual, elevado para que el padre dispare la consulta. */
  search: string
  onSearchChange: (value: string) => void
  isLoading?: boolean
  /** Mensaje cuando el selector depende de otro que aún no tiene selección. */
  disabledHint?: string
  emptyHint?: string
}

/**
 * Debounce del texto tecleado.
 *
 * Sin esto cada pulsación dispara una petición: escribir "La tijera" serían nueve.
 * 250 ms es el punto donde la lista sigue sintiéndose inmediata y el backend recibe
 * una sola consulta por palabra.
 */
export function useDebouncedValue<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

export function MultiSelectSearch({
  label,
  placeholder,
  options,
  selected,
  onChange,
  search,
  onSearchChange,
  isLoading = false,
  disabledHint,
  emptyHint = 'Sin coincidencias.',
}: MultiSelectSearchProps) {
  const selectedSet = new Set(selected)

  // Los seleccionados se muestran como chips aunque salgan de la lista visible: si el
  // usuario busca otra cosa, no debe perder de vista lo que ya eligió.
  const selectedOptions = selected.map(
    (id) => options.find((option) => option.id === id) ?? { id, label: id.slice(0, 8) }
  )

  function toggle(id: string) {
    onChange(selectedSet.has(id) ? selected.filter((value) => value !== id) : [...selected, id])
  }

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium">{label}</span>
        {selected.length > 0 && (
          <button
            type="button"
            onClick={() => onChange([])}
            className="text-[11px] text-muted-foreground hover:text-foreground"
          >
            Limpiar ({selected.length})
          </button>
        )}
      </div>

      {disabledHint ? (
        <p className="rounded border border-dashed px-2 py-3 text-[11px] text-muted-foreground">
          {disabledHint}
        </p>
      ) : (
        <>
          <Input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={placeholder ?? 'Buscar…'}
            className="h-8 text-xs"
            aria-label={`Buscar ${label.toLowerCase()}`}
          />

          {selectedOptions.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {selectedOptions.map((option) => (
                <span
                  key={option.id}
                  className="flex items-center gap-1 rounded bg-accent px-1.5 py-0.5 text-[11px]"
                >
                  {option.label}
                  <button
                    type="button"
                    aria-label={`Quitar ${option.label}`}
                    onClick={() => toggle(option.id)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          <div role="listbox" aria-multiselectable className="max-h-40 overflow-auto rounded border">
            {isLoading ? (
              <div className="flex items-center gap-1.5 px-2 py-2 text-[11px] text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> Cargando…
              </div>
            ) : options.length === 0 ? (
              <p className="px-2 py-2 text-[11px] text-muted-foreground">{emptyHint}</p>
            ) : (
              options.map((option) => (
                <label
                  key={option.id}
                  className="flex cursor-pointer items-center gap-2 px-2 py-1 text-xs hover:bg-accent"
                >
                  <input
                    type="checkbox"
                    checked={selectedSet.has(option.id)}
                    onChange={() => toggle(option.id)}
                    className="h-3.5 w-3.5"
                  />
                  <span className="truncate">{option.label}</span>
                </label>
              ))
            )}
          </div>
        </>
      )}
    </div>
  )
}
