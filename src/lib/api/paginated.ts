/**
 * Lectura completa de un listado paginado.
 *
 * El backend pagina con `StandardPagination`: `page_size` por defecto 100 y máximo
 * 1000. Los hooks del panel leían `data.results` y se quedaban con la PRIMERA página,
 * descartando el resto sin ningún aviso. En un árbol de navegación eso es un nodo que
 * falta; en el selector de parcelas del alcance es peor, porque son parcelas que el
 * gerente cree haber asignado y no asignó.
 *
 * Estrategia: pedir de golpe el máximo que el backend admite y, solo si el `count`
 * dice que aún falta, seguir pidiendo páginas. En la práctica es UNA petición salvo
 * en los casos grandes de verdad, en vez de encadenar N peticiones siempre.
 */

/** Tope de `StandardPagination` en el backend (`apps/core/pagination.py`). */
export const MAX_PAGE_SIZE = 1000

/** Cota de seguridad: evita un bucle infinito si `count` y los datos no concuerdan. */
const MAX_PAGINAS = 20

type RespuestaPaginada<T> = {
  count?: number
  results?: T[] | { features?: T[] } | null
} | null

/** Extrae los elementos tanto de un listado normal como de un FeatureCollection GeoJSON. */
function elementosDe<T>(respuesta: RespuestaPaginada<T>): T[] {
  const results = respuesta?.results
  if (!results) return []
  if (Array.isArray(results)) return results
  return results.features ?? []
}

/** Elementos leídos más el total que declaró el backend (`count`). */
export interface ListadoCompleto<T> {
  items: T[]
  total: number
}

/**
 * Recorre todas las páginas de un listado y conserva el `count` del backend.
 *
 * `total > items.length` solo ocurre si se agotó la cota de MAX_PAGINAS o el backend
 * dejó de servir páginas: es la señal para avisar "se muestran X de Y" en vez de
 * truncar en silencio (FASE PAG).
 *
 * @param pedir recibe los parámetros de página y devuelve la respuesta cruda.
 *   Se pasa como función para que cada hook conserve su propia ruta y sus tipos.
 */
export async function fetchAllPagesWithTotal<T>(
  pedir: (params: { page: number; page_size: number }) => Promise<RespuestaPaginada<T>>
): Promise<ListadoCompleto<T>> {
  const primera = await pedir({ page: 1, page_size: MAX_PAGE_SIZE })
  const acumulado = elementosDe(primera)

  const total = primera?.count ?? acumulado.length
  // `count` es el total del backend; mientras tengamos menos, falta cola por leer.
  for (let page = 2; acumulado.length < total && page <= MAX_PAGINAS; page += 1) {
    const siguiente = await pedir({ page, page_size: MAX_PAGE_SIZE })
    const lote = elementosDe(siguiente)
    // Sin esta salida, una respuesta vacía con `count` alto giraría hasta MAX_PAGINAS.
    if (lote.length === 0) break
    acumulado.push(...lote)
  }

  return { items: acumulado, total: Math.max(total, acumulado.length) }
}

/** Recorre todas las páginas de un listado. Ver `fetchAllPagesWithTotal`. */
export async function fetchAllPages<T>(
  pedir: (params: { page: number; page_size: number }) => Promise<RespuestaPaginada<T>>
): Promise<T[]> {
  return (await fetchAllPagesWithTotal(pedir)).items
}

/**
 * Adapta el resultado de un `useQuery` cuyo dato es un `ListadoCompleto`: los
 * consumidores siguen leyendo `data` como array y además tienen `total`.
 */
export function conTotal<Q extends { data: ListadoCompleto<unknown> | undefined }>(
  query: Q
): Omit<Q, 'data'> & { data: ElementoDe<Q>[] | undefined; total: number | undefined } {
  const listado = query.data as ListadoCompleto<ElementoDe<Q>> | undefined
  return { ...query, data: listado?.items, total: listado?.total }
}

/** Tipo de elemento del `ListadoCompleto` que guarda un query. */
type ElementoDe<Q extends { data: unknown }> =
  NonNullable<Q['data']> extends ListadoCompleto<infer T> ? T : never
