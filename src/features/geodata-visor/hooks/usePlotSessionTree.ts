import { useMemo } from 'react'

import { useAspersionSessionHeaders } from './useAspersionSessionHeaders'
import { useNdviSessionHeaders } from './useNdviSessionHeaders'
import { usePhytoSessionHeaders } from './usePhytoSessionHeaders'
import { useSoilMapSessionHeaders } from './useSoilMapSessionHeaders'
import { useYieldMapHeaders } from '@/features/yield-map/hooks/useYieldMapHeaders'
import { usePlantingMapHeaders } from '@/features/planting-map/hooks/usePlantingMapHeaders'
import { buildPlotTree, type PlotTree, type TreeSession } from '../lib/plotSessionTree'

/** Sesiones de los seis tipos de una parcela, ya armadas como arbol (FASE CV). */
export function usePlotSessionTree(plotId: string) {
  const aspersion = useAspersionSessionHeaders(plotId)
  const phyto = usePhytoSessionHeaders(plotId)
  const ndvi = useNdviSessionHeaders(plotId)
  const soil = useSoilMapSessionHeaders(plotId)
  const yieldMap = useYieldMapHeaders(plotId)
  const planting = usePlantingMapHeaders(plotId)
  const queries = [aspersion, phyto, ndvi, soil, yieldMap, planting]

  const tree = useMemo<PlotTree>(() => {
    // Fecha canonica de cada tipo, la misma que ya mostraba el arbol.
    const sessions: TreeSession[] = [
      ...(aspersion.data ?? []).map((s) => ({
        id: s.id, kind: 'aspersion' as const, date: s.aspersion_date ?? null,
        points_count: Number(s.points_count ?? 0), cycle: s.program_cycle,
      })),
      ...(phyto.data ?? []).map((s) => ({
        id: s.id, kind: 'phyto' as const, date: s.estimated_start_date ?? null,
        points_count: Number(s.checkpoints_count ?? 0), cycle: s.program_cycle,
      })),
      ...(ndvi.data ?? []).map((s) => ({
        id: s.id, kind: 'ndvi' as const, date: s.session_date ?? null,
        points_count: Number(s.points_count ?? 0), cycle: s.program_cycle,
      })),
      ...(soil.data ?? []).map((s) => ({
        id: s.id, kind: 'soil_map' as const, date: s.mapping_date ?? null,
        points_count: Number(s.points_count ?? 0), cycle: s.program_cycle,
      })),
      ...(yieldMap.data ?? []).map((s) => ({
        id: s.id, kind: 'yield_map' as const, date: s.harvest_date ?? null,
        points_count: Number(s.points_count ?? 0), cycle: s.program_cycle,
      })),
      ...(planting.data ?? []).map((s) => ({
        id: s.id, kind: 'planting_map' as const, date: s.planting_date ?? null,
        points_count: Number(s.points_count ?? 0), cycle: s.program_cycle,
      })),
    ]
    return buildPlotTree(sessions)
  }, [aspersion.data, phyto.data, ndvi.data, soil.data, yieldMap.data, planting.data])

  return {
    tree,
    isLoading: queries.some((q) => q.isLoading),
    isError: queries.some((q) => q.isError),
    refetch: () => queries.filter((q) => q.isError).forEach((q) => void q.refetch()),
  }
}
