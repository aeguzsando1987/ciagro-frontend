import { describe, it, expect, vi, afterEach } from 'vitest'
import { todayIso, isFutureDate } from './dates'

afterEach(() => vi.useRealTimers())

describe('todayIso', () => {
  it('devuelve YYYY-MM-DD en zona local (sin desfase de toISOString)', () => {
    vi.useFakeTimers()
    // 1 jul 2026 23:30 local → no debe "saltar" al día siguiente por UTC.
    vi.setSystemTime(new Date(2026, 6, 1, 23, 30, 0))
    expect(todayIso()).toBe('2026-07-01')
  })
})

describe('isFutureDate', () => {
  it('detecta fechas futuras respecto a hoy', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 6, 1, 12, 0, 0))
    expect(isFutureDate('2026-07-02')).toBe(true)
    expect(isFutureDate('2026-07-01')).toBe(false)
    expect(isFutureDate('2026-06-30')).toBe(false)
  })
})
