/**
 * El borrado seguro es la misma operación para los tres tipos de sesión, pero cada uno
 * pega a SU endpoint y refresca SUS caches. Un error ahí es silencioso y peligroso:
 * se borraría la sesión equivocada, o el visor seguiría mostrando datos ya borrados.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('@/lib/auth/tokens', () => ({ tokens: { getAccess: () => 'tok-123' } }))

import { useFlushSession } from './useFlushSession'

let client: QueryClient

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

const fetchMock = vi.fn()

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  fetchMock.mockReset()
  fetchMock.mockResolvedValue({
    ok: true,
    json: async () => ({ deleted_points: 7, header_id: 'sess-1' }),
  })
  vi.stubGlobal('fetch', fetchMock)
})

function urlOf(call: number) {
  return String(fetchMock.mock.calls[call]![0])
}

describe('useFlushSession', () => {
  it('pega al endpoint de aspersion', async () => {
    const { result } = renderHook(() => useFlushSession('aspersion', 'sess-1'), { wrapper })
    result.current.mutate(undefined)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(urlOf(0)).toContain('/monitoring/aspersion/headers/sess-1/flush/')
  })

  it('pega al endpoint de ndvi', async () => {
    const { result } = renderHook(() => useFlushSession('ndvi', 'sess-1'), { wrapper })
    result.current.mutate(undefined)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(urlOf(0)).toContain('/monitoring/ndvi/headers/sess-1/flush/')
  })

  it('pega al endpoint de mapeo de suelo con el segmento soil-map', async () => {
    const { result } = renderHook(() => useFlushSession('soil_map', 'sess-1'), { wrapper })
    result.current.mutate(undefined)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(urlOf(0)).toContain('/monitoring/soil-map/headers/sess-1/flush/')
  })

  it('manda POST con el token de acceso', async () => {
    const { result } = renderHook(() => useFlushSession('ndvi', 'sess-1'), { wrapper })
    result.current.mutate(undefined)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    const [, options] = fetchMock.mock.calls[0]!
    expect(options.method).toBe('POST')
    expect(options.headers.Authorization).toBe('Bearer tok-123')
  })

  it('invalida las caches del visor NDVI, incluida la coropleta', async () => {
    const spy = vi.spyOn(client, 'invalidateQueries')
    const { result } = renderHook(() => useFlushSession('ndvi', 'sess-1'), { wrapper })
    result.current.mutate(undefined)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    const keys = spy.mock.calls.map((c) => JSON.stringify(c[0]!.queryKey))
    expect(keys).toContain(JSON.stringify(['ndvi-detail', 'sess-1']))
    expect(keys).toContain(JSON.stringify(['ndvi-points', 'sess-1']))
    // Prefijo que cubre headers, contornos e indices de contorno del visor.
    expect(keys).toContain(JSON.stringify(['ndvi']))
  })

  it('invalida las caches de mapeo de suelo', async () => {
    const spy = vi.spyOn(client, 'invalidateQueries')
    const { result } = renderHook(() => useFlushSession('soil_map', 'sess-1'), { wrapper })
    result.current.mutate(undefined)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    const keys = spy.mock.calls.map((c) => JSON.stringify(c[0]!.queryKey))
    expect(keys).toContain(JSON.stringify(['soil-map-detail', 'sess-1']))
    expect(keys).toContain(JSON.stringify(['soil-map-points', 'sess-1']))
    expect(keys).toContain(JSON.stringify(['soil-map-session-stats', 'sess-1']))
  })

  it('falla si el backend rechaza (no invalida nada)', async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({}) })
    const spy = vi.spyOn(client, 'invalidateQueries')
    const { result } = renderHook(() => useFlushSession('ndvi', 'sess-1'), { wrapper })
    result.current.mutate(undefined)

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(spy).not.toHaveBeenCalled()
  })
})
