/**
 * Cliente del worker de interpolación, con caché por capa.
 *
 * Dos problemas resueltos aquí:
 *
 * 1. **La congelación.** El cálculo se delega a `soilMapSurface.worker.ts`, en un
 *    hilo aparte, para que la aplicación siga respondiendo mientras dura.
 * 2. **El recálculo.** Volver a una capa ya vista repetía los 1–3 segundos desde
 *    cero. El resultado se cachea por capa, así la segunda visita es inmediata.
 *
 * Un solo worker para toda la aplicación: crear uno por componente multiplicaría
 * hilos que pasan la mayor parte del tiempo inactivos, y las peticiones se
 * distinguen por `id`, no por instancia.
 */
import {
  analyzeSoilSurface,
  type AnalyzeSoilSurfaceOptions,
  type SoilSurfaceAnalysis,
} from './soilMapSurface'

/**
 * Cota del caché. Cada entrada son unos cientos de bytes (min, max, siete cortes
 * y el conteo de celdas por rango), pero sin límite crecería con cada capa de
 * cada sesión que el usuario abra en la vida de la pestaña.
 */
const MAX_CACHE_ENTRIES = 120

const cache = new Map<string, SoilSurfaceAnalysis | null>()

let worker: Worker | null = null
let nextRequestId = 1
const pending = new Map<
  number,
  { resolve: (value: SoilSurfaceAnalysis | null) => void; reject: (error: Error) => void }
>()

/** `false` en jsdom y en cualquier entorno sin Web Workers. */
export function supportsSoilSurfaceWorker() {
  return typeof Worker !== 'undefined'
}

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./soilMapSurface.worker.ts', import.meta.url), {
      type: 'module',
    })
    worker.onmessage = (
      event: MessageEvent<{ id: number; result?: SoilSurfaceAnalysis | null; error?: string }>
    ) => {
      const { id, result, error } = event.data
      const entry = pending.get(id)
      if (!entry) return
      pending.delete(id)
      if (error) entry.reject(new Error(error))
      else entry.resolve(result ?? null)
    }
    worker.onerror = () => {
      // Si el worker muere, todas las peticiones en vuelo se quedarían colgadas
      // y el visor mostraría "Calculando superficie…" para siempre.
      for (const entry of pending.values()) {
        entry.reject(new Error('El worker de interpolación falló'))
      }
      pending.clear()
      worker?.terminate()
      worker = null
    }
  }
  return worker
}

function readCache(key: string | null) {
  if (key === null) return undefined
  return cache.has(key) ? cache.get(key) : undefined
}

function writeCache(key: string | null, value: SoilSurfaceAnalysis | null) {
  if (key === null) return
  if (cache.size >= MAX_CACHE_ENTRIES) {
    // `Map` conserva el orden de inserción: el primero es el más antiguo.
    const oldest = cache.keys().next().value
    if (oldest !== undefined) cache.delete(oldest)
  }
  cache.set(key, value)
}

/**
 * Devuelve el análisis de superficie, del caché si ya se calculó.
 *
 * Sin soporte de Web Workers cae al cálculo síncrono: la interfaz se congela como
 * antes, pero el mapa se pinta igual. Es degradación, no un camino alterno de
 * producción — todos los navegadores del proyecto soportan workers.
 */
export async function runSoilSurfaceAnalysis(
  options: AnalyzeSoilSurfaceOptions,
  cacheKey: string | null
): Promise<SoilSurfaceAnalysis | null> {
  const cached = readCache(cacheKey)
  if (cached !== undefined) return cached

  if (!supportsSoilSurfaceWorker()) {
    const result = analyzeSoilSurface(options)
    writeCache(cacheKey, result)
    return result
  }

  const id = nextRequestId++
  const result = await new Promise<SoilSurfaceAnalysis | null>((resolve, reject) => {
    pending.set(id, { resolve, reject })
    getWorker().postMessage({ id, options })
  })
  writeCache(cacheKey, result)
  return result
}

/** Solo para pruebas: deja el caché y el worker como recién arrancados. */
export function resetSoilSurfaceClient() {
  cache.clear()
  pending.clear()
  worker?.terminate()
  worker = null
}
