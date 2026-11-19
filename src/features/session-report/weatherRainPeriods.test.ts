import { describe, expect, it } from 'vitest'
import { formatRainPeriods } from './weatherRainPeriods'

describe('formatRainPeriods', () => {
  it('condensa las horas consecutivas de snapshots anteriores en un rango', () => {
    const start = new Date('2026-11-10T15:00:00-06:00')
    const rainHours = Array.from({ length: 43 }, (_, index) =>
      new Date(start.getTime() + index * 60 * 60 * 1000).toISOString()
    )

    const periods = formatRainPeriods({ rain_hours: rainHours })

    expect(periods).toHaveLength(1)
    expect(periods[0]).toContain('10/11/2026')
    expect(periods[0]).toContain('12/11/2026')
    expect(periods[0]).toContain('03:00 p.m.')
    expect(periods[0]).toContain('10:00 a.m.')
  })

  it('mantiene separados los periodos con una hora seca entre ellos', () => {
    const periods = formatRainPeriods({
      rain_hours: [
        '2026-11-10T15:00:00-06:00',
        '2026-11-10T16:00:00-06:00',
        '2026-11-10T18:00:00-06:00',
      ],
    })

    expect(periods).toHaveLength(2)
  })
})
