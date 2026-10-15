import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, describe, expect, it } from 'vitest'

import { TruncatedText } from './truncated-text'

/**
 * El Explorador del Visor corta los nombres largos ("Ciclo productivo Primavera-Invierno
 * 2025") por el ancho del panel. Se protege que el texto completo se pueda leer al pasar
 * el ratón, y que las filas que caben no muestren tooltip.
 */

beforeAll(() => {
  // Radix posiciona el tooltip con ResizeObserver, que jsdom no implementa.
  if (!('ResizeObserver' in window)) {
    class ResizeObserverStub {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    ;(window as unknown as { ResizeObserver: unknown }).ResizeObserver = ResizeObserverStub
  }
})

/** jsdom no maqueta: se simula el ancho del texto frente al de su caja. */
function simularAnchos(el: HTMLElement, scrollWidth: number, clientWidth: number) {
  Object.defineProperty(el, 'scrollWidth', { configurable: true, value: scrollWidth })
  Object.defineProperty(el, 'clientWidth', { configurable: true, value: clientWidth })
}

const LARGO = 'Ciclo productivo Primavera-Invierno 2025'

describe('TruncatedText', () => {
  it('muestra el texto completo en un tooltip cuando está cortado', async () => {
    const user = userEvent.setup()
    render(<TruncatedText text={LARGO} delayDuration={0} />)
    const texto = screen.getByText(LARGO)
    simularAnchos(texto, 320, 180)

    await user.hover(texto)

    const tooltip = await screen.findByRole('tooltip')
    expect(tooltip).toHaveTextContent(LARGO)
  })

  it('no muestra tooltip cuando el texto cabe', async () => {
    const user = userEvent.setup()
    render(<TruncatedText text="Generales" delayDuration={0} />)
    const texto = screen.getByText('Generales')
    simularAnchos(texto, 80, 180)

    await user.hover(texto)

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })

  it('conserva el corte con puntos suspensivos y acepta clases extra', () => {
    render(<TruncatedText text={LARGO} className="font-medium" />)
    const texto = screen.getByText(LARGO)
    expect(texto).toHaveClass('truncate')
    expect(texto).toHaveClass('font-medium')
  })
})
