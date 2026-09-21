import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api/client'

/**
 * Importacion automatica de NDVI desde Sentinel-2 (FASE SN-F).
 *
 * Son DOS pasos y no uno a proposito: pedir una fecha no implica que haya habido pasada del
 * satelite ese dia (la revisita es de ~5 dias y ademas hay nubes). En la prueba real, pidiendo
 * el 2024-10-25, el catalogo devolvio tres adquisiciones con delta de -5, 0 y +5 dias. Elegir
 * "la mas cercana" por cuenta propia le ocultaria al agronomo que se descarto y por que.
 *
 * Los dos endpoints estan tipados en api.d.ts, pero sus RESPUESTAS salen como
 * {[key: string]: unknown} porque el backend las documenta con OpenApiTypes.OBJECT. De ahi las
 * interfaces de abajo y el cast, igual que NdviPreviewResult en useNdviImport.ts.
 */

/** Una pasada del satelite sobre la parcela. `tiles` puede traer dos: una parcela puede caer sobre dos. */
export interface SentinelAcquisition {
  acquisition_id: string
  datetime: string
  cloud_cover: number
  platform: string
  tiles: string[]
  delta_days: number
}

export interface SentinelPreviewResult {
  target_date: string
  days: number
  count: number
  results: SentinelAcquisition[]
}

export interface SentinelPreviewParams {
  headerId: string
  /** Fecha deseada. Sin valor, el backend usa la session_date de la sesion. */
  targetDate?: string
  /** Radio de busqueda en dias. Default 7 en el backend, tope 60. */
  days?: number
}

/** El status HTTP viaja pegado al Error: el dialogo redacta distinto un 503 que un 409. */
export interface SentinelError extends Error {
  status?: number
  payload?: unknown
}

function sentinelError(message: string, status?: number, payload?: unknown): SentinelError {
  return Object.assign(new Error(message), { status, payload })
}

/**
 * Busca adquisiciones disponibles. Es un GET pero se expone como mutacion porque la dispara
 * el usuario con los parametros que el elige: una query se autoejecutaria al abrir el dialogo
 * y llamaria al catalogo de Copernicus sin que nadie lo hubiera pedido.
 *
 * No consume cuota de procesamiento: solo consulta el catalogo.
 */
export function useSentinelPreview() {
  return useMutation({
    mutationFn: async ({
      headerId,
      targetDate,
      days,
    }: SentinelPreviewParams): Promise<SentinelPreviewResult> => {
      const { data, error, response } = await apiClient.GET(
        '/api/v1/monitoring/ndvi/headers/{id}/sentinel-preview/',
        {
          params: {
            path: { id: headerId },
            query: {
              ...(targetDate ? { target_date: targetDate } : {}),
              // days === 0 es una peticion legitima ("solo ese dia exacto") y es falsy, asi
              // que la condicion mira si es un numero, no si es verdadero: con `days ? ...`
              // el radio 0 se caia y el backend aplicaba su default de 7 dias en silencio.
              ...(typeof days === 'number' ? { days } : {}),
            },
          },
        },
      )
      if (error || !data) {
        throw sentinelError('No se pudieron consultar las adquisiciones', response?.status, error)
      }
      return data as unknown as SentinelPreviewResult
    },
  })
}

export interface SentinelImportParams {
  headerId: string
  acquisitionId: string
}

/**
 * Encola la importacion de una adquisicion. El backend responde 202 y el trabajo sigue en
 * Celery (~4-5 s sobre una parcela de 41 ha).
 *
 * NO SE ESCRIBE POLLING AQUI: useNdviSessionDetail ya refresca cada 2.5 s mientras
 * import_status vale 'processing'. Marcar ese estado de forma optimista es lo unico que hace
 * falta para que el seguimiento arranque sin esperar al primer refetch, y es exactamente lo
 * que ya hace useImportNdviData para el CSV.
 */
