/**
 * Captura del mapa de UNA capa de suelo (FASE RS, RS-15).
 *
 * Espejo de `ReportMapCapture`, que monta un `AspersionMap`. Aqui se monta el
 * `SoilMap` REAL en modo captura, no un mapa nuevo: cualquier reimplementacion del
 * pintado clasificaria distinto que el visor, y esa divergencia es justo lo que la
 * fase vino a cerrar (H4).
 *
 * Fuera de pantalla y no oculto: WebGL necesita un canvas con tamaño real. Con
 * `display:none` el mapa nunca dibuja y la captura sale en blanco.
 */
import { useCallback, useEffect, useRef } from 'react'
import type { Map as MapLibreMap } from 'maplibre-gl'
import {
  SoilMap,
  type SoilLayerComputed,
} from '@/features/geodata-visor/components/SoilMap'

/** Relacion ~4:3, acorde al recuadro del PDF. */
const CAPTURE_WIDTH = 1200
const CAPTURE_HEIGHT = 900
/**
 * Red de seguridad. Cuenta la interpolacion del raster, no solo el dibujado: en una
 * parcela grande el worker tarda, y 20 s cortaban capas que iban a terminar bien.
 */
const TIMEOUT_MS = 60_000

interface SoilLayerCaptureProps {
  sessionId: string
  plotId: string | null
  /** Capa a fotografiar, por `key` del catalogo. */
  layerKey: string
  /** Clasificacion que el mapa ya calculo: cortes, bandas y celdas del raster. */
  onComputed: (result: SoilLayerComputed) => void
  /**
   * Si la capa YA esta clasificada. Es el gate de la captura, y no es un detalle:
   * `idle` significa "termine de dibujar", NO "ya tengo los datos". El raster corre
   * en un worker, asi que el mapa pinta el satelite vacio y se declara idle mucho
   * antes de tener los cortes. Capturar ahi da una foto sin puntos y congela la
   * capa sin clasificar.
   */
  ready: boolean
  onCaptured: (blob: Blob) => void
  onError: (message: string) => void
}

export function SoilLayerCapture({
  sessionId,
  plotId,
  layerKey,
  onComputed,
  ready,
  onCaptured,
  onError,
}: SoilLayerCaptureProps) {
  // El mapa emite `idle` varias veces; se captura en el primero valido y se marca.
  const capturedRef = useRef(false)
  // Ultimo mapa que quedo quieto. Se guarda porque el `idle` casi siempre llega
  // ANTES que la clasificacion: cuando esta llega hay que capturar ese mapa, no
  // esperar otro `idle` que quiza no vuelva a ocurrir.
  const mapaRef = useRef<MapLibreMap | null>(null)

  // La clave reinicia el guard: el mismo componente sirve para capas sucesivas.
  useEffect(() => {
    capturedRef.current = false
    mapaRef.current = null
  }, [layerKey])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      if (capturedRef.current) return
      capturedRef.current = true
      onError(
        `La capa "${layerKey}" tardó demasiado en clasificarse; no se pudo capturar. ` +
          'Ábrela una vez en el visor y vuelve a intentarlo.'
      )
    }, TIMEOUT_MS)
    return () => window.clearTimeout(timeout)
  }, [layerKey, onError])

  const capturar = useCallback(
    (mapa: MapLibreMap) => {
      if (capturedRef.current) return
      capturedRef.current = true
      try {
        mapa.getCanvas().toBlob((blob) => {
          if (blob) onCaptured(blob)
          else onError('El navegador devolvió una captura vacía del mapa.')
        }, 'image/png')
      } catch {
        // Tiles sin CORS dejarian el canvas "manchado" y leerlo lanzaria SecurityError.
        onError('No se pudo leer el mapa (restricción de seguridad del navegador).')
      }
    },
    [onCaptured, onError]
  )

  function handleIdle(event: { target: MapLibreMap }) {
    mapaRef.current = event.target
    // Se captura SOLO en un idle posterior a la apertura del gate. El idle anterior
    // corresponde al mapa sin puntos —el satelite pelado—, que es la foto que
    // salia antes en todas las hojas del PDF.
    if (ready) capturar(event.target)
  }

  // Al abrirse el gate se fuerza un repintado para provocar ese idle posterior. Sin
  // el empujon, si el mapa ya quedo quieto podria no volver a emitirlo y la captura
  // se quedaria esperando hasta el tiempo limite.
  useEffect(() => {
    if (ready) mapaRef.current?.triggerRepaint()
  }, [ready, layerKey])

  return (
    <div
      aria-hidden
      style={{
        position: 'fixed',
        left: -10_000,
        top: 0,
        width: CAPTURE_WIDTH,
        height: CAPTURE_HEIGHT,
        pointerEvents: 'none',
      }}
    >
      {/* `key` fuerza un montaje limpio por capa: reusar la instancia arrastraria
          el encuadre y el canvas de la anterior. */}
      <SoilMap
        key={layerKey}
        sessionId={sessionId}
        plotId={plotId}
        activeLayerKey={layerKey}
        onLayerComputed={onComputed}
        locked
        tightFrame
        preserveDrawingBuffer
        onIdle={handleIdle}
        className="h-full w-full"
      />
    </div>
  )
}
