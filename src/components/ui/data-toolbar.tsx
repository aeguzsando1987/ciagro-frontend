import type { ReactNode } from 'react'
import { RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SearchInput } from '@/components/ui/search-input'
import { cn } from '@/lib/utils'

export interface DataToolbarProps {
  searchValue?: string
  onSearchChange?: (value: string) => void
  searchPlaceholder?: string
  searchLabel?: string
  filters?: ReactNode
  hasActiveFilters?: boolean
  onClearFilters?: () => void
  resultCount?: number
  resultLabel?: string
  primaryAction?: ReactNode
  className?: string
}

/** Toolbar común para búsqueda, filtros, conteo de resultados y acción principal. */
function DataToolbar({
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Buscar…',
  searchLabel = 'Buscar',
  filters,
  hasActiveFilters,
  onClearFilters,
  resultCount,
  resultLabel = 'resultados',
  primaryAction,
  className,
}: DataToolbarProps) {
  const hasSearch = searchValue !== undefined && onSearchChange !== undefined

  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-xl border border-default bg-surface p-3 lg:flex-row lg:items-center',
        className
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        {hasSearch && (
          <SearchInput
            aria-label={searchLabel}
            placeholder={searchPlaceholder}
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
            onClear={searchValue ? () => onSearchChange('') : undefined}
            containerClassName="w-full sm:max-w-sm"
          />
        )}
        {filters && <div className="flex flex-wrap items-center gap-2">{filters}</div>}
        {hasActiveFilters && onClearFilters && (
          <Button type="button" variant="ghost" size="sm" onClick={onClearFilters}>
            <RotateCcw />
            Limpiar filtros
          </Button>
        )}
      </div>

      <div className="flex shrink-0 items-center justify-between gap-3 lg:justify-end">
        {resultCount !== undefined && (
          <span className="whitespace-nowrap text-sm text-secondary" aria-live="polite">
            <strong className="font-semibold text-foreground">{resultCount}</strong> {resultLabel}
          </span>
        )}
        {primaryAction}
      </div>
    </div>
  )
}

export { DataToolbar }
