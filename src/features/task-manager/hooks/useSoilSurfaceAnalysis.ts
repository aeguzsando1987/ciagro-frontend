/**
 * Análisis de superficie de la capa activa, calculado fuera del hilo principal.
 *
 * Sustituye al `useMemo` síncrono que congelaba la aplicación entre 1 y 3 segundos
 * cada vez que se pintaba una capa. El resultado llega asíncrono, así que el
 * componente pasa por un estado intermedio —`isComputing`— en el que ya tiene los
 * puntos pero todavía no los cortes de la leyenda.
 */
import { useEffect, useRef, useState } from 'react'
import type { SoilSurfaceAnalysis } from '../lib/soilMapSurface'
import type { SoilMapSample } from '../lib/soilMapSamples'
import { runSoilSurfaceAnalysis } from '../lib/soilSurfaceClient'

interface Params {
  ring: number[][] | null
  /** Se acepta el valor crudo (numérico o texto); la conversión va aquí adentro. */
  samples: SoilMapSample[]
  paletteSize: number
  /** Identifica el resultado en el caché. `null` desactiva el cacheo. */
  cacheKey: string | null
  /** Las capas categóricas no interpolan: sus rangos son las categorías mismas. */
  enabled: boolean
}

export function useSoilSurfaceAnalysis({
  ring,
  samples,
  paletteSize,
  cacheKey,
  enabled,
}: Params) {
  const [analysis, setAnalysis] = useState<SoilSurfaceAnalysis | null>(null)
  const [isComputing, setIsComputing] = useState(false)
  // Distingue la petición vigente de las anteriores. Sin esto, cambiar de capa
  // dos veces seguidas puede pintar el resultado de la primera sobre la segunda
  // si la primera tarda más: el mapa quedaría mostrando cortes de otra variable.
  const requestRef = useRef(0)

  useEffect(() => {
    if (!enabled || !ring || samples.length < 3 || paletteSize === 0) {
      setAnalysis(null)
      setIsComputing(false)
      return
    }

    const requestId = ++requestRef.current
    setIsComputing(true)

    runSoilSurfaceAnalysis(
      {
        ring,
        samples: samples.map((sample) => ({
          lng: sample.lng,
          lat: sample.lat,
          value: Number(sample.value),
        })),
        paletteSize,
      },
      cacheKey
    )
      .then((result) => {
        if (requestRef.current !== requestId) return
        setAnalysis(result)
        setIsComputing(false)
      })
      .catch(() => {
        if (requestRef.current !== requestId) return
        // Sin superficie el mapa no se queda en blanco: los cortes se calculan
        // desde los valores crudos, que es el camino que ya existía como respaldo.
        setAnalysis(null)
        setIsComputing(false)
      })
  }, [cacheKey, enabled, paletteSize, ring, samples])

  return { analysis, isComputing }
}
