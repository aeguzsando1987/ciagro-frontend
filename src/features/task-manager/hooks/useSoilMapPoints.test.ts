import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '@/lib/api/client'
import { fetchAllSoilMapPoints, type SoilMapPoint } from './useSoilMapPoints'

vi.mock('@/lib/api/client', () => ({
  apiClient: { GET: vi.fn() },
}))

const getMock = vi.mocked(apiClient.GET)

function makePoint(id: string): SoilMapPoint {
  return {
    id,
    smh_header: 'header-1',
    geom: { type: 'Point', coordinates: [-103.3, 20.7] },
    created_at: '2026-07-22T00:00:00Z',
  }
}

describe('fetchAllSoilMapPoints', () => {
  beforeEach(() => {
    getMock.mockReset()
  })

  it('recorre y acumula todas las páginas del endpoint', async () => {
    getMock
      .mockResolvedValueOnce({
        data: {
          count: 3,
          next: 'http://localhost/api/v1/monitoring/soil-map/points/?page=2',
          previous: null,
          results: [makePoint('point-1'), makePoint('point-2')],
        },
        error: undefined,
      } as never)
      .mockResolvedValueOnce({
        data: {
          count: 3,
          next: null,
          previous: 'http://localhost/api/v1/monitoring/soil-map/points/?page=1',
          results: [makePoint('point-3')],
        },
        error: undefined,
      } as never)

    const points = await fetchAllSoilMapPoints('header-1')

    expect(points.map((point) => point.id)).toEqual(['point-1', 'point-2', 'point-3'])
    expect(getMock).toHaveBeenCalledTimes(2)
    expect(getMock).toHaveBeenNthCalledWith(1, '/api/v1/monitoring/soil-map/points/', {
      params: { query: { smh_header: 'header-1', page_size: 2000, page: 1 } },
    })
    expect(getMock).toHaveBeenNthCalledWith(2, '/api/v1/monitoring/soil-map/points/', {
      params: { query: { smh_header: 'header-1', page_size: 2000, page: 2 } },
    })
  })

  it('reporta la página que falló', async () => {
    getMock.mockResolvedValueOnce({ data: undefined, error: { detail: 'Error' } } as never)

    await expect(fetchAllSoilMapPoints('header-1')).rejects.toThrow(
      'Error al cargar puntos de suelo (página 1)'
    )
  })
})
