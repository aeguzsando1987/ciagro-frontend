import { queryOptions, useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api/client'
import type { components } from '@/types/api'

export type SoilMapPoint = components['schemas']['SoilMapPoints']

/**
 * Lo que devuelve la precarga: identificador y geometría, nada más.
 *
 * El tipo generado declara los 57 campos como presentes porque se deriva del
 * serializer completo; con `?fields=` la respuesta es un subconjunto. El
 * estrechamiento vive aquí, del lado del cliente: relajar `api.d.ts` para
 * acomodar la respuesta parcial dejaría sin contrato al resto de la app.
 */
export type SoilMapPointGeom = Pick<SoilMapPoint, 'id' | 'geom'>

const PAGE_SIZE = 2000 // Máximo que permite GeoPointsPagination en el backend.

/**
 * Recorre todas las páginas del endpoint de puntos pidiendo solo `fields`.
 *
 * El endpoint pagina de a 2000, así que una sesión abre `ceil(puntos / 2000)`
 * peticiones: 1 con 1,500 puntos, 9 con 16,944, 20 con 40,000. Ese número no se
 * asume en ninguna parte — sale del `count` de la primera respuesta, que es más
 * confiable que encadenar por `next` porque permite saber de antemano cuánto falta.
 *
 * LAS PÁGINAS VAN EN SERIE, Y ES DELIBERADO. Se probó pedirlas juntas y resultó
 * MÁS LENTO: sobre la sesión de 16,944 puntos, 3.1 s en serie contra 4.7 s en
 * paralelo, consistente en tres rondas. En desarrollo corre `manage.py runserver`,
 * un proceso Python con GIL que no atiende peticiones concurrentes en paralelo
 * sino que las hace estorbarse; y en producción son 3 workers de gunicorn, así
 * que disparar 8 peticiones pesadas a la vez los ocuparía todos y dejaría al
 * resto del sistema esperando por un solo usuario abriendo un mapa.
 *
 * La ganancia real no venía de la concurrencia sino de pedir menos columnas:
 * 55.7 s con los 57 campos contra 3.7 s con la precarga y una capa.
 */
export async function fetchSoilMapPointPages<T>(
  headerId: string,
  fields: string
): Promise<T[]> {
  async function fetchPage(page: number) {
    const { data, error } = await apiClient.GET('/api/v1/monitoring/soil-map/points/', {
      params: { query: { smh_header: headerId, fields, page_size: PAGE_SIZE, page } },
    })
    if (error || !data) {
      throw new Error(`Error al cargar puntos de suelo (página ${page})`)
    }
    return data
  }

  const first = await fetchPage(1)
  const totalPages = Math.ceil(first.count / PAGE_SIZE)
  const rows = [...first.results]

  // El orden de acumulación importa más de lo que parece: `analyzeSoilSurface`
  // submuestrea tomando uno de cada N cuando hay más de 1000 puntos, así que un
  // orden distinto movería los cortes de la leyenda y las hectáreas del reporte.
  for (let page = 2; page <= totalPages; page += 1) {
    const next = await fetchPage(page)
    rows.push(...next.results)
  }

  return rows as unknown as T[]
}

/** Precarga del Visor: dónde están los puntos, sin ningún valor de capa. */
export async function fetchAllSoilMapPoints(headerId: string): Promise<SoilMapPointGeom[]> {
  return fetchSoilMapPointPages<SoilMapPointGeom>(headerId, 'id,geom')
}

export function soilMapPointsQueryOptions(headerId: string | null, enabled = true) {
  return queryOptions({
    queryKey: ['soil-map-points', headerId] as const,
    enabled: !!headerId && enabled,
    queryFn: () => fetchAllSoilMapPoints(headerId!),
    staleTime: 5 * 60_000,
  })
}

export function useSoilMapPoints(headerId: string | null, enabled = true) {
  return useQuery(soilMapPointsQueryOptions(headerId, enabled))
}
