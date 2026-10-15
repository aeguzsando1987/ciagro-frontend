import { useMemo } from 'react'

import { useAspersionSessionHeaders } from './useAspersionSessionHeaders'
import { useNdviSessionHeaders } from './useNdviSessionHeaders'
import { usePhytoSessionHeaders } from './usePhytoSessionHeaders'
import { useSoilMapSessionHeaders } from './useSoilMapSessionHeaders'
import { useYieldMapHeaders } from '@/features/yield-map/hooks/useYieldMapHeaders'
import { usePlantingMapHeaders } from '@/features/planting-map/hooks/usePlantingMapHeaders'
import { buildPlotTree, type PlotTree, type TreeSession } from '../lib/plotSessionTree'

/**
 * Sesiones de los seis tipos de una parcela.
 *
 * `sessions` expone la colección normalizada además del árbol. Esto permite que la
 * vista de parcela pinte una sola línea de tiempo multisesión sin volver a conocer
 * los contratos particulares de cada endpoint.
 */
export function usePlotSessionTree(plotId: string) {
  const aspersion = useAspersionSessionHeaders(plotId)
  const phyto = usePhytoSessionHeaders(plotId)
  const ndvi = useNdviSessionHeaders(plotId)
  const soil = useSoilMapSessionHeaders(plotId)
  const yieldMap = useYieldMapHeaders(plotId)
  const planting = usePlantingMapHeaders(plotId)
  const queries = [aspersion, phyto, ndvi, soil, yieldMap, planting]

  const sessions = useMemo<TreeSession[]>(
    () => [
      ...(aspersion.data ?? []).map((s) => ({
        id: s.id,
        kind: 'aspersion' as const,
        date: s.aspersion_date ?? null,
        points_count: Number(s.points_count ?? 0),
        cycle: s.program_cycle,
      })),
      ...(phyto.data ?? []).map((s) => ({
        id: s.id,
        kind: 'phyto' as const,
        date: s.started_at?.slice(0, 10) ?? s.estimated_start_date ?? null,
        points_count: Number(s.checkpoints_count ?? 0),
        cycle: s.program_cycle,
      })),
      ...(ndvi.data ?? []).map((s) => ({
        id: s.id,
        kind: 'ndvi' as const,
        date: s.session_date ?? null,
        points_count: Number(s.points_count ?? 0),
        cycle: s.program_cycle,
      })),
      ...(soil.data ?? []).map((s) => ({
        id: s.id,
        kind: 'soil_map' as const,
        date: s.mapping_date ?? null,
        points_count: Number(s.points_count ?? 0),
        cycle: s.program_cycle,
      })),
      ...(yieldMap.data ?? []).map((s) => ({
        id: s.id,
        kind: 'yield_map' as const,
        date: s.harvest_date ?? null,
        points_count: Number(s.points_count ?? 0),
        cycle: s.program_cycle,
      })),
      ...(planting.data ?? []).map((s) => ({
        id: s.id,
        kind: 'planting_map' as const,
        date: s.planting_date ?? null,
        points_count: Number(s.points_count ?? 0),
        cycle: s.program_cycle,
      })),
    ],
    [aspersion.data, phyto.data, ndvi.data, soil.data, yieldMap.data, planting.data]
  )

  const tree = useMemo<PlotTree>(() => buildPlotTree(sessions), [sessions])

  // FASE PAG: el Visor no trunca en silencio. `total` es lo que declara el backend;
  // si llegaron menos sesiones de las que existen, la vista lo avisa ("X de Y").
  const total = queries.reduce((sum, q) => sum + (q.total ?? q.data?.length ?? 0), 0)
  const missing = Math.max(0, total - sessions.length)

  return {
    tree,
    sessions,
    total,
    missing,
    isLoading: queries.some((q) => q.isLoading),
    isError: queries.some((q) => q.isError),
    refetch: () => queries.filter((q) => q.isError).forEach((q) => void q.refetch()),
  }
}
