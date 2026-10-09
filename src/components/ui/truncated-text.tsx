import * as React from 'react'

import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './tooltip'

/** El texto no cabe en su caja: hay contenido oculto por el corte. */
function isTruncated(el: HTMLElement | null): boolean {
  return el !== null && el.scrollWidth > el.clientWidth
}

export interface TruncatedTextProps {
  text: string
  className?: string
  /** Lado del tooltip. Por defecto a la derecha: en un panel lateral no tapa el texto. */
  side?: 'top' | 'right' | 'bottom' | 'left'
  /** Espera antes de mostrarlo, en ms. */
  delayDuration?: number
}

/**
 * Texto de una sola línea que se corta con "…" y, SOLO si de verdad quedó cortado,
 * muestra el texto completo en un tooltip al pasar el ratón.
 *
 * Nace en el Explorador del Visor: "Ciclo productivo Primavera-Invierno 2025" no cabe
 * en el ancho del panel y no había forma de leerlo. Las filas que caben no muestran
 * nada, para no llenar el árbol de globos.
 *
 * Lleva su propio `TooltipProvider`: Radix exige uno y hay vistas (y tests) que montan
 * estos componentes fuera del de `App.tsx`. Anidar proveedores es válido en Radix.
 */
export function TruncatedText({
  text,
  className,
  side = 'right',
  delayDuration = 300,
}: TruncatedTextProps) {
  const ref = React.useRef<HTMLSpanElement>(null)
  const [open, setOpen] = React.useState(false)

  return (
    <TooltipProvider delayDuration={delayDuration}>
      <Tooltip
        open={open}
        // Se mide al intentar abrir: si el texto cabe, el tooltip no se abre.
        onOpenChange={(next) => setOpen(next && isTruncated(ref.current))}
      >
        <TooltipTrigger asChild>
          <span ref={ref} className={cn('truncate', className)}>
            {text}
          </span>
        </TooltipTrigger>
        <TooltipContent side={side} align="start">
          {text}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
