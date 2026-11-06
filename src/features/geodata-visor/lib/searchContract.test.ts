import { describe, it, expect } from 'vitest'
import { searchResultSchema } from './searchContract'
import { variableStatsSchema } from '@/features/task-manager/hooks/useAspersionVariableStats'

describe('visor response contracts', () => {
  it('rejects missing nested lists instead of passing undefined to map', () => {
    const base = { count: 1, total: 1, truncated: false, plot_ids: ['p1'] }
    expect(searchResultSchema.safeParse({ ...base, producers: [{ id: 'u1', name: 'U', organization: { id: 'o1', name: 'O' } }] }).success).toBe(false)
    expect(searchResultSchema.safeParse({ ...base, count: 0, total: 0, plot_ids: [], producers: [] }).success).toBe(true)
    expect(variableStatsSchema.safeParse({ points_count: 2 }).success).toBe(false)
    expect(variableStatsSchema.safeParse({ points_count: 0, variables: [] }).success).toBe(true)
  })
})
