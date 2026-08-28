import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ReactNode } from 'react'

// `vi.hoisted` porque vi.mock se iza al tope del archivo: unas const normales todavia no
// estan inicializadas cuando corre la factory.
const { GET, DELETE, POST } = vi.hoisted(() => ({
  GET: vi.fn(),
  DELETE: vi.fn(),
  POST: vi.fn(),
}))
vi.mock('@/lib/api/client', () => ({ apiClient: { GET, DELETE, POST } }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { useDeleteImpact, useDeleteLevel, useRestoreLevel } from './useDeleteLevel'

function wrapper(qc: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
}

function nuevoClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
}

const IMPACTO = {
  level: 'session',
  target_id: 'x',
  target_label: 'Aspersión',
  blockers: { published_reports: [], sessions_with_data: [] },
  counts: {},
  can_delete: true,
}

describe('useDeleteImpact', () => {
  beforeEach(() => vi.clearAllMocks())

  it('no consulta mientras el diálogo está cerrado', () => {
    const qc = nuevoClient()
    renderHook(() => useDeleteImpact('aspersion', 'id-1', false), { wrapper: wrapper(qc) })
    expect(GET).not.toHaveBeenCalled()
  })

  it('pide la ruta del dominio correcto cuando se abre', async () => {
    GET.mockResolvedValue({ data: IMPACTO })
    const qc = nuevoClient()
    renderHook(() => useDeleteImpact('soil_map', 'id-1', true), { wrapper: wrapper(qc) })
    await waitFor(() => expect(GET).toHaveBeenCalled())
    expect(GET.mock.calls[0]?.[0]).toBe('/api/v1/monitoring/soil-map/headers/{id}/delete-preview/')
  })

  it('usa la ruta de field_ops para programa y maestro', async () => {
    GET.mockResolvedValue({ data: IMPACTO })
    const qc = nuevoClient()
    renderHook(() => useDeleteImpact('master', 'id-1', true), { wrapper: wrapper(qc) })
    await waitFor(() => expect(GET).toHaveBeenCalled())
    expect(GET.mock.calls[0]?.[0]).toBe('/api/v1/field_ops/master-programs/{id}/delete-preview/')
  })
})

describe('useDeleteLevel', () => {
  beforeEach(() => vi.clearAllMocks())

  it('INVALIDA EL ARBOL tras borrar: sin esto el Gantt sigue mostrando lo borrado', async () => {
    DELETE.mockResolvedValue({ data: IMPACTO })
    const qc = nuevoClient()
    const spy = vi.spyOn(qc, 'invalidateQueries')

    const { result } = renderHook(() => useDeleteLevel('programa', 'id-9'), { wrapper: wrapper(qc) })
    result.current.mutate()
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const claves = spy.mock.calls.map((c) => JSON.stringify(c[0]?.queryKey))
    expect(claves).toContain(JSON.stringify(['master-tree']))
    expect(claves).toContain(JSON.stringify(['master-programs']))
  })

  it('invalida además las claves propias del dominio', async () => {
    DELETE.mockResolvedValue({ data: IMPACTO })
    const qc = nuevoClient()
    const spy = vi.spyOn(qc, 'invalidateQueries')

    const { result } = renderHook(() => useDeleteLevel('ndvi', 'id-3'), { wrapper: wrapper(qc) })
    result.current.mutate()
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const claves = spy.mock.calls.map((c) => JSON.stringify(c[0]?.queryKey))
    expect(claves).toContain(JSON.stringify(['ndvi-variable-stats', 'id-3']))
    expect(claves).toContain(JSON.stringify(['ndvi']))
  })

  it('marca el 409 como bloqueo, no como error de red', async () => {
    DELETE.mockResolvedValue({
      error: { detail: 'x', blockers: { published_reports: [], sessions_with_data: [] } },
      response: { status: 409 },
    })
    const qc = nuevoClient()
    const { result } = renderHook(() => useDeleteLevel('aspersion', 'id-4'), { wrapper: wrapper(qc) })
    result.current.mutate()
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect((result.current.error as Error & { blocked?: boolean }).blocked).toBe(true)
  })

  it('un error que NO es 409 no se marca como bloqueo', async () => {
    DELETE.mockResolvedValue({ error: { detail: 'boom' }, response: { status: 500 } })
    const qc = nuevoClient()
    const { result } = renderHook(() => useDeleteLevel('aspersion', 'id-5'), { wrapper: wrapper(qc) })
    result.current.mutate()
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect((result.current.error as Error & { blocked?: boolean }).blocked).toBeUndefined()
  })
})

describe('useRestoreLevel', () => {
  beforeEach(() => vi.clearAllMocks())

  it('llama al restore del nivel e invalida el árbol', async () => {
    POST.mockResolvedValue({ data: { restored: 3, id: 'id-7' } })
    const qc = nuevoClient()
    const spy = vi.spyOn(qc, 'invalidateQueries')

    const { result } = renderHook(() => useRestoreLevel('master', 'id-7'), { wrapper: wrapper(qc) })
    result.current.mutate()
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(POST.mock.calls[0]?.[0]).toBe('/api/v1/field_ops/master-programs/{id}/restore/')
    const claves = spy.mock.calls.map((c) => JSON.stringify(c[0]?.queryKey))
    expect(claves).toContain(JSON.stringify(['master-tree']))
  })
})
