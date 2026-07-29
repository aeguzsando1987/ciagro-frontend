/**
 * Carga TODOS los puntos de una sesión NDVI (paginado, siguiendo `next`).
 *
 * GET /api/v1/monitoring/ndvi/points/?session_header=<id>&page_size=2000
 *
 * Devuelve objetos planos con `geom` (GeoJSON Point) y los 15 índices como número|null,
 * tal como los entrega NdviSessionPointsSerializer. La clasificación por clases (cuartiles)
 * y el color se calculan en el cliente (NdviMap).
 */
import { useQuery } from '@tanstack/react-query'
import { tokens } from '@/lib/auth/tokens'

export interface NdviPoint {
  id: string
  geom: GeoJSON.Point
  obj_id: number | null
  ndvi: number | null
  nir_vigor: number | null
  osavi: number | null
  vari: number | null
  bare_soil_index: number | null
  image_red: number | null
  image_green: number | null
  image_blue: number | null
  red_edge: number | null
  swir: number | null
  ndre: number | null
  msavi2: number | null
  gndvi: number | null
  ndmi: number | null
  psri: number | null
}

interface PaginatedPoints {
  count: number
  next: string | null
  previous: string | null
  results: NdviPoint[]
}

const PAGE_SIZE = 2000

async function fetchAllNdviPoints(sessionId: string): Promise<NdviPoint[]> {
  const baseUrl = import.meta.env.VITE_API_BASE_URL as string
  const all: NdviPoint[] = []
  let page = 1
  for (;;) {
    const url = `${baseUrl}/monitoring/ndvi/points/?session_header=${sessionId}&page_size=${PAGE_SIZE}&page=${page}`
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${tokens.getAccess() ?? ''}` },
    })
    if (!res.ok) throw new Error(`Error al cargar puntos NDVI (página ${page}): ${res.status}`)
    const data = (await res.json()) as PaginatedPoints
    all.push(...data.results)
    if (!data.next) break
    page += 1
  }
  return all
}

export function useNdviPoints(sessionId: string | null) {
  return useQuery({
    queryKey: ['ndvi-points', sessionId] as const,
    enabled: !!sessionId,
    queryFn: () => fetchAllNdviPoints(sessionId as string),
    staleTime: 60_000,
  })
}
