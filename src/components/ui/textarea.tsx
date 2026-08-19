import * as React from 'react'

import type { ControlState } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export interface TextareaProps extends React.ComponentProps<'textarea'> {
  state?: ControlState
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, state = 'default', 'aria-invalid': ariaInvalid, ...props }, ref) => {
    const invalid = state === 'error' || ariaInvalid === true || ariaInvalid === 'true'

    return (
      <textarea
        ref={ref}
        data-state={invalid ? 'error' : state}
        aria-invalid={invalid || undefined}
        className={cn(
          'flex min-h-24 w-full resize-y rounded-lg border border-default bg-surface px-3 py-2.5 text-sm leading-5 text-foreground shadow-xs transition-colors duration-150 placeholder:text-muted hover:border-border-hover focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 disabled:cursor-not-allowed disabled:border-border-light disabled:bg-surface-secondary disabled:text-muted disabled:shadow-none',
          'data-[state=error]:border-danger data-[state=error]:focus-visible:border-danger data-[state=error]:focus-visible:ring-danger/20',
          'data-[state=success]:border-success data-[state=success]:focus-visible:border-success data-[state=success]:focus-visible:ring-success/20',
          className
        )}
        {...props}
      />
    )
  }
)
Textarea.displayName = 'Textarea'

export { Textarea }