export function useImportSentinel() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ headerId, acquisitionId }: SentinelImportParams) => {
      const { data, error, response } = await apiClient.POST(
        '/api/v1/monitoring/ndvi/headers/{id}/sentinel-import/',
        {
          params: { path: { id: headerId } },
          body: { acquisition_id: acquisitionId },
        },
      )
      if (error || !data) {
        throw sentinelError('No se pudo importar la adquisicion', response?.status, error)
      }
      return data
    },
    onSuccess: (_data, { headerId }) => {
      queryClient.setQueryData(['ndvi-detail', headerId], (prev: unknown) =>
        prev && typeof prev === 'object'
          ? { ...(prev as Record<string, unknown>), import_status: 'processing' }
          : prev,
      )
      queryClient.invalidateQueries({ queryKey: ['ndvi-detail', headerId] })
      // La ingesta de Sentinel BORRA y reescribe los puntos en una transaccion, asi que el
      // resumen de indices cacheado queda con los numeros de la carga anterior.
      queryClient.invalidateQueries({ queryKey: ['ndvi-variable-stats', headerId] })
    },
  })
}

export interface SesionLocation {
  sesionId: string
  hijoId: string
  masterId: string
}

/**
 * Resuelve donde vive una sesion para poder abrirla en la pila de modales del Task Manager.
 *
 * NO ES UN CAPRICHO: la pila necesita hijoId y masterId, y la sesion que ya tiene la
 * adquisicion duplicada puede colgar de OTRO subprograma, asi que no sirve reusar los ids
 * del modal actual (mostrarian una migaja de pan falsa). El camino es
 * header -> program -> tasks/{id}.master_program.
 *
 * Son dos GET extra y se pagan SOLO al pulsar "Ver la sesion existente", nunca en el camino
 * feliz: no es una funcion de uso general, es el desenlace de un 409.
 */
export async function fetchSesionLocation(headerId: string): Promise<SesionLocation | null> {
  const { data: header } = await apiClient.GET('/api/v1/monitoring/ndvi/headers/{id}/', {
    params: { path: { id: headerId } },
  })
  const hijoId = header?.program
  if (!hijoId) return null

  const { data: hijo } = await apiClient.GET('/api/v1/field_ops/tasks/{id}/', {
    params: { path: { id: hijoId } },
  })
  const masterId = hijo?.master_program
  if (!masterId) return null

  return { sesionId: headerId, hijoId, masterId }
}

/** El 409 de adquisicion duplicada trae el header que ya la tiene; los demas 409, no. */
export function existingHeaderId(err: unknown): string | null {
  const payload = (err as SentinelError | undefined)?.payload
  if (!payload || typeof payload !== 'object') return null
  const id = (payload as { existing_header_id?: unknown }).existing_header_id
  return typeof id === 'string' ? id : null
}

/**
 * Redaccion por status. El 503 NO se redacta como error del sistema: significa que Copernicus
 * no contesto, que es una condicion transitoria y ajena a CIAgro; llamarlo "error" manda al
 * usuario a reportar un fallo que no existe.
 */
export function sentinelErrorMessage(err: unknown, fallback: string): string {
  const e = err as SentinelError | undefined
  const detalle = detalleDelPayload(e?.payload)
  switch (e?.status) {
    case 400:
      return detalle ?? 'La parcela de esta sesion no tiene poligono cargado, o los parametros de busqueda no son validos.'
    case 403:
      return 'Tu nivel de usuario no permite importar datos de satelite.'
    case 404:
      return 'La sesion no esta disponible para tu alcance.'
    case 409:
      return detalle ?? 'No se puede importar en esta sesion.'
    case 503:
      return 'Copernicus no responde en este momento. Intenta de nuevo en unos minutos.'
    default:
      return detalle ?? fallback
  }
}

function detalleDelPayload(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null
  const detail = (payload as { detail?: unknown }).detail
  return typeof detail === 'string' ? detail : null
}
