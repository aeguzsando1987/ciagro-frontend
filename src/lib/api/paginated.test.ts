import { describe, expect, it, vi } from 'vitest'

import { conTotal, fetchAllPages, fetchAllPagesWithTotal, MAX_PAGE_SIZE } from './paginated'

/**
 * Lo que se protege aquí es una regresión silenciosa: leer solo la primera página no
 * rompe nada visible, simplemente faltan elementos. En el selector de parcelas del
 * alcance eso son permisos que el gerente cree haber dado y no dio.
 */
describe('fetchAllPages', () => {
  it('pide el máximo por página en la primera llamada', async () => {
    const pedir = vi.fn().mockResolvedValue({ count: 2, results: [{ id: 'a' }, { id: 'b' }] })
    await fetchAllPages(pedir)
    expect(pedir).toHaveBeenCalledWith({ page: 1, page_size: MAX_PAGE_SIZE })
  })

  it('no encadena una segunda petición cuando ya vinieron todos', async () => {
    const pedir = vi.fn().mockResolvedValue({ count: 2, results: [{ id: 'a' }, { id: 'b' }] })
    const todos = await fetchAllPages(pedir)
    expect(todos).toHaveLength(2)
    expect(pedir).toHaveBeenCalledTimes(1)
  })

  it('sigue pidiendo páginas mientras falten elementos', async () => {
    const pedir = vi
      .fn()
      .mockResolvedValueOnce({ count: 5, results: [{ id: 'a' }, { id: 'b' }] })
      .mockResolvedValueOnce({ count: 5, results: [{ id: 'c' }, { id: 'd' }] })
      .mockResolvedValueOnce({ count: 5, results: [{ id: 'e' }] })
    const todos = await fetchAllPages(pedir)
    expect(todos.map((x) => (x as { id: string }).id)).toEqual(['a', 'b', 'c', 'd', 'e'])
    expect(pedir).toHaveBeenCalledTimes(3)
  })

  it('entiende un FeatureCollection de GeoJSON', async () => {
    // Parcelas y ranchos no devuelven un array plano sino `results.features`.
    const pedir = vi.fn().mockResolvedValue({
      count: 1,
      results: { features: [{ id: 'geo' }] },
    })
    const todos = await fetchAllPages(pedir)
    expect(todos).toEqual([{ id: 'geo' }])
  })

  it('corta si el backend informa un count mayor del que puede servir', async () => {
    // Un `count` alto con páginas vacías haría girar el bucle indefinidamente.
    const pedir = vi
      .fn()
      .mockResolvedValueOnce({ count: 999, results: [{ id: 'a' }] })
      .mockResolvedValue({ count: 999, results: [] })
    const todos = await fetchAllPages(pedir)
    expect(todos).toHaveLength(1)
    expect(pedir).toHaveBeenCalledTimes(2)
  })

  it('devuelve lista vacía cuando no hay resultados', async () => {
    const pedir = vi.fn().mockResolvedValue({ count: 0, results: null })
    expect(await fetchAllPages(pedir)).toEqual([])
  })
})

/**
 * FASE PAG: el Visor necesita saber si llegaron todas las sesiones para avisar
 * "se muestran X de Y" en lugar de truncar en silencio.
 */
describe('fetchAllPagesWithTotal', () => {
  it('devuelve los elementos y el count del backend', async () => {
    const pedir = vi
      .fn()
      .mockResolvedValueOnce({ count: 3, results: [{ id: 'a' }, { id: 'b' }] })
      .mockResolvedValueOnce({ count: 3, results: [{ id: 'c' }] })
    const { items, total } = await fetchAllPagesWithTotal(pedir)
    expect(items).toHaveLength(3)
    expect(total).toBe(3)
  })

  it('conserva un total mayor que lo recibido cuando el backend deja de servir paginas', async () => {
    const pedir = vi
      .fn()
      .mockResolvedValueOnce({ count: 999, results: [{ id: 'a' }] })
      .mockResolvedValue({ count: 999, results: [] })
    const { items, total } = await fetchAllPagesWithTotal(pedir)
    expect(items).toHaveLength(1)
    expect(total).toBe(999)
  })

  it('usa el numero de elementos cuando la respuesta no trae count', async () => {
    const pedir = vi.fn().mockResolvedValue({ results: [{ id: 'a' }] })
    expect(await fetchAllPagesWithTotal(pedir)).toEqual({ items: [{ id: 'a' }], total: 1 })
  })
})

describe('conTotal', () => {
  it('expone data como array y total aparte, sin perder el resto del estado', () => {
    const query = { data: { items: [1, 2], total: 5 }, isLoading: false, isError: false }
    const adaptado = conTotal(query)
    expect(adaptado.data).toEqual([1, 2])
    expect(adaptado.total).toBe(5)
    expect(adaptado.isLoading).toBe(false)
  })

  it('deja data y total indefinidos mientras no hay datos', () => {
    const adaptado = conTotal({ data: undefined, isLoading: true })
    expect(adaptado.data).toBeUndefined()
    expect(adaptado.total).toBeUndefined()
  })
})
