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
  const remoteTarget = useRef<MapCameraSnapshot | null>(null)

  useEffect(() => {
    if (!binding) return

    return binding.group.subscribe(binding.pane, (camera) => {
      const map = mapRef.current?.getMap()
      if (!map) return

      // Guardamos el destino hasta recibir el onMove generado por jumpTo. Poner un
      // booleano a false justo después de jumpTo era demasiado pronto en algunos
      // navegadores y podía provocar rebote A -> B -> A entre los dos mapas.
      remoteTarget.current = camera
      map.jumpTo({
        center: [camera.longitude, camera.latitude],
        zoom: camera.zoom,
        bearing: camera.bearing,
        pitch: camera.pitch,
      })
    })
  }, [binding, mapRef])

  return useCallback(
    (event: ViewStateChangeEvent) => {
      if (!binding) return
      const { longitude, latitude, zoom, bearing, pitch } = event.viewState
      const remote = remoteTarget.current
      if (remote) {
        const same =
          Math.abs(longitude - remote.longitude) < 1e-7 &&
          Math.abs(latitude - remote.latitude) < 1e-7 &&
          Math.abs(zoom - remote.zoom) < 1e-5 &&
          Math.abs(bearing - remote.bearing) < 1e-5 &&
          Math.abs(pitch - remote.pitch) < 1e-5
        remoteTarget.current = null
        if (same) return
      }
      binding.group.publish(binding.pane, { longitude, latitude, zoom, bearing, pitch })
    },
    [binding]
  )
}
