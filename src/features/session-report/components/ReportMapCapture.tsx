/**
 * Captura del snapshot del mapa para el reporte (FASE RP).
 *
 * Monta un `AspersionMap` **fuera de pantalla** con la capa de % de aplicación (la
 * capa 0, que es la que el reporte imprime), espera a que el mapa quede `idle` y
 * lee el canvas de WebGL.
 *
 * Por qué fuera de pantalla y no oculto: WebGL necesita un canvas con tamaño real
 * para renderizar. Con `display:none` o alto 0 el mapa nunca dibuja y la captura
 * saldría en blanco; posicionarlo fuera del viewport sí lo renderiza.
 *
 * `preserveDrawingBuffer` es imprescindible: sin él el navegador puede descartar el
 * buffer tras pintar y `toDataURL()` devuelve una imagen vacía. Se activa solo aquí.
 */
import { useEffect, useRef } from 'react'
import type { Map as MapLibreMap } from 'maplibre-gl'
import { AspersionMap } from '@/features/geodata-visor/components/AspersionMap'

/** Tamaño del lienzo de captura. Relación ~4:3, acorde al recuadro del reporte. */
const CAPTURE_WIDTH = 1200
const CAPTURE_HEIGHT = 900

interface ReportMapCaptureProps {
  sessionId: string
  plotId: string | null
  onCaptured: (blob: Blob) => void
  onError: (message: string) => void
}

export function ReportMapCapture({
  sessionId,
  plotId,
  onCaptured,
  onError,
}: ReportMapCaptureProps) {
  // El mapa emite `idle` varias veces (al cargar tiles, al reencuadrar…); capturamos
  // en el primero y marcamos, para no subir la imagen N veces.
  const capturedRef = useRef(false)

  // Red de seguridad: si el mapa nunca llega a `idle` (tiles caídos, WebGL no
  // disponible) el usuario se quedaría esperando sin señal.
  useEffect(() => {
    const timeout = window.setTimeout(() => {
      if (!capturedRef.current) {
        capturedRef.current = true
        onError('El mapa tardó demasiado en renderizar; no se pudo capturar.')
      }
    }, 20_000)
    return () => window.clearTimeout(timeout)
  }, [onError])

  function handleIdle(event: { target: MapLibreMap }) {
    if (capturedRef.current) return
    capturedRef.current = true

    try {
      event.target.getCanvas().toBlob((blob) => {
        if (blob) onCaptured(blob)
        else onError('El navegador devolvió una captura vacía del mapa.')
      }, 'image/png')
    } catch {
      // Si los tiles se sirvieran sin CORS el canvas quedaría "manchado" y leerlo
      // lanzaría SecurityError. Hoy ESRI responde con Access-Control-Allow-Origin,
      // pero si eso cambiara el usuario merece un mensaje claro.
      onError('No se pudo leer el mapa (restricción de seguridad del navegador).')
    }
  }

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
      <AspersionMap
        sessionId={sessionId}
        plotId={plotId}
        locked
        tightFrame
        preserveDrawingBuffer
        onIdle={handleIdle}
        className="h-full w-full"
      />
    </div>
  )
}
