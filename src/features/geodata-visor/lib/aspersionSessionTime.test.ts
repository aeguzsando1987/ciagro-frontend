import { describe, expect, it } from 'vitest'
import { sessionClock, sessionDateAndClock, sessionDateTime } from './aspersionSessionTime'

describe('horarios reales de aspersión', () => {
  it('muestra la hora que viene en los timestamps, sin convertirla en UTC', () => {
    expect(sessionClock('2026-10-28T10:15:24-06:00')).toBe('10:15:24 a.m.')
    expect(sessionDateAndClock('2026-10-28T15:18:41-06:00', '2026-10-28')).toBe('03:18:41 p.m.')
  })

  it('incluye la fecha cuando el archivo contiene varios días', () => {
    expect(sessionDateAndClock('2026-11-09T18:03:58-06:00', '2026-11-07')).toBe('09/11/2026 06:03:58 p.m.')
    expect(sessionDateTime('2026-11-10T21:18:26-06:00')).toBe('10/11/2026 09:18:26 p.m.')
  })

  it('no inventa fechas ni horarios ausentes', () => {
    expect(sessionClock(null)).toBeNull()
    expect(sessionDateTime('2026-11-10')).toBe('10/11/2026')
    expect(sessionDateAndClock('', '2026-11-07')).toBeNull()
    expect(sessionDateAndClock('no-fecha', '2026-11-07')).toBeNull()
  })
})
