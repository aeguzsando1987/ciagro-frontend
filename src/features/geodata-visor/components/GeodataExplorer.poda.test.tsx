/**
 * Poda de ramas vacías del explorador (fase PS).
 *
 * El árbol del Visor existe para llegar a las sesiones de una parcela. Un productor sin
 * ranchos, o un rancho sin parcelas visibles, no lleva a ninguna: pintarlo con un "Sin
 * ranchos" debajo es ruido, y en un usuario delimitado además delata que ahí hay algo
 * que no puede ver.
 *
 * Para saber si un nodo tiene contenido hay que preguntarlo ANTES de pintarlo, así que
 * cada nivel pide sus nietos en una sola petición por lote (`?producer_in`, `?ranch_in`)
 * en vez de una por nodo. Estos tests fijan ese comportamiento.
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const ranchesMock = vi.hoisted(() => vi.fn())
const plotsMock = vi.hoisted(() => vi.fn())

vi.mock('@/features/admin/hooks/useDataCentrals', () => ({
  useDataCentralMains: () => ({
    data: [{ id: 'org-1', name: 'Organización Uno', datacentrals_count: '1' }],
    isLoading: false,
    error: null,
  }),
  useDataCentrals: () => ({
    data: [{ id: 'dc-1', name: 'CIAgro Hija A' }],
    isLoading: false,
    error: null,
  }),
}))
vi.mock('@/features/admin/hooks/useProducers', () => ({
  useProducers: () => ({
    data: [
      { id: 'prod-con', commercial_name: 'Productor Con Ranchos', code: 'PC' },
      { id: 'prod-sin', commercial_name: 'Productor Sin Ranchos', code: 'PS' },
    ],
    isLoading: false,
  }),
}))
vi.mock('@/features/admin/hooks/useRanches', () => ({ useRanches: ranchesMock }))
vi.mock('@/features/admin/hooks/usePlots', () => ({ usePlots: plotsMock }))
vi.mock('../hooks/useAspersionSessionHeaders', () => ({
  useAspersionSessionHeaders: () => ({ data: [], isLoading: false }),
}))
vi.mock('../hooks/usePhytoSessionHeaders', () => ({
  usePhytoSessionHeaders: () => ({ data: [], isLoading: false }),
}))
vi.mock('../hooks/useNdviSessionHeaders', () => ({
  useNdviSessionHeaders: () => ({ data: [], isLoading: false }),
}))
vi.mock('../hooks/useSoilMapSessionHeaders', () => ({
  useSoilMapSessionHeaders: () => ({ data: [], isLoading: false }),
}))

import { GeodataExplorer } from './GeodataExplorer'

/** Expande organización -> CIAgro para llegar al nivel de productores. */
async function abrirHastaProductores() {
  render(<GeodataExplorer selection={null} onSelect={vi.fn()} />)
  fireEvent.click(screen.getAllByLabelText('Expandir')[0]!)
  await waitFor(() => expect(screen.getByText('CIAgro Hija A')).toBeTruthy())
  fireEvent.click(screen.getAllByLabelText('Expandir')[0]!)
}

describe('GeodataExplorer — poda de ramas vacías', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ranchesMock.mockReturnValue({ data: [], isLoading: false, isError: false })
    plotsMock.mockReturnValue({ data: [], isLoading: false, isError: false })
  })

  it('omite el productor que no tiene ningún rancho', async () => {
    ranchesMock.mockReturnValue({
      data: [{ id: 'r-1', name: 'Rancho Uno', code: 'R1', producer: 'prod-con' }],
      isLoading: false,
      isError: false,
    })
    await abrirHastaProductores()

    // Control positivo: el que SI tiene ranchos se pinta. Sin esta mitad, el test
    // pasaria igual si no se pintara ninguno.
    await waitFor(() => expect(screen.getByText('Productor Con Ranchos')).toBeTruthy())
    expect(screen.queryByText('Productor Sin Ranchos')).toBeNull()
  })

  it('pide los ranchos de toda la CIAgro en UNA petición por lote', async () => {
    ranchesMock.mockReturnValue({
      data: [{ id: 'r-1', name: 'Rancho Uno', code: 'R1', producer: 'prod-con' }],
      isLoading: false,
      isError: false,
    })
    await abrirHastaProductores()

    await waitFor(() => expect(screen.getByText('Productor Con Ranchos')).toBeTruthy())
    // Por lote: `producerIds` con los dos productores, no una llamada por cada uno.
    expect(ranchesMock).toHaveBeenCalledWith(null, ['prod-con', 'prod-sin'])
  })

  it('omite el rancho que no tiene ninguna parcela visible', async () => {
    ranchesMock.mockReturnValue({
      data: [
        { id: 'r-con', name: 'Rancho Con Parcelas', code: 'RC', producer: 'prod-con' },
        { id: 'r-sin', name: 'Rancho Sin Parcelas', code: 'RS', producer: 'prod-con' },
      ],
      isLoading: false,
      isError: false,
    })
    plotsMock.mockReturnValue({
      data: [{ id: 'p-1', code: 'P-001', ranch: 'r-con' }],
      isLoading: false,
      isError: false,
    })
    await abrirHastaProductores()

    await waitFor(() => expect(screen.getByText('Productor Con Ranchos')).toBeTruthy())
    fireEvent.click(screen.getAllByLabelText('Expandir')[0]!)

    await waitFor(() => expect(screen.getByText('Rancho Con Parcelas')).toBeTruthy())
    expect(screen.queryByText('Rancho Sin Parcelas')).toBeNull()
  })

  it('cuando ningún productor tiene ranchos lo dice, en vez de dejar el nivel mudo', async () => {
    await abrirHastaProductores()
    await waitFor(() =>
      expect(screen.getByText('Sin productores con ranchos.')).toBeTruthy()
    )
  })
})
