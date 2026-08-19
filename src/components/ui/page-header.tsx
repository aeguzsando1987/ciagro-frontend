import type { ElementType, ReactNode } from 'react'

import { cn } from '@/lib/utils'

export interface PageHeaderProps {
  title: string
  description?: string
  eyebrow?: string
  actions?: ReactNode
  breadcrumbs?: ReactNode
  /** @deprecated Usa `breadcrumbs`. Se conserva para compatibilidad. */
  breadcrumb?: ReactNode
  className?: string
  as?: ElementType
}

function PageHeader({
  title,
  description,
  eyebrow,
  actions,
  breadcrumbs,
  breadcrumb,
  className,
  as: Heading = 'h1',
}: PageHeaderProps) {
  const trail = breadcrumbs ?? breadcrumb

  return (
    <header className={cn('space-y-4', className)}>
      {trail}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          {eyebrow && (
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-brand">
              {eyebrow}
            </p>
          )}
          <Heading className="text-page-title tracking-tight text-foreground">{title}</Heading>
          {description && (
            <p className="max-w-3xl text-sm leading-5 text-secondary">{description}</p>
          )}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  )
}

export { PageHeader }
