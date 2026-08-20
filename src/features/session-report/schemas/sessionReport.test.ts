import { describe, it, expect, vi, afterEach } from 'vitest'
import { sessionReportSchema, emptyReportForm, toWholeDegrees } from './sessionReport'

afterEach(() => vi.useRealTimers())

describe('sessionReportSchema', () => {
  it('rechaza resume vacío', () => {
    const r = sessionReportSchema.safeParse({
      resume_text: '   ',
      report_date: '2026-07-01',
      status: 'en_proceso',
    })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.issues.some((i) => i.path[0] === 'resume_text')).toBe(true)
    }
  })

  it('rechaza fecha futura', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 6, 1, 12, 0, 0))
    const r = sessionReportSchema.safeParse({
      resume_text: 'ok',
      report_date: '2026-07-02',
      status: 'en_proceso',
    })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.issues.some((i) => i.path[0] === 'report_date')).toBe(true)
    }
  })

  it('acepta un reporte válido', () => {
    const r = sessionReportSchema.safeParse({
      resume_text: 'Observación válida',
      report_date: '2026-06-30',
      day_temperature: '28',
      lead: 'Juan',
      ranch_manager: 'María',
      status: 'finalizado',
    })
    expect(r.success).toBe(true)
  })

  it('rechaza temperatura no numérica', () => {
    const r = sessionReportSchema.safeParse({
      resume_text: 'ok',
      report_date: '2026-06-30',
      day_temperature: 'abc',
      status: 'en_proceso',
    })
    expect(r.success).toBe(false)
  })

  it('rechaza temperatura con decimales (el campo es en grados enteros)', () => {
    const r = sessionReportSchema.safeParse({
      resume_text: 'ok',
      report_date: '2026-06-30',
      day_temperature: '28.5',
      status: 'en_proceso',
    })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.issues.some((i) => /enteros/.test(i.message))).toBe(true)
    }
  })

  it('acepta la coma decimal que pinta el locale es-MX', () => {
    // El input type=number muestra "20,00" en es-MX; Number("20,00") es NaN, así
    // que sin normalizar la coma un valor correcto se vería como inválido.
    const r = sessionReportSchema.safeParse({
      resume_text: 'ok',
      report_date: '2026-06-30',
      day_temperature: '20,00',
      status: 'en_proceso',
    })
    expect(r.success).toBe(true)
  })

  it('toWholeDegrees redondea y tolera coma, vacío y nulo', () => {
    expect(toWholeDegrees(30.84)).toBe('31')
    expect(toWholeDegrees(12.04)).toBe('12')
    expect(toWholeDegrees('28,50')).toBe('29')
    expect(toWholeDegrees('')).toBe('')
    expect(toWholeDegrees(null)).toBe('')
  })

  it('emptyReportForm arranca en_proceso con fecha de hoy', () => {
    const f = emptyReportForm()
    expect(f.status).toBe('en_proceso')
    expect(f.report_date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(f.resume_text).toBe('')
  })
})
