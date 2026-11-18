/** Avisa cuándo los datos de la sesión y MapLibre terminaron de renderizarse.
 * Sólo se activa si el visor aporta onReadyChange; los demás usos de estos mapas
 * (task-manager, reportes y comparación) conservan su comportamiento anterior.
 */
import { useCallback, useEffect, useRef } from 'react'
import type { MapRef } from 'react-map-gl/maplibre'

export type OnSessionMapReady = (ready: boolean, sessionId: string) => void

export function useSessionMapReady(
  mapRef: React.RefObject<MapRef | null>,
  sessionId: string,
  contentReady: boolean,
  onReadyChange?: OnSessionMapReady,
  contentKey: string = sessionId,
) {
  const readyRef = useRef(contentReady)
  const reportedRef = useRef<string | null>(null)
  readyRef.current = contentReady

  const markReady = useCallback(() => {
    if (!onReadyChange || !readyRef.current || reportedRef.current === sessionId) return
    const map = mapRef.current?.getMap()
    if (!map || !map.loaded() || map.isMoving()) return
    reportedRef.current = sessionId
    onReadyChange(true, sessionId)
  }, [mapRef, onReadyChange, sessionId])

  useEffect(() => {
    reportedRef.current = null
    onReadyChange?.(false, sessionId)
  }, [onReadyChange, sessionId, contentReady, contentKey])

  useEffect(() => {
    if (!onReadyChange || !contentReady || reportedRef.current === sessionId) return
    let cancelled = false
    let map = mapRef.current?.getMap()
    const onIdle = () => { if (!cancelled) markReady() }
    const frame = requestAnimationFrame(() => {
      if (cancelled) return
      map = mapRef.current?.getMap()
      if (!map) return
      if (map.loaded() && !map.isMoving()) markReady()
      else map.once('idle', onIdle)
    })
    return () => {
      cancelled = true
      cancelAnimationFrame(frame)
      map?.off('idle', onIdle)
    }
  }, [mapRef, sessionId, contentReady, contentKey, onReadyChange, markReady])

  return markReady
}
