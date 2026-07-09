/**
 * Hook que trae los checkpoints de una sesión fitosanitaria como GeoJSON
 * (FeatureCollection sin paginar) para alimentar el mapa fitosanitario.
 *
 * GET /api/v1/monitoring/phyto/headers/<id>/checkpoints-geojson/
 */
import { useQuery } from '@tanstack/react-query'
import { tokens } from '@/lib/auth/tokens'

export type PhytoPresence = 'low' | 'warning' | 'critical'

export interface PhytoCheckpointProps {
  id: string
  presence_status: PhytoPresence
  issue: string | null
  issue_type: string | null
  stage: string | null
  stage_display: string | null
  qty: number | null
  notes: string | null
  captured_at: string | null
  photo: string | null
  photo_ref: string | null
}

export interface PhytoCheckpointFeature {
  type: 'Feature'
  geometry: { type: 'Point'; coordinates: [number, number] }
  properties: PhytoCheckpointProps
}

export interface PhytoCheckpointCollection {
  type: 'FeatureCollection'
  features: PhytoCheckpointFeature[]
}

export function usePhytoCheckPoints(headerId: string | null, enabled = true) {
  return useQuery({
    queryKey: ['phyto-checkpoints-geojson', headerId] as const,
    enabled: !!headerId && enabled,
    queryFn: async (): Promise<PhytoCheckpointCollection> => {
      const baseUrl = import.meta.env.VITE_API_BASE_URL as string
      const res = await fetch(
        `${baseUrl}/monitoring/phyto/headers/${headerId}/checkpoints-geojson/`,
        { headers: { Authorization: `Bearer ${tokens.getAccess() ?? ''}` } },
      )
      if (!res.ok) throw new Error('checkpoints no disponibles')
      return (await res.json()) as PhytoCheckpointCollection
    },
    staleTime: 60_000,
  })
}
