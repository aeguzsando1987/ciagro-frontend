import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { VisorBreadcrumb } from './VisorBreadcrumb'
import type { VisorSelection } from '../types'

const EN_SESION: VisorSelection = {
  level: 'session',
  org: { id: 'org-1', name: 'Organización Uno' },
  datacentral: { id: 'dc-1', name: 'CIAgro Norte' },
  producer: { id: 'ag-1', name: 'Agrounidad Uno' },
  ranch: { id: 'r-1', name: 'Rancho Norte' },
  plot: { id: 'p-1', name: 'P-001' },
  session: { id: 's-1', kind: 'aspersion', date: '2026-03-10' },
}

describe('VisorBreadcrumb', () => {
  it('muestra la ruta completa desde la organización', () => {
    render(<VisorBreadcrumb selection={EN_SESION} onSelect={vi.fn()} />)
    for (const nombre of ['Organización Uno', 'CIAgro Norte', 'Agrounidad Uno', 'Rancho Norte', 'P-001']) {
      expect(screen.getByText(nombre)).toBeInTheDocument()
    }
  })

  it('los escalones anteriores son navegables', async () => {
    // Es lo que convierte las migas en algo util y no en un adorno: pulsar un ancestro
    // sube a ese nivel, y con ello son el camino de vuelta al panel de la CIAgro.
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(<VisorBreadcrumb selection={EN_SESION} onSelect={onSelect} />)

    await user.click(screen.getByText('CIAgro Norte'))

    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        level: 'datacentral',
        datacentral: { id: 'dc-1', name: 'CIAgro Norte' },
      })
    )
    // Y no arrastra lo que colgaba por debajo.
    expect(onSelect.mock.calls[0]![0]).not.toHaveProperty('ranch', expect.anything())
  })

  it('el escalón actual NO es navegable: ya se está ahí', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(<VisorBreadcrumb selection={EN_SESION} onSelect={onSelect} />)

    await user.click(screen.getByText('2026-03-10'))

    expect(onSelect).not.toHaveBeenCalled()
  })
})
