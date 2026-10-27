import type { ReactNode } from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { focusManager, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useNdviInterpolatedSurface } from './useNdviInterpolatedSurface'

vi.mock('../lib/ndviInterpolation', () => ({
  colorizeValueGrid: (_points: unknown, field: { value: number }) => ({
    dataUrl: `surface-${field.value}`, coordinates: [], min: 0, max: 1,
  }),
}))

class WorkerMock {
  static instances: WorkerMock[] = []
  onmessage: ((event: { data: unknown }) => void) | null = null
  onerror: (() => void) | null = null
  terminate = vi.fn()
  postMessage = vi.fn()
  constructor() { WorkerMock.instances.push(this) }
  complete(value: number) { this.onmessage?.({ data: { field: { value } } }) }
}

const input = {
  sessionId: 'n1', scope: 'org', plotId: 'plot', indexKey: 'ndvi', smoothing: 0.5,
  points: [{ lon: 1, lat: 1, value: 0.3 }, { lon: 2, lat: 1, value: 0.5 }, { lon: 1, lat: 2, value: 0.8 }],
  ring: [[0, 0], [3, 0], [3, 3], [0, 0]], manualBands: null, quartileColors: null,
}

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
  const hook = renderHook(useNdviInterpolatedSurface, { wrapper, initialProps: input })
  return { ...hook, client }
}

describe('caché de la superficie NDVI', () => {
  beforeEach(() => {
    WorkerMock.instances = []
    vi.stubGlobal('Worker', WorkerMock)
  })
  afterEach(() => { vi.unstubAllGlobals(); focusManager.setFocused(undefined) })

  it('conserva la imagen ante datos idénticos, foco y revisitas; recalcula cambios reales', async () => {
    const { result, rerender, unmount, client } = setup()
    act(() => WorkerMock.instances[0]!.complete(1))
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    const original = result.current.data
    rerender({ ...input, points: input.points.map((p) => ({ ...p })), ring: input.ring.map((r) => [...r]) })
    act(() => { focusManager.setFocused(false); focusManager.setFocused(true) })
    expect(result.current.data).toBe(original)
    expect(WorkerMock.instances).toHaveLength(1)

    rerender({ ...input, points: input.points.map((p) => ({ ...p, value: 0.9 })) })
    expect(WorkerMock.instances).toHaveLength(2)
    expect(result.current.data).toBe(original)
    expect(result.current.isPlaceholderData).toBe(true)
    act(() => WorkerMock.instances[1]!.complete(2))
    await waitFor(() => expect(result.current.data?.dataUrl).toBe('surface-2'))
    rerender(input)
    expect(result.current.data).toBe(original)
    expect(WorkerMock.instances).toHaveLength(2)
    unmount()
    client.clear()
  })

  it('cancela el cálculo abandonado y nunca muestra su resultado en otra sesión', async () => {
    const { result, rerender, unmount, client } = setup()
    const abandoned = WorkerMock.instances[0]!
    rerender({ ...input, sessionId: 'n2' })
    expect(abandoned.terminate).toHaveBeenCalledOnce()
    act(() => abandoned.complete(99))
    expect(result.current.data).toBeUndefined()
    act(() => WorkerMock.instances[1]!.complete(2))
    await waitFor(() => expect(result.current.data?.dataUrl).toBe('surface-2'))
    unmount()
    client.clear()
  })
})
