import { useEffect, useId, useRef, useState, type AriaAttributes } from 'react'
import { Check, ChevronsUpDown } from 'lucide-react'
import { Input } from '@/components/ui/input'
import type { Country } from '../types'
import { cn } from '@/lib/utils'

/**
 * Combobox de país con lista de prioridades y búsqueda client-side.
 * Muestra 20 países frecuentes primero; el buscador filtra sobre todos los cargados.
 * Diseño: sin nuevas dependencias — Tailwind + Input existente.
 */

const PRIORITY_ISO2 = [
  'MX', 'US', 'CO', 'BR', 'AR', 'ES', 'VE', 'PE', 'CL', 'EC',
  'BO', 'PY', 'UY', 'GT', 'CR', 'PA', 'DO', 'HN', 'SV', 'NI',
]

interface CountryComboboxProps {
  countries: Country[]
  value: string | undefined   // id del país como string
  onChange: (value: string | undefined) => void
  disabled?: boolean
  placeholder?: string
  id?: string
  'aria-labelledby'?: string
  'aria-describedby'?: string
  'aria-invalid'?: AriaAttributes['aria-invalid']
}

export function CountryCombobox({
  countries,
  value,
  onChange,
  disabled,
  placeholder = 'Selecciona un país',
  id,
  'aria-labelledby': ariaLabelledBy,
  'aria-describedby': ariaDescribedBy,
  'aria-invalid': ariaInvalid,
}: CountryComboboxProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const listboxId = useId()

  const selected = countries.find((c) => String(c.id) === value)

  // Cierra el dropdown al hacer click fuera del contenedor.
  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [])

  // Ordena: primero los 20 prioritarios (en ese orden), luego el resto alfabético.
  const priorityCountries = PRIORITY_ISO2
    .map((iso) => countries.find((c) => c.iso_2 === iso))
    .filter((c): c is Country => !!c)

  const remainingCountries = countries
    .filter((c) => !PRIORITY_ISO2.includes(c.iso_2))
    .sort((a, b) => a.name.localeCompare(b.name))

  const searchLower = search.toLowerCase()
  const filteredPriority = search
    ? priorityCountries.filter((c) => c.name.toLowerCase().includes(searchLower))
    : priorityCountries
  const filteredRemaining = remainingCountries.filter((c) =>
    c.name.toLowerCase().includes(searchLower)
  )

  function select(country: Country) {
    onChange(String(country.id))
    setOpen(false)
    setSearch('')
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Botón de apertura — muestra país seleccionado o placeholder */}
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
          !selected && 'text-muted',
        )}
      >
        <span className="truncate">{selected ? selected.name : placeholder}</span>
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
      </button>

      {open && (
        <div className="cia-popover-motion absolute z-50 mt-1 w-full rounded-lg border border-default bg-popover text-popover-foreground shadow-overlay">
          {/* Buscador */}
          <div className="p-2 border-b">
            <Input
              autoFocus
              placeholder="Buscar país..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') setOpen(false)
              }}
              className="h-10 text-sm"
            />
          </div>

          <div id={listboxId} role="listbox" className="max-h-56 overflow-y-auto p-1">
            {/* Sección países frecuentes */}
            {filteredPriority.length > 0 && (
              <>
                {!search && (
                  <p className="px-3 pt-2 pb-1 text-xs font-medium text-muted-foreground">
                    Países frecuentes
                  </p>
                )}
                {filteredPriority.map((c) => (
                  <CountryOption key={c.id} country={c} selected={String(c.id) === value} onSelect={select} />
                ))}
              </>
            )}

            {/* Separador + resto de países (solo si no hay búsqueda activa o hay resultados en ambas secciones) */}
            {filteredRemaining.length > 0 && (
              <>
                {!search && filteredPriority.length > 0 && (
                  <div className="my-1 border-t" />
                )}
                {!search && (
                  <p className="px-3 pt-1 pb-1 text-xs font-medium text-muted-foreground">
                    Todos los países
                  </p>
                )}
                {filteredRemaining.map((c) => (
                  <CountryOption key={c.id} country={c} selected={String(c.id) === value} onSelect={select} />
                ))}
              </>
            )}

            {filteredPriority.length === 0 && filteredRemaining.length === 0 && (
              <p className="px-3 py-4 text-center text-sm text-muted-foreground">
                Sin resultados para "{search}"
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function CountryOption({
  country,
  selected,
  onSelect,
}: {
  country: Country
  selected: boolean
  onSelect: (c: Country) => void
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => onSelect(country)}
      className={cn(
        'flex min-h-10 w-full cursor-pointer items-center rounded-md px-3 py-2 text-left text-sm transition-colors duration-150',
        'hover:bg-primary-soft hover:text-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20',
        selected && 'bg-primary-soft font-medium text-primary-hover',
      )}
    >
      <span className="mr-2 flex h-4 w-4 shrink-0 items-center justify-center" aria-hidden="true">
        {selected && <Check className="h-4 w-4 text-brand" />}
      </span>
      {country.name}
    </button>
  )
}
