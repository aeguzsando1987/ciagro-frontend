import * as React from 'react'

import { cn } from '@/lib/utils'

export type ControlState = 'default' | 'error' | 'success'

export interface InputProps extends React.ComponentProps<'input'> {
  state?: ControlState
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, state = 'default', 'aria-invalid': ariaInvalid, ...props }, ref) => {
    const invalid = state === 'error' || ariaInvalid === true || ariaInvalid === 'true'

    return (
      <input
        ref={ref}
        type={type}
        data-state={invalid ? 'error' : state}
        aria-invalid={invalid || undefined}
        className={cn(
          'flex h-11 w-full rounded-lg border border-default bg-surface px-3 py-2 text-sm text-foreground shadow-xs transition-colors duration-150 file:mr-3 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 disabled:cursor-not-allowed disabled:border-border-light disabled:bg-surface-secondary disabled:text-muted disabled:shadow-none',
          'hover:border-border-hover disabled:hover:border-border-light',
          'data-[state=error]:border-danger data-[state=error]:focus-visible:border-danger data-[state=error]:focus-visible:ring-danger/20',
          'data-[state=success]:border-success data-[state=success]:focus-visible:border-success data-[state=success]:focus-visible:ring-success/20',
          className
        )}
        {...props}
      />
    )
  }
)
Input.displayName = 'Input'

export { Input }
