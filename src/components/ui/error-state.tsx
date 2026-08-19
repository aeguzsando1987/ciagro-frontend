import type { ReactNode } from 'react'
import { AlertTriangle, RotateCw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface ErrorStateProps {
  title: string
  description?: string
  onRetry?: () => void
  retryLabel?: string
  icon?: ReactNode
  compact?: boolean
  className?: string
}

function ErrorState({
  title,
  description,
  onRetry,
  retryLabel = 'Reintentar',
  icon = <AlertTriangle />,
  compact,
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        'flex w-full flex-col items-center justify-center text-center',
        compact ? 'gap-2 px-4 py-6' : 'gap-3 px-6 py-10',
        className
      )}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-danger-soft text-danger [&_svg]:h-5 [&_svg]:w-5">
        {icon}
      </div>
      <div className="max-w-md space-y-1">
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        {description && <p className="text-sm leading-5 text-secondary">{description}</p>}
      </div>
      {onRetry && (
        <Button type="button" variant="secondary" size="sm" onClick={onRetry}>
          <RotateCw className="h-4 w-4" />
          {retryLabel}
        </Button>
      )}
    </div>
  )
}

export { ErrorState }
