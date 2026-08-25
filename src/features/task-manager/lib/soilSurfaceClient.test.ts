import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { analyzeSoilSurface } from './soilMapSurface'
import {
  resetSoilSurfaceClient,
  runSoilSurfaceAnalysis,
  supportsSoilSurfaceWorker,
} from './soilSurfaceClient'

vi.mock('./soilMapSurface', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./soilMapSurface')>()),
  analyzeSoilSurface: vi.fn(() => ({
    min: 0,
    max: 10,
    breaks: [5],
    bucketCellCounts: { 'band-0': 1 },
  })),
}))

const analyzeMock = vi.mocked(analyzeSoilSurface)

const OPTIONS = { ring: [[0, 0]], samples: [], paletteSize: 7 } as never

beforeEach(() => {
  resetSoilSurfaceClient()
  analyzeMock.mockClear()
})

afterEach(() => {
  // @ts-expect-error se restituye el entorno de jsdom, que no trae Worker
  delete globalThis.Worker
  resetSoilSurfaceClient()
})

describe('runSoilSurfaceAnalysis — cache', () => {
  it('no recalcula una capa ya analizada', async () => {
    // Es lo que hace que volver a una capa ya vista sea inmediato en vez de
    // repetir los 1-3 segundos de interpolación.
    await runSoilSurfaceAnalysis(OPTIONS, 'sesion|ph|100')
    await runSoilSurfaceAnalysis(OPTIONS, 'sesion|ph|100')

    expect(analyzeMock).toHaveBeenCalledTimes(1)
  })

  it('trata cada capa por separado', async () => {
    await runSoilSurfaceAnalysis(OPTIONS, 'sesion|ph|100')
    await runSoilSurfaceAnalysis(OPTIONS, 'sesion|clay|100')

    expect(analyzeMock).toHaveBeenCalledTimes(2)
  })

  it('recalcula si cambia el número de muestras, o sea si se reimportó la sesión', async () => {
    await runSoilSurfaceAnalysis(OPTIONS, 'sesion|ph|100')
    await runSoilSurfaceAnalysis(OPTIONS, 'sesion|ph|250')

    expect(analyzeMock).toHaveBeenCalledTimes(2)
  })

  it('sin clave de cache no guarda nada', async () => {
    await runSoilSurfaceAnalysis(OPTIONS, null)
    await runSoilSurfaceAnalysis(OPTIONS, null)

    expect(analyzeMock).toHaveBeenCalledTimes(2)
  })
})

describe('runSoilSurfaceAnalysis — worker', () => {
  /** Worker de mentiras: responde con lo que le manden, en la siguiente microtarea. */
  class FakeWorker {
    static instances: FakeWorker[] = []
    static respondWith: unknown = { min: 1, max: 2, breaks: [], bucketCellCounts: {} }
    onmessage: ((event: MessageEvent) => void) | null = null
    onerror: (() => void) | null = null
    postedIds: number[] = []
    terminated = false

    constructor() {
      FakeWorker.instances.push(this)
    }

    postMessage(data: { id: number }) {
      this.postedIds.push(data.id)
      queueMicrotask(() =>
        this.onmessage?.({ data: { id: data.id, result: FakeWorker.respondWith } } as MessageEvent)
      )
    }

    terminate() {
      this.terminated = true
    }
  }

  beforeEach(() => {
    FakeWorker.instances = []
    // @ts-expect-error se inyecta el doble en el entorno de jsdom
    globalThis.Worker = FakeWorker
  })

  it('delega el cálculo al worker en vez de correrlo en el hilo principal', async () => {
    const result = await runSoilSurfaceAnalysis(OPTIONS, null)

    expect(analyzeMock).not.toHaveBeenCalled()
    expect(result).toEqual({ min: 1, max: 2, breaks: [], bucketCellCounts: {} })
  })

  it('reutiliza un solo worker para todas las peticiones', async () => {
    await runSoilSurfaceAnalysis(OPTIONS, 'a')
    await runSoilSurfaceAnalysis(OPTIONS, 'b')

    expect(FakeWorker.instances).toHaveLength(1)
    expect(FakeWorker.instances[0]!.postedIds).toHaveLength(2)
  })

  it('cae al cálculo síncrono donde no hay Web Workers', async () => {
    // @ts-expect-error jsdom sin Worker es el escenario de las pruebas del componente
    delete globalThis.Worker
    expect(supportsSoilSurfaceWorker()).toBe(false)

    await runSoilSurfaceAnalysis(OPTIONS, null)

    expect(analyzeMock).toHaveBeenCalledTimes(1)
  })
})
