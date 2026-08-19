import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { MapRef, ViewStateChangeEvent } from 'react-map-gl/maplibre'
import { createMapCameraSyncGroup, useMapCameraSync, type MapCameraSnapshot } from './mapCameraSync'

const camera: MapCameraSnapshot = {
  longitude: -106.1,
  latitude: 28.6,
  zoom: 14,
  bearing: 22,
  pitch: 35,
}

describe('createMapCameraSyncGroup', () => {
  it('refleja la camara al panel opuesto, no al panel que la emitio', () => {
    const group = createMapCameraSyncGroup()
    const primary = vi.fn()
    const comparison = vi.fn()
    group.subscribe('primary', primary)
    group.subscribe('comparison', comparison)

    group.publish('primary', camera)

    expect(primary).not.toHaveBeenCalled()
    expect(comparison).toHaveBeenCalledWith(camera)
  })

  it('entrega la ultima camara a un segundo mapa que se monta despues', () => {
    const group = createMapCameraSyncGroup()
    group.publish('primary', camera)
    const comparison = vi.fn()

    group.subscribe('comparison', comparison)

    expect(comparison).toHaveBeenCalledOnce()
    expect(comparison).toHaveBeenCalledWith(camera)
  })

  it('deja de notificar cuando el mapa se desmonta', () => {
    const group = createMapCameraSyncGroup()
    const comparison = vi.fn()
    const unsubscribe = group.subscribe('comparison', comparison)
    unsubscribe()

    group.publish('primary', camera)

    expect(comparison).not.toHaveBeenCalled()
  })

  it('aplica paneo, zoom, rotacion e inclinacion al MapLibre opuesto', () => {
    const group = createMapCameraSyncGroup()
    const jumpTo = vi.fn()
    const comparisonRef = {
      current: { getMap: () => ({ jumpTo }) },
    } as unknown as React.RefObject<MapRef | null>
    const primaryRef = { current: null } as React.RefObject<MapRef | null>

    renderHook(() => useMapCameraSync(comparisonRef, { group, pane: 'comparison' }))
    const primary = renderHook(() => useMapCameraSync(primaryRef, { group, pane: 'primary' }))

    act(() => {
      primary.result.current({ viewState: camera } as ViewStateChangeEvent)
    })

    expect(jumpTo).toHaveBeenCalledWith({
      center: [camera.longitude, camera.latitude],
      zoom: camera.zoom,
      bearing: camera.bearing,
      pitch: camera.pitch,
    })
  })
})
