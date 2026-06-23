import type { ComponentPropsWithoutRef } from 'react'
import { Tabs } from './tabs'
import { AnimatedHeight } from './animated-height'

/**
 * `Tabs` cuyo contenedor **anima la altura** al cambiar de pestaña, en lugar de
 * saltar de golpe. Pensado para modales: reemplaza a `Tabs` y el alto del modal
 * transiciona suavemente cuando el contenido de la pestaña activa cambia de tamaño.
 * Respeta `prefers-reduced-motion`.
 */
export function AnimatedTabs(props: ComponentPropsWithoutRef<typeof Tabs>) {
  return (
    <AnimatedHeight>
      <Tabs {...props} />
    </AnimatedHeight>
  )
}
