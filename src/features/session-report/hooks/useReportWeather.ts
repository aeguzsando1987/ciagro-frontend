/**
 * Consulta del clima del día de aspersión (FASE KM).
 *
 * El endpoint NO escribe en el reporte: devuelve las tres temperaturas y el
 * formulario las rellena con `setValue`. Así el analista ve el valor antes de
 * guardarlo y lo puede corregir, y el botón funciona igual en un reporte
 * publicado (no toca snapshots congelados).
 *
 * Se usa `fetch` a mano en vez de `apiClient` por el mismo motivo que
 * useReportAssets: hace falta el token puesto explícitamente.
 */
import { useMutation } from '@tanstack/react-query'
import { tokens } from '@/lib/auth/tokens'

const baseUrl = import.meta.env.VITE_API_BASE_URL as string

export interface ReportWeather {
  /** false cuando NASA POWER aún no publica esa fecha (va 4-5 días atrás). */
  available: boolean
  /** Explicación cuando `available` es false; null si hay dato. */
  detail: string | null
  date: string
  source: string
  mean: number | null
  min: number | null
  max: number | null
}

export interface ReportSessionWeather {
  available: boolean
  detail: string | null
  source: string
  time_zone: string
  session_start: string
  session_finish: string
  cloud_cover_mean_pct: number | null
  cloud_cover_source?: string | null
  visual_crossing_attribution_url?: string | null
  precipitation_total_mm: number | null
  precipitation_category?: string | null
  precipitation_category_label?: string | null
  rain_status?: 'significant' | 'minimal' | 'none' | 'unavailable'
  rained: boolean | null
  rain_hours: string[]
  rain_periods?: Array<{ start: string; end: string; category?: string }>
  rain_hours_count: number | null
  wind_mean_kmh: number | null
  wind_max_kmh: number | null
  hours_sampled: number
}

export interface AspersionClimatePreview {
  day_weather: ReportWeather
  session_weather: ReportSessionWeather
}

export function useReportWeather(reportId: string) {
  return useMutation({
    mutationFn: async (): Promise<ReportWeather> => {
      const access = tokens.getAccess()
      const res = await fetch(
        `${baseUrl}/field_ops/session-reports/${reportId}/weather/`,
        { headers: access ? { Authorization: `Bearer ${access}` } : {} }
      )
      if (!res.ok) {
        // El backend explica el motivo (sin fecha de aplicación, sin
        // coordenadas, POWER caído); se propaga su mensaje.
        const detail = await res
          .json()
          .then((body: { detail?: string }) => body.detail)
          .catch(() => undefined)
        throw new Error(detail ?? 'No se pudo consultar el clima.')
      }
      return (await res.json()) as ReportWeather
    },
  })
}

export function useAspersionClimatePreview(sessionId: string) {
  return useMutation({
    mutationFn: async (): Promise<AspersionClimatePreview> => {
      const access = tokens.getAccess()
      const res = await fetch(
        `${baseUrl}/field_ops/session-reports/aspersion/${sessionId}/weather-preview/`,
        { headers: access ? { Authorization: `Bearer ${access}` } : {} }
      )
      if (!res.ok) {
        const detail = await res
          .json()
          .then((body: { detail?: string }) => body.detail)
          .catch(() => undefined)
        throw new Error(detail ?? 'No se pudo consultar el clima de la sesión.')
      }
      return (await res.json()) as AspersionClimatePreview
    },
  })
}
