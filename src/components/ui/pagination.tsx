import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface PaginationProps {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
  className?: string
  label?: string
}

function visiblePages(page: number, totalPages: number): Array<number | 'ellipsis'> {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1)

  const values = new Set([1, totalPages, page - 1, page, page + 1])
  const ordered = [...values]
    .filter((value) => value >= 1 && value <= totalPages)
    .sort((a, b) => a - b)
  const result: Array<number | 'ellipsis'> = []

  ordered.forEach((value, index) => {
    const previous = ordered[index - 1]
    if (previous && value - previous > 1) result.push('ellipsis')
    result.push(value)
  })

  return result
}

function Pagination({
  page,
  totalPages,
  onPageChange,
  className,
  label = 'Paginación',
}: PaginationProps) {
  const safeTotal = Math.max(1, totalPages)
  const safePage = Math.min(Math.max(1, page), safeTotal)

  return (
    <nav aria-label={label} className={cn('flex items-center justify-center gap-1', className)}>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Página anterior"
        disabled={safePage === 1}
        onClick={() => onPageChange(safePage - 1)}
      >
        <ChevronLeft />
      </Button>
      {visiblePages(safePage, safeTotal).map((item, index) =>
        item === 'ellipsis' ? (
          <span
            key={`ellipsis-${index}`}
            aria-hidden="true"
            className="flex h-8 w-8 items-center justify-center text-muted"
          >
            <MoreHorizontal className="h-4 w-4" />
          </span>
        ) : (
          <Button
            key={item}
            type="button"
            variant={item === safePage ? 'primary' : 'ghost'}
            size="icon-sm"
            aria-label={`Página ${item}`}
            aria-current={item === safePage ? 'page' : undefined}
            onClick={() => onPageChange(item)}
          >
            {item}
          </Button>
        )
      )}
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Página siguiente"
        disabled={safePage === safeTotal}
        onClick={() => onPageChange(safePage + 1)}
      >
        <ChevronRight />
      </Button>
    </nav>
  )
}

export { Pagination }
