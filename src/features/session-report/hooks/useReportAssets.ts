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
 * Abre el PDF del reporte en una pestaña nueva.
 *
 * El endpoint es autenticado, así que no se puede enlazar la URL directo (no
 * llevaría el Bearer): se baja como blob y se muestra desde memoria.
 *
 * La pestaña se abre en el **manejador del clic** y se pasa aquí ya creada; si se
 * abriera después del `await`, los bloqueadores de popups la cortarían por no venir
 * de un gesto del usuario. Si no hay pestaña (bloqueada), se cae a descarga.
 */
export function useOpenReportPdf(reportId: string) {
  return useMutation({
    mutationFn: async (target?: Window | null): Promise<void> => {
      let res: Response
      try {
        res = await fetch(`${baseUrl}/field_ops/session-reports/${reportId}/pdf/`, {
          headers: authHeaders(),
        })
      } catch (e) {
        target?.close()
        throw e
      }
      if (!res.ok) {
        target?.close()
        // El backend explica por qué (p. ej. reporte sin captura de mapa);
        // se propaga su mensaje en vez de uno genérico.
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

      if (target) {
        target.location.href = url
      } else {
        const link = document.createElement('a')
        link.href = url
        link.download = filename
        link.click()
      }

      // No se revoca de inmediato: la pestaña aún está cargando el blob y se
      // quedaría en blanco. Se libera cuando ya no puede estar en uso.
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
    },
  })
}
