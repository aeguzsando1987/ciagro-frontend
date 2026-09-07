import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '@/lib/api/client'
import { fetchSoilMapLayerValues, fetchSoilMapLayerData } from './useSoilMapLayerValues'

vi.mock('@/lib/api/client', () => ({
  apiClient: { GET: vi.fn() },
}))

const getMock = vi.mocked(apiClient.GET)
const URL = '/api/v1/monitoring/soil-map/points/'

function page(count: number, results: Record<string, unknown>[]) {
  return { data: { count, next: null, previous: null, results }, error: undefined } as never
}

describe('fetchSoilMapLayerValues', () => {
  beforeEach(() => {
    getMock.mockReset()
  })

  it('trae metros y elevación relativa juntos, sin convertir en cliente', async () => {
    getMock.mockResolvedValueOnce(
      page(2, [
        { id: 'a', Elevation: 1524, elevation_unit: 'm', elevation_relative_pct: 0 },
        { id: 'b', Elevation: 1600, elevation_unit: 'm', elevation_relative_pct: 100 },
      ])
    )
    const data = await fetchSoilMapLayerData('header-1', 'Elevation')
    expect(data.values.get('a')).toBe(1524)
    expect(data.relativeElevations.get('a')).toBe(0)
    expect(data.relativeElevations.get('b')).toBe(100)
    expect(getMock).toHaveBeenCalledOnce()
  })

  it('no interpreta alturas de un backend antiguo como metros', async () => {
    getMock.mockResolvedValueOnce(page(1, [{ id: 'a', Elevation: 5000 }]))
    await expect(fetchSoilMapLayerData('header-1', 'Elevation')).rejects.toThrow('metros')
  })

  it('pide id y el campo, sin geometría', () => {
    // La geometría ya vino en la precarga; repetirla en cada cambio de capa
    // duplicaría el payload (2.32 MB contra 1.03 MB por sesión).
    getMock.mockResolvedValueOnce(page(1, [{ id: 'a', pH: 6.5 }]))

    return fetchSoilMapLayerValues('header-1', 'pH').then(() => {
      expect(getMock).toHaveBeenCalledWith(URL, {
        params: {
          query: { smh_header: 'header-1', fields: 'id,pH', page_size: 2000, page: 1 },
        },
      })
    })
  })

  it('indexa los valores por id', async () => {
    getMock.mockResolvedValueOnce(
      page(2, [
        { id: 'a', pH: 6.5 },
        { id: 'b', pH: 7.5 },
      ])
    )

    const values = await fetchSoilMapLayerValues('header-1', 'pH')

    expect(values.get('a')).toBe(6.5)
    expect(values.get('b')).toBe(7.5)
    expect(values.size).toBe(2)
  })

  it('no guarda los nulos: la ausencia se representa de una sola forma', async () => {
    getMock.mockResolvedValueOnce(
      page(2, [
        { id: 'a', pH: null },
        { id: 'b', pH: 7.5 },
      ])
    )

    const values = await fetchSoilMapLayerValues('header-1', 'pH')

    expect(values.has('a')).toBe(false)
    expect(values.size).toBe(1)
  })

  it('funciona con campos de texto', async () => {
    getMock.mockResolvedValueOnce(page(1, [{ id: 'a', classtexture: 'Franco' }]))

    const values = await fetchSoilMapLayerValues('header-1', 'classtexture')

    expect(values.get('a')).toBe('Franco')
  })

  it('recorre todas las páginas que indique count', async () => {
    getMock
      .mockResolvedValueOnce(page(2500, [{ id: 'a', pH: 6 }]))
      .mockResolvedValueOnce(page(2500, [{ id: 'b', pH: 7 }]))

    const values = await fetchSoilMapLayerValues('header-1', 'pH')

    expect(getMock).toHaveBeenCalledTimes(2)
    expect([...values.keys()]).toEqual(['a', 'b'])
  })
})
