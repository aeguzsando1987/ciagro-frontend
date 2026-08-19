import { GpaLoader } from '@/components/ui/gpa-loader'
import { cn } from '@/lib/utils'

export interface LoadingStateProps {
  label?: string
  className?: string
  compact?: boolean
}

function LoadingState({ label = 'Cargando…', className, compact }: LoadingStateProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'flex items-center justify-center gap-2 text-sm text-secondary',
        compact ? 'p-3' : 'min-h-32 p-6',
        className
      )}
    >
      <GpaLoader size={compact ? 'sm' : 'md'} />
      <span className="font-medium">{label}</span>
    </div>
  )
}

export { LoadingState }
