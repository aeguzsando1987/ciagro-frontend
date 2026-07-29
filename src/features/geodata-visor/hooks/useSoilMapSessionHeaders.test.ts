import { QueryClient } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '@/lib/api/client'
import { SOIL_MAP_HEADERS_KEY, soilMapSessionHeadersQueryOptions } from './useSoilMapSessionHeaders'

vi.mock('@/lib/api/client', () => ({
  apiClient: { GET: vi.fn() },
}))

const getMock = vi.mocked(apiClient.GET)

describe('soilMapSessionHeadersQueryOptions', () => {
  beforeEach(() => {
    getMock.mockReset()
  })

  it('se desactiva sin parcela y conserva el plot en la clave de caché', () => {
    const withoutPlot = soilMapSessionHeadersQueryOptions(null)
    const withPlot = soilMapSessionHeadersQueryOptions('plot-1')

    expect(withoutPlot.enabled).toBe(false)
    expect(withoutPlot.queryKey).toEqual([...SOIL_MAP_HEADERS_KEY, { plot: null }])
    expect(withPlot.enabled).toBe(true)
    expect(withPlot.queryKey).toEqual([...SOIL_MAP_HEADERS_KEY, { plot: 'plot-1' }])
    expect(withPlot.staleTime).toBe(30_000)
  })

  it('consulta el endpoint con el plot y devuelve sus resultados', async () => {
    const header = { id: 'soil-header-1', mapping_date: '2026-07-23' }
    getMock.mockResolvedValueOnce({
      data: { count: 1, next: null, previous: null, results: [header] },
      error: undefined,
    } as never)

    const queryClient = new QueryClient()
    const result = await queryClient.fetchQuery(soilMapSessionHeadersQueryOptions('plot-1'))

    expect(getMock).toHaveBeenCalledWith('/api/v1/monitoring/soil-map/headers/', {
      params: { query: { plot: 'plot-1' } },
    })
    expect(result).toEqual([header])
  })

  it('traduce el error del backend a un mensaje del visor', async () => {
    getMock.mockResolvedValueOnce({ data: undefined, error: { detail: 'Error' } } as never)
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    await expect(
      queryClient.fetchQuery(soilMapSessionHeadersQueryOptions('plot-1'))
    ).rejects.toThrow('No se pudieron cargar las sesiones de mapeo de suelo')
  })
})
