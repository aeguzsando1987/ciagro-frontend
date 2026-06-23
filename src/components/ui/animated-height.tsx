import { useEffect, useRef, useState, type ReactNode } from 'react'

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true

/**
 * Contenedor que **anima su altura** cuando su contenido cambia de tamaño
 * (p. ej. al cambiar de pestaña en un modal). Mide el contenido con un
 * ResizeObserver y transiciona la altura del envoltorio entre el valor anterior y
 * el nuevo. El primer render fija la altura sin animar; respeta `prefers-reduced-motion`.
 *
 * Nota: el envoltorio iguala su altura a la del contenido en reposo (no recorta),
 * así que un contenedor padre con scroll (p. ej. `DialogContent` con
 * `overflow-y-auto`) sigue funcionando para contenido alto.
 */
export function AnimatedHeight({ children, className }: { children: ReactNode; className?: string }) {
  const innerRef = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState<number | 'auto'>('auto')

  useEffect(() => {
    const el = innerRef.current
    if (!el) return
    const update = () => setHeight(el.getBoundingClientRect().height)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return (
    <div
      className={className}
      style={{
        height,
        overflow: 'hidden',
        transition: prefersReducedMotion() ? undefined : 'height 220ms ease',
      }}
    >
      <div ref={innerRef}>{children}</div>
    </div>
  )
}
