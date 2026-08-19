import { useCallback, useEffect, useRef, type RefObject } from 'react'
import type { MapRef, ViewStateChangeEvent } from 'react-map-gl/maplibre'

export type ComparisonPaneId = 'primary' | 'comparison'

export interface MapCameraSnapshot {
  longitude: number
  latitude: number
  zoom: number
  bearing: number
  pitch: number
}

type CameraListener = (camera: MapCameraSnapshot) => void

/**
 * Bus imperativo y local al visor. Evita renderizar ambos dashboards en cada frame
 * mientras el usuario arrastra el mapa y mantiene la sincronizacion fuera del GIS.
 */
export interface MapCameraSyncGroup {
  publish: (source: ComparisonPaneId, camera: MapCameraSnapshot) => void
  subscribe: (pane: ComparisonPaneId, listener: CameraListener) => () => void
}

export interface MapCameraSyncBinding {
  group: MapCameraSyncGroup
  pane: ComparisonPaneId
}

export function createMapCameraSyncGroup(): MapCameraSyncGroup {
  const listeners = new Map<ComparisonPaneId, Set<CameraListener>>()
  let latest: { source: ComparisonPaneId; camera: MapCameraSnapshot } | null = null

  return {
    publish(source, camera) {
      latest = { source, camera }
      for (const [pane, paneListeners] of listeners) {
        if (pane === source) continue
        for (const listener of paneListeners) listener(camera)
      }
    },
    subscribe(pane, listener) {
      const paneListeners = listeners.get(pane) ?? new Set<CameraListener>()
      paneListeners.add(listener)
      listeners.set(pane, paneListeners)

      if (latest && latest.source !== pane) listener(latest.camera)

      return () => {
        paneListeners.delete(listener)
        if (paneListeners.size === 0) listeners.delete(pane)
      }
    },
  }
}

/**
 * Enlaza un MapLibre no controlado con el bus A/B. Los movimientos recibidos se
 * aplican con jumpTo para que no haya retraso visual ni animaciones encadenadas.
 */
export function useMapCameraSync(mapRef: RefObject<MapRef | null>, binding?: MapCameraSyncBinding) {
  const applyingRemoteCamera = useRef(false)

  useEffect(() => {
    if (!binding) return

    return binding.group.subscribe(binding.pane, (camera) => {
      const map = mapRef.current?.getMap()
      if (!map) return

      applyingRemoteCamera.current = true
      map.jumpTo({
        center: [camera.longitude, camera.latitude],
        zoom: camera.zoom,
        bearing: camera.bearing,
        pitch: camera.pitch,
      })
      applyingRemoteCamera.current = false
    })
  }, [binding, mapRef])

  return useCallback(
    (event: ViewStateChangeEvent) => {
      if (!binding || applyingRemoteCamera.current) return
      const { longitude, latitude, zoom, bearing, pitch } = event.viewState
      binding.group.publish(binding.pane, { longitude, latitude, zoom, bearing, pitch })
    },
    [binding]
  )
}
