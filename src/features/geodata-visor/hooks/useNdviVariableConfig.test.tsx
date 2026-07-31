/**
 * La config de variables NDVI debe resolverse por la ORGANIZACION del workspace activo.
 *
 * Un mismo productor puede estar asignado a CIAgros de organizaciones distintas; si el
 * visor no manda su `dc`, el backend cae a la asignacion mas antigua y ambas ven la misma
 * configuracion. Ademas el `dc` tiene que entrar en la query key: al cambiar de workspace
 * no debe reutilizarse la config cacheada de la organizacion anterior.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

const getMock = vi.fn()
vi.mock('@/lib/api/client', () => ({
  apiClient: { GET: (...args: unknown[]) => getMock(...args) },
}))

import { useNdviSessionVariableConfig } from './useNdviVariableConfig'

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

describe('useNdviSessionVariableConfig', () => {
  beforeEach(() => {
    getMock.mockReset()
    getMock.mockResolvedValue({ data: { ndvi: { strategy: 'quartile' } }, error: undefined })
  })

  it('manda el dc del workspace como query param', async () => {
    const { result } = renderHook(() => useNdviSessionVariableConfig('sess-1', { dcId: 'dc-abc' }), {
      wrapper,
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    const [, options] = getMock.mock.calls[0]!
    expect(options.params.path).toEqual({ id: 'sess-1' })
    expect(options.params.query).toEqual({ dc: 'dc-abc' })
  })

  it('omite el query param si no hay dc', async () => {
    const { result } = renderHook(() => useNdviSessionVariableConfig('sess-1'), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    const [, options] = getMock.mock.calls[0]!
    expect(options.params.query).toBeUndefined()
  })

  it('manda el tenant cuando el visor indica la organizacion', async () => {
    // El visor navega por organización y tiene el DataCentralMain directo
    // (VisorSelection.org); el task-manager, en cambio, solo tiene el dc de la ruta.
    const { result } = renderHook(
      () => useNdviSessionVariableConfig('sess-1', { tenantId: 'org-1' }),
      { wrapper },
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(getMock.mock.calls[0]![1].params.query).toEqual({ tenant: 'org-1' })
  })

  it('el tenant gana si vienen ambos, igual que en el backend', async () => {
    const { result } = renderHook(
      () => useNdviSessionVariableConfig('sess-1', { tenantId: 'org-1', dcId: 'dc-abc' }),
      { wrapper },
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(getMock.mock.calls[0]![1].params.query).toEqual({ tenant: 'org-1' })
  })

  it('no reutiliza la config cacheada al cambiar de workspace', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
    const shared = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    )

    const first = renderHook(() => useNdviSessionVariableConfig('sess-1', { dcId: 'dc-uno' }), {
      wrapper: shared,
    })
    await waitFor(() => expect(first.result.current.isSuccess).toBe(true))

    const second = renderHook(() => useNdviSessionVariableConfig('sess-1', { dcId: 'dc-dos' }), {
      wrapper: shared,
    })
    await waitFor(() => expect(second.result.current.isSuccess).toBe(true))

    // Dos organizaciones sobre la misma sesion = dos entradas de cache distintas.
    expect(getMock).toHaveBeenCalledTimes(2)
    expect(getMock.mock.calls[1]![1].params.query).toEqual({ dc: 'dc-dos' })
  })
})
