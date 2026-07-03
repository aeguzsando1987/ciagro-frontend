import { describe, it, expect, vi, afterEach } from 'vitest'
import { sessionReportSchema, emptyReportForm } from './sessionReport'

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
      day_temperature: '28.5',
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

  it('emptyReportForm arranca en_proceso con fecha de hoy', () => {
    const f = emptyReportForm()
    expect(f.status).toBe('en_proceso')
    expect(f.report_date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(f.resume_text).toBe('')
  })
})
