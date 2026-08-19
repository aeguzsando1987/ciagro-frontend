import * as React from 'react'
import { Search, X } from 'lucide-react'

import { IconButton } from '@/components/ui/icon-button'
import { Input, type InputProps } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export interface SearchInputProps extends Omit<InputProps, 'type'> {
  containerClassName?: string
  onClear?: () => void
}

const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  ({ className, containerClassName, onClear, value, ...props }, ref) => {
    const hasValue = typeof value === 'string' ? value.length > 0 : Boolean(value)

    return (
      <div className={cn('relative w-full', containerClassName)}>
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
        />
        <Input
          ref={ref}
          type="search"
          value={value}
          className={cn('pl-9 pr-9', className)}
          {...props}
        />
        {onClear && hasValue && (
          <IconButton
            label="Limpiar búsqueda"
            variant="ghost"
            size="icon-sm"
            onClick={onClear}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted"
          >
            <X />
          </IconButton>
        )}
      </div>
    )
  }
)
SearchInput.displayName = 'SearchInput'

export { SearchInput }
