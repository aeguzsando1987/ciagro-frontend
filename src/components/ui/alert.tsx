import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const alertVariants = cva(
  'relative w-full rounded-lg border p-4 text-sm [&>svg~*]:pl-7 [&>svg+div]:translate-y-[-2px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:size-4',
  {
    variants: {
      variant: {
        default: 'border-default bg-surface text-foreground [&>svg]:text-secondary',
        success: 'border-success/20 bg-success-soft text-success-foreground [&>svg]:text-success',
        info: 'border-info/20 bg-info-soft text-info-foreground [&>svg]:text-info',
        warning: 'border-warning/25 bg-warning-soft text-warning-foreground [&>svg]:text-warning',
        danger: 'border-danger/20 bg-danger-soft text-danger-foreground [&>svg]:text-danger',
        destructive: 'border-danger/20 bg-danger-soft text-danger-foreground [&>svg]:text-danger',
      },
    },
    defaultVariants: { variant: 'default' },
  }
)

const Alert = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>
>(({ className, variant, ...props }, ref) => (
  <div ref={ref} role="alert" className={cn(alertVariants({ variant }), className)} {...props} />
))
Alert.displayName = 'Alert'

const AlertTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h5 ref={ref} className={cn('mb-1 font-semibold leading-5', className)} {...props} />
  )
)
AlertTitle.displayName = 'AlertTitle'

const AlertDescription = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('leading-5 [&_p]:leading-5', className)} {...props} />
  )
)
AlertDescription.displayName = 'AlertDescription'

export { Alert, AlertTitle, AlertDescription, alertVariants }
