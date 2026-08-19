import { useEffect, useState } from 'react'
import { ImageOff } from 'lucide-react'

import { cn } from '@/lib/utils'

export interface SafeImageProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  src?: string | null
  fallbackLabel?: string
  fallbackClassName?: string
}

function SafeImage({
  src,
  alt,
  className,
  fallbackLabel,
  fallbackClassName,
  onError,
  ...props
}: SafeImageProps) {
  const [failed, setFailed] = useState(!src)

  useEffect(() => setFailed(!src), [src])

  if (failed) {
    return (
      <div
        role="img"
        aria-label={fallbackLabel ?? `Sin fotografía de ${alt}`}
        className={cn(
          'flex items-center justify-center bg-primary-soft text-primary',
          className,
          fallbackClassName
        )}
      >
        <ImageOff aria-hidden="true" className="h-4 w-4" />
      </div>
    )
  }

  return (
    <img
      src={src ?? undefined}
      alt={alt}
      className={className}
      onError={(event) => {
        setFailed(true)
        onError?.(event)
      }}
      {...props}
    />
  )
}

export { SafeImage }
