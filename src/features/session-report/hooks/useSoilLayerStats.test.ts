/**
 * Hooks de capa (RS-16).
 *
 * Se prueba la CLAVE DE CACHE y el gating de la peticion. Son dos cosas que no
 * fallan ruidosamente: con `bins` fuera de la clave, cambiar el numero de barras
 * devolveria el histograma anterior y el grafico se dibujaria con datos viejos sin
 * que nada avise.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockGet = vi.fn()
vi.mock('@/lib/api/client', () => ({ apiClient: { GET: (...a: unknown[]) => mockGet(...a) } }))

import { useSoilLayerStats, DEFAULT_BINS, isNumericStats } from './useSoilLayerStats'
import { flattenLayers } from './useSoilLayerCatalog'

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  return createElement(QueryClientProvider, { client: qc }, children)
}

beforeEach(() => {
  mockGet.mockReset()
  mockGet.mockResolvedValue({ data: { layer: { kind: 'numeric' } }, error: null })
})
afterEach(() => vi.clearAllMocks())

describe('useSoilLayerStats', () => {
  it('no pide nada hasta que hay capa elegida', () => {
    renderHook(() => useSoilLayerStats('h1', null), { wrapper })
    expect(mockGet).not.toHaveBeenCalled()
  })

  it('manda la capa y las barras como query params', async () => {
    const { result } = renderHook(() => useSoilLayerStats('h1', 'ph'), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockGet).toHaveBeenCalledWith(
      '/api/v1/monitoring/soil-map/headers/{id}/layer-stats/',
      { params: { path: { id: 'h1' }, query: { layer: 'ph', bins: DEFAULT_BINS } } }
    )
  })

  it('cambiar las barras es otra respuesta, no la misma cacheada', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const w = ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client: qc }, children)

    const a = renderHook(() => useSoilLayerStats('h1', 'ph', 20), { wrapper: w })
    await waitFor(() => expect(a.result.current.isSuccess).toBe(true))
    const b = renderHook(() => useSoilLayerStats('h1', 'ph', 50), { wrapper: w })
    await waitFor(() => expect(b.result.current.isSuccess).toBe(true))

    // Sin `bins` en la clave, la segunda reutilizaria el histograma de 20 barras.
    expect(mockGet).toHaveBeenCalledTimes(2)
  })

  it('propaga el fallo en vez de devolver datos vacíos', async () => {
    mockGet.mockResolvedValue({ data: undefined, error: { detail: 'x' } })
    const { result } = renderHook(() => useSoilLayerStats('h1', 'ph'), { wrapper })
    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})

describe('isNumericStats', () => {
  it('discrimina por el kind del catálogo, no por qué campos vengan', () => {
    // Una capa numerica sin valores traeria mean en null; mirar los campos la
    // confundiria con una categorica.
    const numerica = { layer: { kind: 'numeric' }, mean: null } as never
    const categorica = { layer: { kind: 'category' }, values: [] } as never
    expect(isNumericStats(numerica)).toBe(true)
    expect(isNumericStats(categorica)).toBe(false)
  })
})

describe('flattenLayers', () => {
  it('conserva el orden de los grupos del catálogo', () => {
    const catalogo = {
      count: 3,
      groups: [
        { group: 'A', layers: [{ key: 'a1' }, { key: 'a2' }] },
        { group: 'B', layers: [{ key: 'b1' }] },
      ],
    } as never
    expect(flattenLayers(catalogo).map((l) => l.key)).toEqual(['a1', 'a2', 'b1'])
  })

  it('sin catálogo devuelve vacío en vez de reventar', () => {
    expect(flattenLayers(undefined)).toEqual([])
  })
})
