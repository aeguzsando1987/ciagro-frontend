import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '@/lib/api/client'
import { fetchAllSoilMapPoints, type SoilMapPointGeom } from './useSoilMapPoints'

vi.mock('@/lib/api/client', () => ({
  apiClient: { GET: vi.fn() },
}))

const getMock = vi.mocked(apiClient.GET)

const URL = '/api/v1/monitoring/soil-map/points/'

function makePoint(id: string): SoilMapPointGeom {
  return { id, geom: { type: 'Point', coordinates: [-103.3, 20.7] } }
}

/** Respuesta paginada con `count` total: es `count` quien decide cuántas páginas hay. */
function page(count: number, ids: string[]) {
  return {
    data: { count, next: null, previous: null, results: ids.map(makePoint) },
    error: undefined,
  } as never
}

describe('fetchAllSoilMapPoints', () => {
  beforeEach(() => {
    getMock.mockReset()
  })

  it('pide solo id y geom: la precarga no descarga valores de capa', async () => {
    getMock.mockResolvedValueOnce(page(2, ['point-1', 'point-2']))

    await fetchAllSoilMapPoints('header-1')

    expect(getMock).toHaveBeenCalledTimes(1)
    expect(getMock).toHaveBeenCalledWith(URL, {
      params: {
        query: { smh_header: 'header-1', fields: 'id,geom', page_size: 2000, page: 1 },
      },
    })
  })

  it('con una sola página no dispara peticiones de más', async () => {
    getMock.mockResolvedValueOnce(page(3, ['point-1', 'point-2', 'point-3']))

    const points = await fetchAllSoilMapPoints('header-1')

    expect(points.map((point) => point.id)).toEqual(['point-1', 'point-2', 'point-3'])
    expect(getMock).toHaveBeenCalledTimes(1)
  })

  it('calcula las páginas desde count y las recorre en orden', async () => {
    // 4100 puntos a 2000 por página son 3 páginas. El número no está escrito en
    // ninguna parte: sale de count, así que sirve igual con 1 que con 20.
    getMock
      .mockResolvedValueOnce(page(4100, ['p1']))
      .mockResolvedValueOnce(page(4100, ['p2']))
      .mockResolvedValueOnce(page(4100, ['p3']))

    const points = await fetchAllSoilMapPoints('header-1')

    expect(points.map((point) => point.id)).toEqual(['p1', 'p2', 'p3'])
    expect(getMock).toHaveBeenCalledTimes(3)
    expect(getMock.mock.calls.map((call) => (call[1] as never as {
      params: { query: { page: number } }
    }).params.query.page)).toEqual([1, 2, 3])
  })

  it('pide las páginas en serie, no todas a la vez', async () => {
    // Medido: 3.1 s en serie contra 4.7 s en paralelo sobre la sesión real. El
    // runserver de desarrollo tiene un solo proceso y en producción son 3 workers
    // de gunicorn, así que la concurrencia estorba en vez de ayudar.
    let enVuelo = 0
    let maxEnVuelo = 0
    const responses = [page(6000, ['p1']), page(6000, ['p2']), page(6000, ['p3'])]
    let indice = 0
    getMock.mockImplementation((() => {
      enVuelo += 1
      maxEnVuelo = Math.max(maxEnVuelo, enVuelo)
      const response = responses[indice++]
      return new Promise((resolve) =>
        setTimeout(() => {
          enVuelo -= 1
          resolve(response)
        }, 1)
      )
    }) as never)

    const points = await fetchAllSoilMapPoints('header-1')

    expect(maxEnVuelo).toBe(1)
    expect(points.map((point) => point.id)).toEqual(['p1', 'p2', 'p3'])
  })

  it('reporta la página que falló', async () => {
    getMock.mockResolvedValueOnce({ data: undefined, error: { detail: 'Error' } } as never)

    await expect(fetchAllSoilMapPoints('header-1')).rejects.toThrow(
      'Error al cargar puntos de suelo (página 1)'
    )
  })

  it('reporta el número correcto cuando falla una página posterior', async () => {
    getMock
      .mockResolvedValueOnce(page(4100, ['p1']))
      .mockResolvedValueOnce(page(4100, ['p2']))
      .mockResolvedValueOnce({ data: undefined, error: { detail: 'Error' } } as never)

    await expect(fetchAllSoilMapPoints('header-1')).rejects.toThrow(
      'Error al cargar puntos de suelo (página 3)'
    )
  })
})
