import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { NdviSessionsPanel } from './NdviSessionsPanel'

const headers = vi.fn()
vi.mock('../hooks/useNdviSessionHeaders', () => ({
  useNdviSessionHeaders: () => ({ data: headers(), isLoading: false }),
}))

function renderPanel(data: unknown[]) {
  headers.mockReturnValue(data)
  render(
    <NdviSessionsPanel
      plotId="plot-1"
      selectedSessionId={null}
      onSelectSession={vi.fn()}
      floating={false}
    />,
  )
}

/**
 * Esta lista es donde se comparan fechas ENTRE SI, y por eso es donde la procedencia
 * importa mas: GAP-SN-001 establece MEDIDO que red_edge, ndre y psri no son comparables
 * entre CSV y Sentinel (sesgo sistematico de -0.0867 contra B05). Sin distinguir el origen,
 * una serie mezclada ensena un escalon que parece un evento agronomico y no lo es.
 */
describe('NdviSessionsPanel — procedencia (GAP-SN-006)', () => {
  it('distingue las sesiones de satelite de las del proveedor', () => {
    renderPanel([
      { id: 's1', session_date: '2024-10-25', points_count: '4303', source: 'sentinel2' },
      { id: 's2', session_date: '2024-09-01', points_count: '1024', source: 'csv' },
    ])

    expect(screen.getByText('Sentinel-2')).toBeInTheDocument()
    expect(screen.getByText('CSV')).toBeInTheDocument()
  })

  it('no inventa un origen cuando el backend no lo manda', () => {
    renderPanel([{ id: 's1', session_date: '2024-10-25', points_count: '10', source: null }])

    expect(screen.queryByText('Sentinel-2')).not.toBeInTheDocument()
    expect(screen.queryByText('CSV')).not.toBeInTheDocument()
    expect(screen.queryByText('Sin origen')).not.toBeInTheDocument()
    // La sesion sigue siendo utilizable: lo que falta es la etiqueta, no la sesion.
    expect(screen.getByText('2024-10-25')).toBeInTheDocument()
  })
})
