import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { useSoilSurfaceAnalysis } from './useSoilSurfaceAnalysis'
import { runSoilSurfaceAnalysis } from '../lib/soilSurfaceClient'
import type { SoilSurfaceAnalysis } from '../lib/soilMapSurface'

vi.mock('../lib/soilSurfaceClient', () => ({ runSoilSurfaceAnalysis: vi.fn() }))
const run = vi.mocked(runSoilSurfaceAnalysis)
const ring = [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 0],
]
const samples = [0, 1, 2].map((value) => ({ id: String(value), lng: value, lat: 0, value }))
const result: SoilSurfaceAnalysis = { min: 5, max: 7, breaks: [6], bucketCellCounts: {} }

beforeEach(() => run.mockReset())

it('no muestra rangos de pH como metros mientras llega la superficie de elevación', async () => {
  let resolveElevation!: (value: SoilSurfaceAnalysis) => void
  run.mockResolvedValueOnce(result).mockReturnValueOnce(
    new Promise((resolve) => {
      resolveElevation = resolve
    })
  )
  const hook = renderHook(
    ({ key }) =>
      useSoilSurfaceAnalysis({ ring, samples, paletteSize: 2, cacheKey: key, enabled: true }),
    { initialProps: { key: 'pH' } }
  )
  await waitFor(() => expect(hook.result.current.analysis?.min).toBe(5))
  hook.rerender({ key: 'elevation-m' })
  expect(hook.result.current.analysis).toBeNull()
  await act(async () => {
    resolveElevation({ ...result, min: 1500, max: 1600 })
  })
  expect(hook.result.current.analysis?.min).toBe(1500)
})
