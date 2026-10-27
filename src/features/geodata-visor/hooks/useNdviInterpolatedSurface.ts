/** Caché temporal de superficies NDVI (solo RAM) y cálculo pesado fuera del hilo UI.
 * No precarga ciclos ni activa sesiones o capas adicionales.
 */
import { useMemo } from 'react'
import { hashKey, useQuery } from '@tanstack/react-query'
import {
  colorizeValueGrid,
  type ColorBand,
  type InterpPoint,
  type InterpolatedImage,
  type ValueGrid,
} from '../lib/ndviInterpolation'
import type { NdviWorkerRequest } from '../workers/ndviInterpolation.worker'

interface SurfaceRequest {
  sessionId: string
  scope: string
  plotId: string | null | undefined
  indexKey: string
  points: InterpPoint[]
  ring: number[][] | null
  manualBands: ColorBand[] | null
  quartileColors: string[] | null
  smoothing: number
}

function calculateGrid(request: NdviWorkerRequest, signal: AbortSignal): Promise<ValueGrid | null> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException('Cancelado', 'AbortError'))
      return
    }

    // Se destruye al abandonar la sesión: ningún cálculo antiguo podrá pintar
    // encima de la nueva sesión. En la siguiente visita React Query reutiliza
    // el resultado mientras esté en caché.
    const worker = new Worker(new URL('../workers/ndviInterpolation.worker.ts', import.meta.url), { type: 'module' })
    let done = false
    const finish = (error?: Error, grid?: ValueGrid | null) => {
      if (done) return
      done = true
      signal.removeEventListener('abort', onAbort)
      worker.terminate()
      if (error) reject(error)
      else resolve(grid ?? null)
    }
    const onAbort = () => finish(new DOMException('Cancelado', 'AbortError'))
    signal.addEventListener('abort', onAbort, { once: true })
    worker.onmessage = (event: MessageEvent<{ field?: ValueGrid | null; error?: string }>) => {
      if (event.data.error) finish(new Error(event.data.error))
      else finish(undefined, event.data.field)
    }
    worker.onerror = () => finish(new Error('No fue posible preparar la superficie NDVI'))
    worker.postMessage(request)
  })
}

export function useNdviInterpolatedSurface(input: SurfaceRequest) {
  const enabled = !!input.ring && input.points.length >= 3
  // Una respuesta idéntica puede tener otro dataUpdatedAt. La superficie sólo
  // depende del contenido: volver a la pestaña no invalida el cálculo existente.
  const contentKey = useMemo(() => hashKey([
    input.points, input.ring, input.manualBands, input.quartileColors, input.smoothing,
  ]), [input.points, input.ring, input.manualBands, input.quartileColors, input.smoothing])
  const query = useQuery<InterpolatedImage | null>({
    queryKey: [
      'ndvi-surface-worker', input.scope, input.plotId, input.sessionId,
      input.indexKey, contentKey,
    ] as const,
    enabled,
    // Una actualización real de ESTA sesión conserva la capa hasta terminar.
    // Nunca arrastrar la imagen de otra sesión, parcela, ámbito o índice.
    placeholderData: (previous, previousQuery) => {
      const key = previousQuery?.queryKey
      return key?.[1] === input.scope && key[2] === input.plotId &&
        key[3] === input.sessionId && key[4] === input.indexKey ? previous : undefined
    },
    queryFn: async ({ signal }): Promise<InterpolatedImage | null> => {
      const field = await calculateGrid({
        points: input.points,
        method: 'kriging',
        gridSize: 260,
        smoothingFactor: input.smoothing,
        ring: input.ring!,
      }, signal)
      return field ? colorizeValueGrid(input.points, field, input.manualBands, input.quartileColors) : null
    },
    // Un ciclo puede visitarse de nuevo: se reutiliza el resultado sin rehacer kriging.
    // Los cambios reales de datos/configuración generan otra clave.
    staleTime: Infinity,
    gcTime: 5 * 60_000,
    retry: false,
    refetchOnWindowFocus: false,
  })
  return { ...query, contentKey }
}
