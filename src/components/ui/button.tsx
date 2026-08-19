import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-primary-foreground shadow-xs hover:bg-primary-hover',
        default: 'bg-primary text-primary-foreground shadow-xs hover:bg-primary-hover',
        secondary:
          'border border-default bg-surface text-control shadow-xs hover:bg-background hover:text-foreground',
        outline:
          'border border-default bg-surface text-control shadow-xs hover:bg-background hover:text-foreground',
        ghost: 'bg-transparent text-foreground hover:bg-primary-soft hover:text-primary-hover',
        danger: 'bg-danger text-white shadow-xs hover:bg-danger/90',
        destructive: 'bg-danger text-white shadow-xs hover:bg-danger/90',
        link: 'h-auto rounded-sm p-0 text-brand underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-4',
        sm: 'h-10 px-3',
        lg: 'h-11 px-5',
        icon: 'h-10 w-10 p-0',
        'icon-sm': 'h-10 w-10 rounded-md p-0',
        'icon-lg': 'h-11 w-11 p-0',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp ref={ref} className={cn(buttonVariants({ variant, size, className }))} {...props} />
    )
  }
)
Button.displayName = 'Button'

export { Button, buttonVariants }
