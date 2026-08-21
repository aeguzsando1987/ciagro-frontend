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

/**
 * Recorre todas las páginas de un listado.
 *
 * @param pedir recibe los parámetros de página y devuelve la respuesta cruda.
 *   Se pasa como función para que cada hook conserve su propia ruta y sus tipos.
 */
export async function fetchAllPages<T>(
  pedir: (params: { page: number; page_size: number }) => Promise<RespuestaPaginada<T>>
): Promise<T[]> {
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

  return acumulado
}
