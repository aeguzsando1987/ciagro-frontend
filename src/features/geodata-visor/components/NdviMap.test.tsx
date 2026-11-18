import { forwardRef, useImperativeHandle, type ReactNode } from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const map = vi.hoisted(() => ({
  fitBounds: vi.fn(), resize: vi.fn(), loaded: vi.fn(() => true),
  isMoving: vi.fn(() => false), once: vi.fn(), off: vi.fn(),
  getLayer: vi.fn(() => true), setLayoutProperty: vi.fn(), isStyleLoaded: vi.fn(() => true),
}))
vi.mock('react-map-gl/maplibre', () => ({
  default: forwardRef(({ children }: { children: ReactNode }, ref) => {
    useImperativeHandle(ref, () => ({ ...map, getMap: () => map }), [])
    return <div data-testid="map">{children}</div>
  }),
  Source: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Layer: () => null,
  Popup: () => null,
}))
const plot = { geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] } }
const points = [
  { id: 'p1', geom: { type: 'Point', coordinates: [0, 0] }, ndvi: 0.2 },
  { id: 'p2', geom: { type: 'Point', coordinates: [1, 0] }, ndvi: 0.5 },
  { id: 'p3', geom: { type: 'Point', coordinates: [1, 1] }, ndvi: 0.8 },
]
vi.mock('@/features/task-manager/hooks/usePlotGeometry', () => ({
  usePlotGeometry: () => ({ data: plot, isLoading: false }),
}))
vi.mock('../hooks/useNdviPoints', () => ({
  useNdviPoints: () => ({ data: points, isLoading: false }),
}))
vi.mock('../hooks/useNdviInterpolatedSurface', () => ({
  useNdviInterpolatedSurface: ({ sessionId, indexKey }: { sessionId: string; indexKey: string }) => ({
    data: null, isPending: false, isError: false, contentKey: `${sessionId}:${indexKey}`,
  }),
}))
vi.mock('../hooks/useNdviVariableConfig', async (original) => ({
  ...await original<typeof import('../hooks/useNdviVariableConfig')>(),
  useNdviSessionVariableConfig: () => ({ data: undefined, isLoading: false }),
}))
vi.mock('@/features/task-manager/hooks/useNdviVariableStats', () => ({
  useNdviVariableStats: () => ({ data: undefined, isLoading: false }),
}))
vi.mock('@/features/task-manager/hooks/useNdviSessionDetail', () => ({
  useNdviSessionDetail: () => ({ data: undefined }),
}))

import { NdviMap } from './NdviMap'

let notifyResize: () => void
describe('estado visual del mapa NDVI', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    sessionStorage.clear()
    vi.stubGlobal('ResizeObserver', class {
      constructor(callback: () => void) { notifyResize = callback }
      observe() {}
      disconnect() {}
    })
  })
  afterEach(() => vi.unstubAllGlobals())

  it('conserva cámara, índice y modo al cambiar sesión o tamaño, y confirma cada render', async () => {
    const onReadyChange = vi.fn()
    const { rerender } = render(<NdviMap sessionId="n1" plotId="plot" onReadyChange={onReadyChange} showMapModeSelector />)
    await waitFor(() => expect(onReadyChange).toHaveBeenLastCalledWith(true, 'n1'))
    expect(map.fitBounds).toHaveBeenCalledOnce()
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'osavi' } })
    expect(onReadyChange).toHaveBeenLastCalledWith(false, 'n1')
    await waitFor(() => expect(onReadyChange).toHaveBeenLastCalledWith(true, 'n1'))
    fireEvent.click(screen.getByRole('button', { name: 'Mapa' }))
    expect(map.setLayoutProperty).toHaveBeenCalledWith('esri-places', 'visibility', 'visible')
    rerender(<NdviMap sessionId="n2" plotId="plot" onReadyChange={onReadyChange} showMapModeSelector />)
    expect(onReadyChange).toHaveBeenLastCalledWith(false, 'n2')
    await waitFor(() => expect(onReadyChange).toHaveBeenLastCalledWith(true, 'n2'))
    expect(screen.getByRole('combobox')).toHaveValue('osavi')
    act(() => notifyResize())
    await waitFor(() => expect(map.resize).toHaveBeenCalledOnce())
    expect(map.fitBounds).toHaveBeenCalledOnce()
    expect(map.setLayoutProperty).toHaveBeenLastCalledWith('esri-places', 'visibility', 'visible')
  })
})
