/**
 * Tests del botón "Traer clima" (FASE KM).
 *
 * Lo que se fija aquí es la decisión de diseño: el botón RELLENA el formulario,
 * no guarda. Por eso se comprueba el valor de los inputs y no una mutación de
 * actualización.
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SessionReport } from '../types'
import type { ReportWeather } from '../hooks/useReportWeather'

const mockWeather = vi.fn()
vi.mock('../hooks/useReportWeather', () => ({
  useReportWeather: () => ({ mutate: mockWeather, isPending: false }),
}))
vi.mock('../hooks/useSessionReport', () => ({
  useCreateSessionReport: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateSessionReport: () => ({ mutate: vi.fn(), isPending: false }),
}))

const toastInfo = vi.fn()
const toastSuccess = vi.fn()
vi.mock('sonner', () => ({
  toast: {
    info: (...a: unknown[]) => toastInfo(...a),
    success: (...a: unknown[]) => toastSuccess(...a),
    error: vi.fn(),
  },
}))

import { ReportForm } from './ReportForm'

const REPORT = {
  id: 'r1', session_type: 'aspersion', object_id: 'h1', activity_label: 'Aspersión',
  plot: 'p1', resume_text: 'Resumen', report_date: '2026-03-12',
  day_temperature: null, day_temperature_min: null, day_temperature_max: null,
  lead: '', ranch_manager: '', figure_description: '', status: 'en_proceso',
  general_snapshot: {}, stats_snapshot: {}, issues: [],
} as unknown as SessionReport

/** Deja que el hook responda con `data` al pulsar el botón. */
function respondWith(data: ReportWeather) {
  mockWeather.mockImplementation((_vars: unknown, opts: { onSuccess: (d: ReportWeather) => void }) =>
    opts.onSuccess(data)
  )
}

function renderForm() {
  return render(
    <ReportForm mode="edit" sessionType="aspersion" objectId="h1" report={REPORT} canWrite />
  )
}

const temp = (label: RegExp) => screen.getByLabelText(label) as HTMLInputElement

beforeEach(() => {
  mockWeather.mockReset()
  toastInfo.mockReset()
  toastSuccess.mockReset()
})

describe('ReportForm — botón de clima', () => {
  it('rellena las tres temperaturas cuando NASA POWER tiene el dato', async () => {
    respondWith({
      available: true, detail: null, date: '2026-03-10', source: 'NASA POWER',
      mean: 21.0, min: 12.04, max: 30.84,
    })
    renderForm()
    fireEvent.click(screen.getByRole('button', { name: /Traer clima/i }))

    // Se redondean a grados enteros: POWER devuelve 12.04 / 30.84, pero el
    // campo es entero (y con decimales el navegador disparaba su propio
    // "Introduce un valor válido" por stepMismatch).
    await waitFor(() => expect(temp(/Temperatura media/i).value).toBe('21'))
    expect(temp(/Temperatura mínima/i).value).toBe('12')
    expect(temp(/Temperatura máxima/i).value).toBe('31')
    expect(toastSuccess).toHaveBeenCalled()
  })

  it('avisa sin ensuciar los campos cuando POWER aún no publica esa fecha', async () => {
    // El archivo de POWER va 4-5 días atrás: no tener dato NO es un error.
    respondWith({
      available: false, detail: 'NASA POWER todavía no publica el clima de esa fecha.',
      date: '2026-08-17', source: 'NASA POWER', mean: null, min: null, max: null,
    })
    renderForm()
    fireEvent.click(screen.getByRole('button', { name: /Traer clima/i }))

    await waitFor(() => expect(toastInfo).toHaveBeenCalled())
    expect(temp(/Temperatura media/i).value).toBe('')
    expect(temp(/Temperatura mínima/i).value).toBe('')
    expect(toastSuccess).not.toHaveBeenCalled()
  })

  it('no ofrece el botón al crear el reporte (aún no hay reporte que consultar)', () => {
    render(<ReportForm mode="create" sessionType="aspersion" objectId="h1" canWrite />)
    expect(screen.queryByRole('button', { name: /Traer clima/i })).toBeNull()
  })
})
