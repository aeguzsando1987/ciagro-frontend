/**
 * Congela una capa de suelo en el reporte (FASE RS, RS-15).
 *
 * POST /field_ops/session-reports/<id>/layers/
 *
 * Multipart y no `apiClient`: la imagen del mapa va como archivo y openapi-fetch
 * serializa el body a JSON. Mismo motivo que `useReportAssets`.
 *
 * Es el sentido FRONT -> BACK de la costura (P1): los cortes y las hectareas salen
 * del raster del navegador, porque reproducirlos en Postgres clasificaria distinto
 * que el visor (H4). El backend los guarda tal cual y nunca los recalcula.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { tokens } from '@/lib/auth/tokens'
import { SESSION_REPORT_KEY } from './useSessionReport'
import type { SessionType } from '../types'

const baseUrl = import.meta.env.VITE_API_BASE_URL as string

/** Reparto de una clase por las DOS bases que publica la leyenda. */
export interface FrozenClass {
  index: number
  label: string
  /** Solo en categoricas: sus clases no corresponden 1:1 con la paleta. */
  color?: string
  /** Reparto por MUESTRAS: cuantos puntos caen en la clase. */
  by_points: { count: number; pct: number; area_ha: number | null }
  /** Reparto por SUPERFICIE: celdas del raster. Revela si una clase ocupa mas
   *  terreno del que sugieren sus muestras. */
  by_area?: { pct: number; area_ha: number | null }
}

export interface FreezeLayerPayload {
  layer: string
  /**
   * Ademas de preparar, elige la capa para el PDF y el KMZ. Por omision NO: las
   * capas se preparan solas al abrirlas en el panel, y si eso publicara, hojear el
   * selector meteria paginas al entregable.
   */
  publish?: boolean
  /** `class_count - 1` cortes. NUNCA siete fijos (H8). */
  breaks: number[]
  classes: FrozenClass[]
  histogram?: { bins: Array<{ lower: number; upper: number; count: number; area_ha?: number }> }
  image?: Blob | null
}

export function useFreezeSoilLayer(
  reportId: string,
  sessionType: SessionType,
  objectId: string
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: FreezeLayerPayload) => {
      const form = new FormData()
      form.append('layer', payload.layer)
      form.append('publish', payload.publish ? 'true' : 'false')
      // Los arreglos viajan como JSON dentro del multipart: un FormData plano los
      // aplanaria a "5.1,6.2" y el backend no podria distinguir tipos.
      form.append('breaks', JSON.stringify(payload.breaks))
      form.append('classes', JSON.stringify(payload.classes))
      if (payload.histogram) form.append('histogram', JSON.stringify(payload.histogram))
      if (payload.image) form.append('image', payload.image, `${payload.layer}.png`)

      const access = tokens.getAccess()
      const res = await fetch(`${baseUrl}/field_ops/session-reports/${reportId}/layers/`, {
        method: 'POST',
        headers: access ? { Authorization: `Bearer ${access}` } : {},
        body: form,
      })
      if (!res.ok) {
        // El backend explica por que (cortes mal contados, capa desconocida,
        // reporte publicado): se propaga su mensaje en vez de uno generico.
        const detail = await res
          .json()
          .then((b: { detail?: string }) => b.detail)
          .catch(() => undefined)
        throw new Error(detail ?? `No se pudo congelar la capa ${payload.layer}.`)
      }
      return (await res.json()) as { prepared_layers: string[]; published_layers: string[] }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [...SESSION_REPORT_KEY, sessionType, objectId],
      })
    },
  })
}

/**
 * Fija QUE capas salen en el PDF y el KMZ, de entre las ya preparadas.
 *
 * Endpoint aparte del de preparar porque admite QUITAR, no solo agregar: preparar
 * una capa es consecuencia de mirarla, elegirla para el entregable es una decision.
 */
export function useSetPublishedLayers(
  reportId: string,
  sessionType: SessionType,
  objectId: string
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (layers: string[]) => {
      const access = tokens.getAccess()
      const res = await fetch(
        `${baseUrl}/field_ops/session-reports/${reportId}/published-layers/`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(access ? { Authorization: `Bearer ${access}` } : {}),
          },
          body: JSON.stringify({ layers }),
        }
      )
      if (!res.ok) {
        const detail = await res
          .json()
          .then((b: { detail?: string; layers?: string }) => b.detail ?? b.layers)
          .catch(() => undefined)
        throw new Error(detail ?? 'No se pudieron elegir las capas del reporte.')
      }
      return (await res.json()) as { published_layers: string[] }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [...SESSION_REPORT_KEY, sessionType, objectId],
      })
    },
  })
}
