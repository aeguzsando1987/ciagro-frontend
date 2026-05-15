import { describe, it, expect } from 'vitest'
import { parseDate, resolveRange, pointRange, isOutOfRange } from './dateUtils'

describe('parseDate', () => {
  it('parsea ISO date valido', () => {
    const d = parseDate('2026-06-01')
    expect(d).toBeInstanceOf(Date)
    expect(d?.getUTCFullYear()).toBe(2026)
    expect(d?.getUTCMonth()).toBe(5) // junio (0-indexed)
  })

  it('parsea ISO date-time valido', () => {
    const d = parseDate('2026-06-15T10:30:00Z')
    expect(d?.getUTCFullYear()).toBe(2026)
    expect(d?.getUTCHours()).toBe(10)
  })

  it('devuelve null para null/undefined/string vacio', () => {
    expect(parseDate(null)).toBeNull()
    expect(parseDate(undefined)).toBeNull()
    expect(parseDate('')).toBeNull()
  })

  it('devuelve null para string invalido', () => {
    expect(parseDate('no-es-fecha')).toBeNull()
  })
})

describe('resolveRange', () => {
  it('usa las fechas tal cual si ambas son validas', () => {
    const r = resolveRange('2026-06-01', '2026-08-31')
    expect(r.start.getUTCMonth()).toBe(5) // junio
    expect(r.end.getUTCMonth()).toBe(7) // agosto
  })

  it('aplica fallback si start es null', () => {
    const r = resolveRange(null, '2026-08-31')
    expect(r.start).toBeInstanceOf(Date)
    expect(r.end.getUTCMonth()).toBe(7)
  })

  it('aplica fallback si end es null', () => {
    const r = resolveRange('2026-06-01', null)
    expect(r.start.getUTCMonth()).toBe(5)
    expect(r.end).toBeInstanceOf(Date)
  })

  it('garantiza start < end aunque los inputs sean iguales o invertidos', () => {
    const r = resolveRange('2026-06-15', '2026-06-15')
    expect(r.start.getTime()).toBeLessThan(r.end.getTime())
  })

  it('arregla rangos invertidos (end antes que start)', () => {
    const r = resolveRange('2026-08-31', '2026-06-01')
    expect(r.start.getTime()).toBeLessThan(r.end.getTime())
  })
})

describe('pointRange', () => {
  it('devuelve un rango de 1 dia desde una fecha puntual', () => {
    const r = pointRange('2026-07-10')
    const diff = r.end.getTime() - r.start.getTime()
    expect(diff).toBe(86_400_000) // 1 dia en ms
  })

  it('usa hoy si la fecha es null', () => {
    const r = pointRange(null)
    expect(r.start).toBeInstanceOf(Date)
    expect(r.end.getTime() - r.start.getTime()).toBe(86_400_000)
  })
})

describe('isOutOfRange', () => {
  const parent = { start: new Date('2026-06-01'), end: new Date('2026-08-31') }

  it('detecta hijo con start anterior al padre', () => {
    const child = { start: new Date('2026-05-15'), end: new Date('2026-07-15') }
    expect(isOutOfRange(child, parent)).toBe(true)
  })

  it('detecta hijo con end posterior al padre', () => {
    const child = { start: new Date('2026-07-01'), end: new Date('2026-09-15') }
    expect(isOutOfRange(child, parent)).toBe(true)
  })

  it('hijo dentro del padre: false', () => {
    const child = { start: new Date('2026-07-01'), end: new Date('2026-07-15') }
    expect(isOutOfRange(child, parent)).toBe(false)
  })

  it('hijo en los limites exactos del padre: false', () => {
    const child = { start: new Date('2026-06-01'), end: new Date('2026-08-31') }
    expect(isOutOfRange(child, parent)).toBe(false)
  })
})
