import type { ElementType, ReactNode } from 'react'

import { cn } from '@/lib/utils'

export interface SectionHeaderProps {
  title: string
  description?: string
  actions?: ReactNode
  className?: string
  as?: ElementType
}

function SectionHeader({
  title,
  description,
  actions,
  className,
  as: Heading = 'h2',
}: SectionHeaderProps) {
  return (
    <div
      className={cn('flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between', className)}
    >
      <div className="min-w-0 space-y-1">
        <Heading className="text-section-title text-foreground">{title}</Heading>
        {description && <p className="text-sm leading-5 text-secondary">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export { SectionHeader }
