import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { usePlotSessionTree } from './usePlotSessionTree'

/**
 * FASE PAG: el arbol informa si llegaron menos sesiones de las que declara el backend,
 * para que el Visor avise "X de Y" en lugar de truncar en silencio (GAP-PAG-1).
 */
const estado = vi.hoisted(() => ({
  ndvi: { data: [] as unknown[], total: undefined as number | undefined },
}))

const vacio = { data: [], total: 0, isLoading: false, isError: false, refetch: vi.fn() }

vi.mock('./useAspersionSessionHeaders', () => ({ useAspersionSessionHeaders: () => vacio }))
vi.mock('./usePhytoSessionHeaders', () => ({ usePhytoSessionHeaders: () => vacio }))
vi.mock('./useSoilMapSessionHeaders', () => ({ useSoilMapSessionHeaders: () => vacio }))
vi.mock('@/features/yield-map/hooks/useYieldMapHeaders', () => ({ useYieldMapHeaders: () => vacio }))
vi.mock('@/features/planting-map/hooks/usePlantingMapHeaders', () => ({
  usePlantingMapHeaders: () => vacio,
}))
vi.mock('./useNdviSessionHeaders', () => ({
  useNdviSessionHeaders: () => ({
    ...vacio,
    data: estado.ndvi.data,
    total: estado.ndvi.total,
  }),
}))

function ndvi(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    id: `n${i}`,
    session_date: '2025-01-01',
    points_count: 1,
    program_cycle: 'Primavera-Invierno-2025',
  }))
}

describe('usePlotSessionTree: sesiones faltantes', () => {
  beforeEach(() => {
    estado.ndvi = { data: [], total: undefined }
  })

  it('missing = 0 cuando llegaron todas las que declara el backend', () => {
    estado.ndvi = { data: ndvi(92), total: 92 }
    const { result } = renderHook(() => usePlotSessionTree('plot-1'))
    expect(result.current.sessions).toHaveLength(92)
    expect(result.current.total).toBe(92)
    expect(result.current.missing).toBe(0)
  })

  it('missing cuenta lo que no llego', () => {
    estado.ndvi = { data: ndvi(25), total: 92 }
    const { result } = renderHook(() => usePlotSessionTree('plot-1'))
    expect(result.current.total).toBe(92)
    expect(result.current.missing).toBe(67)
  })

  it('sin total (mocks y respuestas antiguas) no inventa faltantes', () => {
    estado.ndvi = { data: ndvi(3), total: undefined }
    const { result } = renderHook(() => usePlotSessionTree('plot-1'))
    expect(result.current.missing).toBe(0)
  })
})
