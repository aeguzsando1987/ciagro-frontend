import type { HTMLAttributes } from 'react'

import { GpaLoader } from '@/components/ui/gpa-loader'
import { cn } from '@/lib/utils'

function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn('animate-pulse rounded-md bg-surface-secondary', className)}
      {...props}
    />
  )
}

interface TableSkeletonProps {
  rows?: number
  columns?: number
  label?: string
  className?: string
}

function TableSkeleton({
  rows = 5,
  columns = 4,
  label = 'Cargando tabla…',
  className,
}: TableSkeletonProps) {
  return (
    <div
      role="status"
      aria-label={label}
      className={cn('overflow-hidden rounded-xl border border-default bg-surface', className)}
    >
      <span className="sr-only">{label}</span>
      <div className="flex h-11 items-center gap-2 border-b border-border-light bg-table-header px-4 text-xs font-medium text-secondary">
        <GpaLoader size="sm" />
        <span>{label}</span>
      </div>
      <div
        className="grid h-11 items-center gap-4 bg-table-header px-4"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: columns }).map((_, index) => (
          <Skeleton key={index} className="h-3 w-2/3" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div
          key={rowIndex}
          className="grid h-[52px] items-center gap-4 border-t border-border-light px-4"
          style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: columns }).map((__, columnIndex) => (
            <Skeleton
              key={columnIndex}
              className={cn('h-3', columnIndex === 0 ? 'w-4/5' : 'w-3/5')}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

interface ListSkeletonProps {
  rows?: number
  label?: string
  compact?: boolean
  className?: string
}

function ListSkeleton({
  rows = 4,
  label = 'Cargando lista…',
  compact,
  className,
}: ListSkeletonProps) {
  return (
    <div role="status" aria-label={label} className={cn('space-y-1 p-2', className)}>
      <span className="sr-only">{label}</span>
      <div className="flex items-center gap-2 px-2 py-1 text-xs font-medium text-secondary">
        <GpaLoader size="sm" />
        <span>{label}</span>
      </div>
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className={cn('flex items-center gap-3 px-2', compact ? 'h-9' : 'h-12')}>
          <Skeleton className={cn('shrink-0 rounded-lg', compact ? 'h-7 w-7' : 'h-9 w-9')} />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-3 w-2/3" />
            {!compact && <Skeleton className="h-2.5 w-1/3" />}
          </div>
        </div>
      ))}
    </div>
  )
}

export { Skeleton, TableSkeleton, ListSkeleton }
