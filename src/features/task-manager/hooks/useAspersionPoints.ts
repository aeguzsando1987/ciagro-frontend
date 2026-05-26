/**
 * Hook para cargar TODOS los puntos de telemetría de una sesión de aspersión.
 *
 * El endpoint GET /api/v1/monitoring/aspersion/points/ usa GeoPointsPagination
 * (page_size default 500, max 2000). Una sesión puede tener 900–3700 puntos,
 * por lo que el hook itera todas las páginas siguiendo el campo `next` hasta
 * acumular el arreglo completo antes de resolver.
 *
 * Retorna AspersionPoint[] (objetos planos con geom Point y campos decimal-string),
 * tal como los entrega AspersionSessionPointsSerializer (GeoModelSerializer legacy).
 * La conversión a FeatureCollection de rectángulos se hace en plotRectangles.ts.
 */
import { useQuery } from '@tanstack/react-query'
import { tokens } from '@/lib/auth/tokens'
import type { components } from '@/types/api'

export type AspersionPoint = components['schemas']['AspersionSessionPoints']

interface PaginatedPointsResponse {
  count: number
  next: string | null
  previous: string | null
  results: AspersionPoint[]
}

const PAGE_SIZE = 2000 // Máximo permitido por GeoPointsPagination

async function fetchAllPoints(sessionId: string): Promise<AspersionPoint[]> {
  const baseUrl = import.meta.env.VITE_API_BASE_URL as string
  const allPoints: AspersionPoint[] = []
  let page = 1

  while (true) {
    const url = `${baseUrl}/monitoring/aspersion/points/?session_header=${sessionId}&page_size=${PAGE_SIZE}&page=${page}`
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${tokens.getAccess() ?? ''}` },
    })
    if (!res.ok) {
      throw new Error(`Error al cargar puntos de aspersión (página ${page}): ${res.status}`)
    }
    const data = (await res.json()) as PaginatedPointsResponse
    allPoints.push(...data.results)

    if (!data.next) break
    page += 1
  }

  return allPoints
}

/** Carga todos los puntos de una sesión, iterando páginas. Usar solo cuando la sesión tiene puntos. */
export function useAspersionPoints(sessionId: string | null, enabled = true) {
  return useQuery({
    queryKey: ['aspersion-points', sessionId] as const,
    enabled: !!sessionId && enabled,
    queryFn: () => fetchAllPoints(sessionId!),
    staleTime: 5 * 60_000, // 5 minutos: los puntos no cambian salvo reimportación
  })
}
