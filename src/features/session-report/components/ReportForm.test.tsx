import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SessionReport } from '../types'
import type { AspersionClimatePreview } from '../hooks/useReportWeather'

const mockWeather = vi.fn()
const mockClimatePreview = vi.fn()
const mockCreate = vi.fn()
const mockUpdate = vi.fn()
vi.mock('../hooks/useReportWeather', () => ({
  useReportWeather: () => ({ mutate: mockWeather, isPending: false }),
  useAspersionClimatePreview: () => ({ mutate: mockClimatePreview, isPending: false }),
}))
vi.mock('../hooks/useSessionReport', () => ({
  useCreateSessionReport: () => ({ mutate: mockCreate, isPending: false }),
  useUpdateSessionReport: () => ({ mutate: mockUpdate, isPending: false }),
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

const SESSION_WEATHER = {
  available: true, detail: null, source: 'NASA POWER + Visual Crossing Weather', time_zone: 'America/Mexico_City',
  session_start: '2026-03-10T09:00:00-06:00', session_finish: '2026-03-10T11:00:00-06:00',
  cloud_cover_mean_pct: 42, cloud_cover_source: 'Visual Crossing Weather',
  visual_crossing_attribution_url: 'https://www.visualcrossing.com/',
  precipitation_total_mm: 0.04, precipitation_category: 'minimal',
  precipitation_category_label: 'Precipitación mínima estimada',
  rain_status: 'minimal' as const, rained: false,
  rain_hours: ['2026-03-10T10:00:00-06:00'],
  rain_periods: [{ start: '2026-03-10T10:00:00-06:00', end: '2026-03-10T11:00:00-06:00', category: 'minimal' }],
  rain_hours_count: 1, wind_mean_kmh: 11, wind_max_kmh: 23, hours_sampled: 3,
}

function respondWithClimate(data: AspersionClimatePreview) {
  mockClimatePreview.mockImplementation((_vars: unknown, opts: { onSuccess: (d: AspersionClimatePreview) => void }) =>
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
  mockClimatePreview.mockReset()
  mockCreate.mockReset()
  mockUpdate.mockReset()
  toastInfo.mockReset()
  toastSuccess.mockReset()
})

describe('ReportForm — consulta combinada de clima', () => {
  it('el único botón trae temperaturas, nubosidad, lluvia y viento', async () => {
    respondWithClimate({
      day_weather: {
        available: true, detail: null, date: '2026-03-10', source: 'NASA POWER',
        mean: 21, min: 12.04, max: 30.84,
      },
      session_weather: SESSION_WEATHER,
    })
    renderForm()
    fireEvent.click(screen.getByRole('button', { name: /Traer clima del día de aplicación/i }))

    await waitFor(() => expect(temp(/Temperatura media/i).value).toBe('21'))
    expect(temp(/Temperatura baja/i).value).toBe('12')
    expect(temp(/Temperatura alta/i).value).toBe('31')
    const section = screen.getByLabelText('Clima del reporte')
    expect(within(section).getByText('Nubosidad promedio (%)')).toBeInTheDocument()
    expect(within(section).getByText('42%')).toBeInTheDocument()
    expect(within(section).getByText('0.04')).toBeInTheDocument()
    expect(within(section).getByText('Precipitación mínima')).toBeInTheDocument()
    expect(within(section).queryByRole('link', { name: 'Visual Crossing Weather' })).toBeNull()
    expect(within(section).getByText(/Fuente: NASA POWER/)).toBeInTheDocument()
    expect(within(section).getByText(/Llena automáticamente las temperaturas del día en que se aplicó/)).toBeInTheDocument()
    expect(within(section).getByText('Velocidad media del viento (km/h)')).toBeInTheDocument()
    expect(within(section).getByText('Máximo horario del viento (km/h)')).toBeInTheDocument()
    expect(within(section).queryByText(/Clasificación de precipitación/i)).toBeNull()
    expect(within(section).queryByText(/Rangos probables con lluvia/i)).toBeNull()
    const climateButtons = within(section).getAllByRole('button', { name: /Traer clima del día de aplicación/i })
    expect(climateButtons).toHaveLength(1)
    const attribution = within(section).getByText(/Llena automáticamente las temperaturas del día en que se aplicó/)
    const climateButton = within(section).getByRole('button', { name: /Traer clima del día de aplicación/i })
    expect(attribution.compareDocumentPosition(climateButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Traer clima durante la aspersión/i })).toBeNull()
    expect(toastSuccess).toHaveBeenCalled()
  })

  it('aclara que el clima es del día cuando el CSV no tiene horas reales', async () => {
    respondWithClimate({
      day_weather: {
        available: true, detail: null, date: '2026-03-10', source: 'NASA POWER',
        mean: 18, min: 12, max: 24,
      },
      session_weather: {
        ...SESSION_WEATHER,
        time_basis: 'day',
        session_start: '2026-03-10',
        session_finish: '2026-03-10',
        precipitation_total_mm: 0.4,
        rain_status: 'significant',
        rained: true,
        wind_mean_kmh: 7,
        wind_max_kmh: 14,
      },
    })
    renderForm()
    fireEvent.click(screen.getByRole('button', { name: /Traer clima del día de aplicación/i }))

    await waitFor(() => expect(temp(/Temperatura media/i).value).toBe('18'))
    const section = screen.getByLabelText('Clima del reporte')
    expect(within(section).getByText(/El CSV solo contiene fecha/)).toBeInTheDocument()
    expect(within(section).queryByText('Lluvia total del día (mm)')).toBeNull()
    expect(within(section).queryByText('¿Hubo lluvia ese día?')).toBeNull()
    expect(within(section).getByText('Velocidad media diaria del viento (km/h)')).toBeInTheDocument()
    expect(within(section).getByText('Máximo horario del viento durante el día (km/h)')).toBeInTheDocument()
    expect(within(section).queryByText('0.4')).toBeNull()
  })

  it('permite consultar el clima antes de crear un reporte', async () => {
    respondWithClimate({ day_weather: {
      available: true, detail: null, date: '2026-03-10', source: 'NASA POWER',
      mean: 21, min: 12, max: 30,
    }, session_weather: SESSION_WEATHER })
    render(<ReportForm mode="create" sessionType="aspersion" objectId="h1" canWrite />)

    fireEvent.click(screen.getByRole('button', { name: /Traer clima del día de aplicación/i }))
    await waitFor(() => expect(temp(/Temperatura media/i).value).toBe('21'))
    expect(screen.getByText('42%')).toBeInTheDocument()
  })

  it('muestra el faltante de nubosidad sin inventar un valor y distingue la lluvia', async () => {
    respondWithClimate({
      day_weather: {
        available: false, detail: 'NASA POWER aún no publica el dato.',
        date: '2026-08-17', source: 'NASA POWER', mean: null, min: null, max: null,
      },
      session_weather: { ...SESSION_WEATHER, cloud_cover_mean_pct: null },
    })
    renderForm()
    fireEvent.click(screen.getByRole('button', { name: /Traer clima del día de aplicación/i }))

    await waitFor(() => expect(screen.getByText('Sin datos disponibles')).toBeInTheDocument())
    expect(screen.getByText('Nubosidad promedio (%)')).toBeInTheDocument()
    expect(screen.getByText('Precipitación mínima')).toBeInTheDocument()
    expect(temp(/Temperatura media/i).value).toBe('')
  })

  it('no envía null en weather_during_session al crear sin consultar clima', async () => {
    render(<ReportForm mode="create" sessionType="aspersion" objectId="h1" canWrite />)
    fireEvent.change(screen.getByLabelText(/Observaciones/i), {
      target: { value: 'Aplicación revisada.' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Generar reporte de actividad/i }))

    await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1))
    expect(mockCreate.mock.calls[0]?.[0]).not.toHaveProperty('weather_during_session')
  })
})
