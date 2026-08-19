import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium leading-5 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary-soft text-primary-hover',
        primary: 'border-transparent bg-primary-soft text-primary-hover',
        secondary: 'border-transparent bg-surface-secondary text-secondary',
        success: 'border-transparent bg-success-soft text-success-foreground',
        info: 'border-transparent bg-info-soft text-info-foreground',
        warning: 'border-transparent bg-warning-soft text-warning-foreground',
        danger: 'border-transparent bg-danger-soft text-danger-foreground',
        destructive: 'border-transparent bg-danger-soft text-danger-foreground',
        outline: 'border-default bg-surface text-secondary',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
