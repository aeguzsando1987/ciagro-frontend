import type { HTMLAttributes, ReactNode } from 'react'

import { cn } from '@/lib/utils'

export interface FormSectionProps extends HTMLAttributes<HTMLElement> {
  title: string
  description?: string
  children: ReactNode
}

function FormSection({ title, description, children, className, ...props }: FormSectionProps) {
  return (
    <section className={cn('space-y-4', className)} {...props}>
      <div className="space-y-1 border-b border-border-light pb-3">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {description && <p className="text-sm leading-5 text-secondary">{description}</p>}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  )
}

export { FormSection }
