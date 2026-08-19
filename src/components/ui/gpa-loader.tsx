import { cn } from '@/lib/utils'

type GpaLoaderSize = 'xs' | 'sm' | 'md' | 'lg'

export interface GpaLoaderProps {
  className?: string
  size?: GpaLoaderSize
}

const sizeClasses: Record<GpaLoaderSize, string> = {
  xs: 'h-5 w-5',
  sm: 'h-7 w-7',
  md: 'h-10 w-10',
  lg: 'h-16 w-16',
}


function GpaLoader({ className, size = 'md' }: GpaLoaderProps) {
  return (
    <span
      aria-hidden="true"
      className={cn('relative inline-flex shrink-0', sizeClasses[size], className)}
    >
      <img
        src="/agroindustry-gear.png"
        alt=""
        className="cia-loader-gear absolute inset-0 h-full w-full select-none object-contain"
        draggable={false}
      />
      <img
        src="/gpa-mark.png"
        alt=""
        className="relative h-full w-full select-none object-contain"
        draggable={false}
      />
    </span>
  )
}

export { GpaLoader }
