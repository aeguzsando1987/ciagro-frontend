import { z } from 'zod'

const ref = z.object({ id: z.string(), name: z.string() })
export const searchResultSchema = z.object({
  count: z.number(), total: z.number(), truncated: z.boolean(), plot_ids: z.array(z.string()),
  producers: z.array(ref.extend({
    organization: ref.nullable(),
    ranches: z.array(ref.extend({
      plots: z.array(z.object({
        id: z.string(), code: z.string(), sessions: z.array(z.object({
          id: z.string(), kind: z.enum(['aspersion', 'phyto', 'ndvi', 'soil_map', 'yield_map', 'planting_map']),
          date: z.string().nullable(), points_count: z.number(), program_cycle: z.string().nullable().optional(),
        })),
      })),
    })),
  })),
})
