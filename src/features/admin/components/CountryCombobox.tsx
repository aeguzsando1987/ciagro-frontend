import { useEffect, useRef, useState } from 'react'
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
}

export function CountryCombobox({
  countries,
  value,
  onChange,
  disabled,
  placeholder = 'Selecciona un país',
}: CountryComboboxProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

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
        type="button"
        disabled={disabled}
        onClick={() => { if (!disabled) setOpen((o) => !o) }}
        className={cn(
          'flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm',
          'hover:bg-accent/50 focus:outline-none focus:ring-1 focus:ring-ring',
          disabled && 'cursor-not-allowed opacity-50',
          !selected && 'text-muted-foreground',
        )}
      >
        <span className="truncate">{selected ? selected.name : placeholder}</span>
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
              placeholder="Buscar país..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 text-sm"
            />
          </div>

          <div className="max-h-56 overflow-y-auto">
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
    <div
      role="option"
      aria-selected={selected}
      onMouseDown={(e) => { e.preventDefault(); onSelect(country) }}
      className={cn(
        'flex cursor-pointer items-center px-3 py-1.5 text-sm',
        'hover:bg-accent hover:text-accent-foreground',
        selected && 'bg-accent/60 font-medium',
      )}
    >
      {selected && <span className="mr-2 text-primary">✓</span>}
      {country.name}
    </div>
  )
}
