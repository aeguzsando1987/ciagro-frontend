import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/features/geodata-visor/components/SoilMap', () => ({
  SoilMap: ({
    toolbarStart,
    toolbarEnd,
  }: {
    toolbarStart?: React.ReactNode
    toolbarEnd?: React.ReactNode
  }) => (
    <div data-testid="soil-map">
      {toolbarStart}
      {toolbarEnd}
    </div>
  ),
}))

import { SoilMapMapModal } from './SoilMapMapModal'

describe('SoilMapMapModal', () => {
  it('monta el visor y permite cerrarlo con su botón', () => {
    const onClose = vi.fn()
    render(<SoilMapMapModal open onClose={onClose} sessionId="soil-header-1" plotId="plot-1" />)

    expect(screen.getByTestId('soil-map')).toBeInTheDocument()
    expect(screen.getByText('Mapa de suelo')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '✕ Cerrar' }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('no monta el visor cuando está cerrado', () => {
    render(
      <SoilMapMapModal open={false} onClose={vi.fn()} sessionId="soil-header-1" plotId="plot-1" />
    )

    expect(screen.queryByTestId('soil-map')).not.toBeInTheDocument()
  })
})
