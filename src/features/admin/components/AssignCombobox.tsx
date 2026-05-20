import { useEffect, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * Selector con búsqueda para asignaciones. Dos modos:
 *   - Single (default): click en item selecciona y cierra.
 *   - Multi: checkboxes + botón "Asignar (N)" en footer del dropdown.
 *
 * Misma técnica que CountryCombobox — sin nuevas dependencias.
 */

export interface AssignItem {
  id: string
  label: string
  sublabel?: string
}

interface BaseProps {
  items: AssignItem[]
  placeholder?: string
  disabled?: boolean
}

interface SingleProps {
  multiSelect?: false
  value: string
  onChange: (id: string) => void
}

interface MultiProps {
  multiSelect: true
  values: string[]         // no se usa internamente; el padre ya filtró los asignados
  onChangeMulti: (ids: string[]) => void
  assignLabel?: string
}

type Props = BaseProps & (SingleProps | MultiProps)

export function AssignCombobox(props: Props) {
  const { items, placeholder = 'Selecciona…', disabled } = props

  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [localSelected, setLocalSelected] = useState<string[]>([])
  const containerRef = useRef<HTMLDivElement>(null)

  // Cierra al hacer click fuera; resetea búsqueda y selección local.
  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setSearch('')
        setLocalSelected([])
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [])

  const searchLower = search.toLowerCase()
  const filtered = items.filter(
    (i) =>
      i.label.toLowerCase().includes(searchLower) ||
      (i.sublabel ?? '').toLowerCase().includes(searchLower),
  )

  function getTriggerLabel(): string {
    if (props.multiSelect) {
      return localSelected.length > 0
        ? `${localSelected.length} seleccionada${localSelected.length > 1 ? 's' : ''}`
        : placeholder
    }
    const found = items.find((i) => i.id === props.value)
    return found ? found.label : placeholder
  }

  function handleSingleSelect(item: AssignItem) {
    if (!props.multiSelect) {
      props.onChange(item.id)
      setOpen(false)
      setSearch('')
    }
  }

  function toggleMultiItem(id: string) {
    setLocalSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  function handleConfirmMulti() {
    if (props.multiSelect) {
      props.onChangeMulti(localSelected)
      setLocalSelected([])
      setOpen(false)
      setSearch('')
    }
  }

  const isMulti = props.multiSelect === true
  const hasSelection = props.multiSelect ? localSelected.length > 0 : !!props.value

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => { if (!disabled) setOpen((o) => !o) }}
        className={cn(
          'flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm',
          'hover:bg-accent/50 focus:outline-none focus:ring-1 focus:ring-ring',
          disabled && 'cursor-not-allowed opacity-50',
          !hasSelection && 'text-muted-foreground',
        )}
      >
        <span className="truncate">{getTriggerLabel()}</span>
        <svg className="ml-2 h-4 w-4 shrink-0 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4M8 15l4 4 4-4" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover text-popover-foreground shadow-md">
          {/* Buscador */}
          <div className="p-2 border-b">
            <Input
              autoFocus
              placeholder="Buscar…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 text-sm"
            />
          </div>

          {/* Lista */}
          <div className="max-h-48 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-3 py-4 text-center text-sm text-muted-foreground">
                Sin resultados para &ldquo;{search}&rdquo;
              </p>
            ) : (
              filtered.map((item) => {
                const isChecked = isMulti && localSelected.includes(item.id)
                const isSingleSelected = !isMulti && (props as SingleProps).value === item.id
                return (
                  <div
                    key={item.id}
                    role="option"
                    aria-selected={isMulti ? isChecked : isSingleSelected}
                    onMouseDown={(e) => {
                      // preventDefault evita que el handler de outside-click se dispare primero
                      e.preventDefault()
                      if (isMulti) toggleMultiItem(item.id)
                      else handleSingleSelect(item)
                    }}
                    className={cn(
                      'flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm',
                      'hover:bg-accent hover:text-accent-foreground',
                      (isChecked || isSingleSelected) && 'bg-accent/60',
                    )}
                  >
                    {isMulti && (
                      <input
                        type="checkbox"
                        readOnly
                        tabIndex={-1}
                        checked={isChecked}
                        className="pointer-events-none h-3.5 w-3.5 shrink-0"
                      />
                    )}
                    {!isMulti && isSingleSelected && (
                      <span className="text-primary">✓</span>
                    )}
                    <span className="flex-1 truncate">
                      {item.label}
                      {item.sublabel && (
                        <span className="ml-1 text-xs text-muted-foreground font-mono">
                          {item.sublabel}
                        </span>
                      )}
                    </span>
                  </div>
                )
              })
            )}
          </div>

          {/* Footer multi-select */}
          {isMulti && (
            <div className="border-t p-2">
              <Button
                type="button"
                size="sm"
                className="w-full"
                disabled={localSelected.length === 0}
                onMouseDown={(e) => { e.preventDefault(); handleConfirmMulti() }}
              >
                {(props as MultiProps).assignLabel ?? 'Asignar'}
                {localSelected.length > 0 && ` (${localSelected.length})`}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
