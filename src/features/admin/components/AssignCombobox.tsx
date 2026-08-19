import { useEffect, useId, useRef, useState, type AriaAttributes } from 'react'
import { Check, ChevronsUpDown } from 'lucide-react'
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
  id?: string
  'aria-labelledby'?: string
  'aria-describedby'?: string
  'aria-invalid'?: AriaAttributes['aria-invalid']
  /**
   * Si true, el dropdown se renderiza EN FLUJO (no absolute) — empuja el
   * contenido siguiente al abrirse y el contenedor crece naturalmente.
   * Útil cuando el combobox vive dentro de un Dialog/panel scrollable y
   * preferimos que el panel crezca a que el dropdown overflowee fuera.
   */
  inline?: boolean
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
  const {
    items,
    placeholder = 'Selecciona…',
    disabled,
    inline = false,
    id,
    'aria-labelledby': ariaLabelledBy,
    'aria-describedby': ariaDescribedBy,
    'aria-invalid': ariaInvalid,
  } = props

  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [localSelected, setLocalSelected] = useState<string[]>([])
  const containerRef = useRef<HTMLDivElement>(null)
  const listboxId = useId()

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
        id={id}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-haspopup="listbox"
        aria-labelledby={ariaLabelledBy}
        aria-describedby={ariaDescribedBy}
        aria-invalid={ariaInvalid}
        disabled={disabled}
        onClick={() => { if (!disabled) setOpen((o) => !o) }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setOpen(false)
          if (event.key === 'ArrowDown' && !disabled) setOpen(true)
        }}
        className={cn(
          'flex h-11 w-full items-center justify-between rounded-lg border border-default bg-surface px-3 py-2 text-sm shadow-xs transition-colors duration-150',
          'hover:border-border-hover focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20',
          disabled && 'cursor-not-allowed opacity-50',
          !hasSelection && 'text-muted',
        )}
      >
        <span className="truncate">{getTriggerLabel()}</span>
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
      </button>

      {open && (
        <div
          className={cn(
            'cia-popover-motion mt-1 w-full rounded-lg border border-default bg-popover text-popover-foreground shadow-overlay',
            inline ? '' : 'absolute z-50',
          )}
        >
          {/* Buscador */}
          <div className="p-2 border-b">
            <Input
              autoFocus
              placeholder="Buscar…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') setOpen(false)
              }}
              className="h-10 text-sm"
            />
          </div>

          {/* Lista */}
          <div id={listboxId} role="listbox" aria-multiselectable={isMulti || undefined} className="max-h-48 overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <p className="px-3 py-4 text-center text-sm text-muted-foreground">
                Sin resultados para &ldquo;{search}&rdquo;
              </p>
            ) : (
              filtered.map((item) => {
                const isChecked = isMulti && localSelected.includes(item.id)
                const isSingleSelected = !isMulti && (props as SingleProps).value === item.id
                return (
                  <button
                    type="button"
                    key={item.id}
                    role="option"
                    aria-selected={isMulti ? isChecked : isSingleSelected}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      if (isMulti) toggleMultiItem(item.id)
                      else handleSingleSelect(item)
                    }}
                    className={cn(
                      'flex min-h-10 w-full cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors duration-150',
                      'hover:bg-primary-soft hover:text-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20',
                      (isChecked || isSingleSelected) && 'bg-primary-soft text-primary-hover',
                    )}
                  >
                    {isMulti && (
                      <span
                        aria-hidden="true"
                        className={cn(
                          'flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border border-default',
                          isChecked && 'border-primary bg-primary text-primary-foreground',
                        )}
                      >
                        {isChecked && <Check className="h-3 w-3" />}
                      </span>
                    )}
                    {!isMulti && isSingleSelected && (
                      <Check className="h-4 w-4 text-brand" aria-hidden="true" />
                    )}
                    {!isMulti && !isSingleSelected && <span className="h-4 w-4" aria-hidden="true" />}
                    <span className="flex-1 truncate">
                      {item.label}
                      {item.sublabel && (
                        <span className="ml-1 text-xs text-muted-foreground font-mono">
                          {item.sublabel}
                        </span>
                      )}
                    </span>
                  </button>
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
                onMouseDown={(event) => event.preventDefault()}
                onClick={handleConfirmMulti}
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
