/** NDVI: el kriging y la malla se calculan fuera del hilo de la interfaz. */
import { buildValueGrid, type InterpPoint, type InterpMethod } from '../lib/ndviInterpolation'

export interface NdviWorkerRequest {
  points: InterpPoint[]
  method: InterpMethod
  gridSize: number
  smoothingFactor: number
  ring: number[][]
}

self.onmessage = (event: MessageEvent<NdviWorkerRequest>) => {
  const { points, method, gridSize, smoothingFactor, ring } = event.data
  try {
    const field = buildValueGrid(points, method, gridSize, smoothingFactor, ring)
    if (field) {
      (self as unknown as Worker).postMessage({ field }, [field.grid.buffer])
    } else {
      self.postMessage({ field: null })
    }
  } catch (error) {
    self.postMessage({ error: (error as Error)?.message ?? 'Error calculando NDVI' })
  }
}
