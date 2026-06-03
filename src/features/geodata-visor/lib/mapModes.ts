import { useEffect, useState } from 'react'
import type { RefObject } from 'react'
import type { MapRef } from 'react-map-gl/maplibre'

export type MapModeKey = 'satellite' | 'hybrid'

/**
 * Modos del visor:
 *  - satellite: solo imagen satelital (ESRI World Imagery).
 *  - hybrid:    imagen satelital + capas de referencia (carreteras + etiquetas/lugares).
 *
 * No usamos MapTiler (requiere API key). El modo híbrido se logra superponiendo las
 * capas de referencia GRATUITAS y SIN KEY de ESRI sobre la misma imagen base. Cambiar de
 * modo solo alterna la visibilidad de esas capas → cero remount, cero reordenamiento.
 */
export const MAP_MODES: Record<MapModeKey, { label: string }> = {
  satellite: { label: 'Satélite' },
  hybrid: { label: 'Híbrido' },
}

/** IDs de las capas de referencia que se muestran en modo híbrido (definidas en ESRI_STYLE). */
export const HYBRID_OVERLAY_LAYERS = ['esri-transportation', 'esri-places'] as const

/**
 * Hook compartido por los 3 mapas del visor. Mantiene el modo activo y alterna la
 * visibilidad de las capas de referencia sobre el mapa ya montado.
 *
 * Si el estilo aún no terminó de cargar, espera al evento `load` antes de tocar las capas
 * (setLayoutProperty lanza error si el estilo no está listo).
 */
export function useMapMode(mapRef: RefObject<MapRef | null>) {
  const [mapMode, setMapMode] = useState<MapModeKey>('satellite')

  useEffect(() => {
    const map = mapRef.current?.getMap()
    if (!map) return

    const apply = () => {
      const visibility = mapMode === 'hybrid' ? 'visible' : 'none'
      for (const id of HYBRID_OVERLAY_LAYERS) {
        if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', visibility)
      }
    }

    if (map.isStyleLoaded()) {
      apply()
    } else {
      map.once('load', apply)
      return () => {
        map.off('load', apply)
      }
    }
  }, [mapMode, mapRef])

  return { mapMode, setMapMode }
}
