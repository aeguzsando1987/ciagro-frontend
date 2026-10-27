import type { ReactNode } from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { focusManager, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useNdviPoints } from './useNdviPoints'
import { useNdviSessionVariableConfig } from './useNdviVariableConfig'
import { useNdviTimeline } from './useNdviTimeline'
import { useNdviSessionHeaders } from './useNdviSessionHeaders'
import { usePlotGeometry } from '@/features/task-manager/hooks/usePlotGeometry'
import { useNdviVariableStats } from '@/features/task-manager/hooks/useNdviVariableStats'
import { useNdviSessionDetail } from '@/features/task-manager/hooks/useNdviSessionDetail'

const get = vi.hoisted(() => vi.fn(async () => ({ data: [], error: undefined })))
vi.mock('@/lib/api/client', () => ({ apiClient: { GET: get } }))

describe('regreso a la pestaña NDVI', () => {
  afterEach(() => { vi.unstubAllGlobals(); focusManager.setFocused(undefined) })
  it('no repite consultas por foco aunque estén stale; permite invalidación explícita', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ results: [], next: null }) }))
    vi.stubGlobal('fetch', fetchMock)
    get.mockClear()
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
    const { result, unmount } = renderHook(() => [
      useNdviPoints('n1'), useNdviSessionVariableConfig('n1'), useNdviTimeline('plot'),
      useNdviSessionHeaders('plot'), usePlotGeometry('plot'), useNdviVariableStats('n1'),
      useNdviSessionDetail('n1'),
    ], { wrapper })
    await waitFor(() => expect(result.current.every((q) => q.isSuccess)).toBe(true))
    const queries = client.getQueryCache().getAll()
    act(() => queries.forEach((q) => client.setQueryData(q.queryKey, q.state.data, { updatedAt: 1 })))
    get.mockClear()
    fetchMock.mockClear()
    await act(async () => {
      focusManager.setFocused(false)
      focusManager.setFocused(true)
      await new Promise((resolve) => setTimeout(resolve, 25))
    })
    expect(get).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
    await act(async () => { await client.invalidateQueries({ queryKey: ['ndvi-points', 'n1'] }) })
    expect(fetchMock).toHaveBeenCalledOnce()
    unmount()
    client.clear()
  })
})
