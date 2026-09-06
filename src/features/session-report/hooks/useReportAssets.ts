/**
 * Subida de las imágenes del reporte y descarga del PDF (FASE RP).
 *
 * `map_snapshot` y `analyst_signature` son archivos, así que van en `multipart/form-data`
 * al mismo endpoint de update del reporte. No se usa `apiClient` (openapi-fetch) porque
 * serializa el body como JSON; aquí hace falta un `FormData` crudo, con el token puesto
 * a mano. El backend acepta ambos formatos en ese endpoint.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { tokens } from '@/lib/auth/tokens'
import { SESSION_REPORT_KEY } from './useSessionReport'
import type { SessionReport, SessionType } from '../types'

const baseUrl = import.meta.env.VITE_API_BASE_URL as string

function authHeaders(): HeadersInit {
  const access = tokens.getAccess()
  return access ? { Authorization: `Bearer ${access}` } : {}
}

export interface ReportAssets {
  map_snapshot?: Blob
  analyst_signature?: Blob
}

/** PATCH multipart del reporte con las imágenes indicadas. */
export function useUploadReportAssets(
  reportId: string,
  sessionType: SessionType,
  objectId: string
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (assets: ReportAssets): Promise<SessionReport> => {
      const form = new FormData()
      if (assets.map_snapshot) {
        form.append('map_snapshot', assets.map_snapshot, 'map-snapshot.png')
      }
      if (assets.analyst_signature) {
        form.append('analyst_signature', assets.analyst_signature, 'signature.png')
      }

      const res = await fetch(
        `${baseUrl}/field_ops/session-reports/${reportId}/update/`,
        { method: 'PATCH', headers: authHeaders(), body: form }
      )
      if (!res.ok) {
        throw new Error('No se pudo subir la imagen al reporte.')
      }
      return (await res.json()) as SessionReport
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [...SESSION_REPORT_KEY, sessionType, objectId],
      })
    },
  })
}

/**
 * Descarga el PDF del reporte.
 *
 * DESCARGA y ya no abre pestaña. La versión anterior abría la pestaña dentro del
 * clic —obligada por el bloqueador de popups, que corta cualquier ventana abierta
 * después de un `await`— y el usuario se quedaba mirando una pestaña EN BLANCO
 * varios segundos mientras WeasyPrint maquetaba. Descargar no necesita ese truco:
 * el enlace se dispara cuando el archivo ya existe, así que la espera se puede
 * mostrar donde el usuario está mirando. Mismo camino que el KMZ y el CSV.
 *
 * El endpoint es autenticado, así que no se puede enlazar la URL directo (no
 * llevaría el Bearer): se baja como blob y se guarda desde memoria.
 */
export function useDownloadReportPdf(reportId: string) {
  return useMutation({
    mutationFn: async (): Promise<void> => {
      const res = await fetch(`${baseUrl}/field_ops/session-reports/${reportId}/pdf/`, {
        headers: authHeaders(),
      })
      if (!res.ok) {
        // El backend explica por qué (p. ej. reporte sin capas preparadas); se
        // propaga su mensaje en vez de uno genérico.
        const detail = await res
          .json()
          .then((body: { detail?: string }) => body.detail)
          .catch(() => undefined)
        throw new Error(detail ?? 'No se pudo generar el PDF del reporte.')
      }

      const blob = await res.blob()
      const filename =
        res.headers.get('Content-Disposition')?.match(/filename="([^"]+)"/)?.[1] ??
        'reporte.pdf'

      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      link.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
    },
  })
}

/**
 * Descarga el CSV del reporte (FASE RS, D7).
 *
 * El backend lo sirve en streaming, asi que la primera fila sale en 0.076 s aunque
 * el archivo completo pese 11.5 MB. Aqui se espera al blob de todos modos: el
 * navegador no puede iniciar una descarga autenticada sin tener el cuerpo.
 *
 * Sin `?layers=` el backend exporta TODAS las capas con datos, no solo las
 * publicadas — al reves que el KMZ. En CSV las capas son columnas (un solo
 * recorrido), y truncar una exportacion de datos crudos en silencio sorprenderia.
 */
export function useDownloadReportCsv(reportId: string) {
  return useMutation({
    mutationFn: async (): Promise<void> => {
      const res = await fetch(`${baseUrl}/field_ops/session-reports/${reportId}/csv/`, {
        headers: authHeaders(),
      })
      if (!res.ok) {
        const detail = await res
          .json()
          .then((body: { detail?: string }) => body.detail)
          .catch(() => undefined)
        throw new Error(detail ?? 'No se pudo generar el CSV del reporte.')
      }

      const blob = await res.blob()
      const filename =
        res.headers.get('Content-Disposition')?.match(/filename="([^"]+)"/)?.[1] ??
        'reporte.csv'

      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      link.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
    },
  })
}

/**
 * Descarga el KMZ del reporte (FASE KM) para abrirlo en Google Earth.
 *
 * A diferencia del PDF, esto **siempre** descarga y nunca abre pestaña: un KMZ
 * mostrado en el navegador no sirve de nada, el usuario necesita el archivo en
 * disco. Por eso tampoco hace falta el baile con el bloqueador de popups que sí
 * necesitaba la version anterior del PDF, que abria pestaña.
 *
 * El endpoint es autenticado, así que no se puede enlazar la URL directo (no
 * llevaría el Bearer): se baja como blob y se dispara la descarga desde memoria.
 */
export function useDownloadReportKmz(reportId: string) {
  return useMutation({
    mutationFn: async (): Promise<void> => {
      const res = await fetch(`${baseUrl}/field_ops/session-reports/${reportId}/kml/`, {
        headers: authHeaders(),
      })
      if (!res.ok) {
        const detail = await res
          .json()
          .then((body: { detail?: string }) => body.detail)
          .catch(() => undefined)
        throw new Error(detail ?? 'No se pudo generar el KML del reporte.')
      }

      const blob = await res.blob()
      const filename =
        res.headers.get('Content-Disposition')?.match(/filename="([^"]+)"/)?.[1] ??
        'reporte.kmz'

      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      link.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
    },
  })
}
