import { queryOptions, useMutation, useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api/client'
import type { components } from '@/types/api'

/**
 * Carga por lote de sesiones desde el subprograma (FASE CL-F).
 *
 *   POST /api/v1/field_ops/tasks/{id}/batch-import/   multipart: activity_type + files[]
 *   GET  /api/v1/field_ops/batch-imports/{id}/        estado, es lo que se pollea (D3)
 *
 * El aviso de "sesion lista" es POLLING de ese GET y no un sistema de notificaciones:
 * no hay infraestructura para ello en el backend y construirla habria partido la fase.
 */

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

/** Un mensaje del backend. `code` es para el programa, `message` para el usuario. */
export interface BatchMessage {
  code: string
  message: string
}

export type BatchActivityType = components['schemas']['BatchImportCreateActivityTypeEnum']
export type BatchItemStatus = components['schemas']['BatchImportItemStatusEnum']
export type BatchJobStatus = components['schemas']['BatchImportJobStatusEnum']

/**
 * Estado del IMPORTADOR de la sesion, distinto del estado del archivo en el lote.
 * No sale del schema porque el serializer lo expone como SerializerMethodField.
 */
export type BatchImportStatus = 'pending' | 'processing' | 'done' | 'error' | 'pending_mapping'

/** Conteo por estado que el backend ya calcula: el avance NO se cuenta en el front. */
export type BatchSummary = Record<BatchItemStatus, number> & { total: number }

/**
 * POR QUE SE ESTRECHAN LOS TIPOS GENERADOS EN VEZ DE USARLOS TAL CUAL.
 *
 * drf-spectacular tipa como `string` todo SerializerMethodField que no lleve
 * `@extend_schema_field`, asi que el schema afirma cosas que son falsas: `summary` es un
 * objeto de seis contadores y no un string, `points_count` es un numero, `import_status`
 * es un enum y `import_errors` una lista. Usarlos tal cual obligaria a castear en cada
 * punto de lectura, que es peor que corregirlo una vez aqui.
 *
 * Se parte del tipo generado con Omit en lugar de declararlo entero a mano: asi un cambio
 * REAL del contrato (un campo que se va o se renombra) sigue rompiendo la compilacion.
 * El arreglo de fondo es anotar el backend; queda registrado como gap.
 */
type GeneratedItem = components['schemas']['BatchImportItem']
type GeneratedJob = components['schemas']['BatchImportJob']

export type BatchItem = Omit<
  GeneratedItem,
  'reject_reason' | 'warnings' | 'import_status' | 'import_errors' | 'points_count'
> & {
  /** Motivos del CONTRATO de archivo: nunca existio sesion. Lista, puede traer varios. */
  reject_reason: BatchMessage[] | null
  /** Se acepto con reservas. Llega `null`, NO `[]`. */
  warnings: BatchMessage[] | null
  /** Estado del importador de la sesion ya creada. */
  import_status: BatchImportStatus | null
  /**
   * Errores del IMPORTADOR, que NO son `reject_reason`. Forma heterogenea: usa la clave
   * `error`, a veces `row`, y en rendimiento `csv_bbox` / `plot_bbox`.
   */
  import_errors: unknown[] | null
  points_count: number | null
}

export type BatchJob = Omit<GeneratedJob, 'summary' | 'items' | 'plot_code'> & {
  summary: BatchSummary
  items: BatchItem[]
  plot_code: string | null
}

export type BatchCreateResponse = Omit<
  components['schemas']['BatchImportCreateResponse'],
  'items'
> & { items: BatchItem[] }

// ---------------------------------------------------------------------------
// Limites (espejo de batch_serializers.py:18-20)
// ---------------------------------------------------------------------------

export const MAX_FILES_PER_BATCH = 20
export const MAX_FILE_SIZE_MB = 20
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024

/**
 * Valida la seleccion ANTES de subir. El backend responde 400 igual, pero enterarse
 * despues de subir veinte archivos de 20 MB cuesta la subida entera.
 * Devuelve el mensaje de error, o `null` si la seleccion es valida.
 */
export function validateBatchSelection(files: File[]): string | null {
  if (files.length === 0) return 'Selecciona al menos un archivo.'

  if (files.length > MAX_FILES_PER_BATCH) {
    return (
      `Un lote admite hasta ${MAX_FILES_PER_BATCH} archivos y se seleccionaron ` +
      `${files.length}. Divide la carga en varios lotes.`
    )
  }

  const excedidos = files.filter((f) => f.size > MAX_FILE_SIZE_BYTES).map((f) => f.name)
  if (excedidos.length > 0) {
    return (
      `Estos archivos superan el maximo de ${MAX_FILE_SIZE_MB} MB por archivo: ` +
      `${excedidos.join(', ')}.`
    )
  }

  return null
}

// ---------------------------------------------------------------------------
// Estado del lote
// ---------------------------------------------------------------------------

/**
 * Un archivo que quedo CLAVADO y no avanzara solo.
 *
 * ESTA ES LA TRAMPA PRINCIPAL DE LA FASE. `_resolve_items_against_headers`
 * (`batch_views.py:104-109`) solo traduce `done` y `error` del importador al estado del
 * item. Si el importador deja la sesion en `pending_mapping` —le faltan columnas por
 * mapear a mano— el item se queda en `processing` PARA SIEMPRE, y un polling que solo
 * mire `status` sondearia el servidor indefinidamente sin que nada cambie nunca.
 *
 * Se detecta en el front porque el serializer si expone `import_status`. No requiere
 * tocar el backend.
 */
export function isItemStuck(item: BatchItem): boolean {
  return item.status === 'processing' && item.import_status === 'pending_mapping'
}

/**
 * Si el lote todavia puede avanzar por si solo. Es la condicion del polling.
 *
 * Funcion pura y exportada a proposito: es la pieza con mas riesgo del hook y se prueba
 * sin montar React ni servidor.
 */
export function isJobActive(job: BatchJob | undefined): boolean {
  if (!job) return false
  return job.items.some(
    (item) =>
      item.status === 'pending' || (item.status === 'processing' && !isItemStuck(item)),
  )
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/**
 * Estado del lote, con el polling del repo: `refetchInterval` condicionado, 2500 ms,
 * el mismo patron que `useAspersionSessionDetail.ts:23` y otros cuatro hooks.
 *
 * OJO: este GET es de ESCRITURA. Reconcilia cada archivo contra su sesion y persiste las
 * transiciones `processing -> done|error`. El polling no observa el avance: lo causa.
 */
export function batchImportJobQueryOptions(jobId: string | null) {
  return queryOptions({
    queryKey: ['batch-import', jobId] as const,
    enabled: !!jobId,
    queryFn: async (): Promise<BatchJob> => {
      const { data, error } = await apiClient.GET('/api/v1/field_ops/batch-imports/{id}/', {
        params: { path: { id: jobId! } },
      })
      if (error || !data) throw new Error('No se pudo cargar el estado del lote')
      return data as unknown as BatchJob
    },
    // El lote vive segundos o minutos: no se cachea como un catalogo.
    staleTime: 0,
    refetchInterval: (query) => (isJobActive(query.state.data) ? 2500 : false),
  })
}

export function useBatchImportJob(jobId: string | null) {
  return useQuery(batchImportJobQueryOptions(jobId))
}

/**
 * Crea el lote. Responde 202 con los RECHAZADOS YA RESUELTOS: el contrato se valida en el
 * request, asi que el usuario ve que archivo no sirve en la misma respuesta.
 *
 * No hay `onSuccess` optimista como en la carga individual: alli se marca 'processing' a
 * mano porque el detalle de la sesion ya estaba cacheado. Aqui el job NACE con el 202, y
 * quien lo guarda es el dialogo con el `job_id` que devuelve.
 */
export function useCreateBatchImport() {
  return useMutation({
    mutationFn: async ({
      programaId,
      activityType,
      files,
    }: {
      programaId: string
      activityType: BatchActivityType
      files: File[]
    }): Promise<BatchCreateResponse> => {
      const invalido = validateBatchSelection(files)
      if (invalido) throw new Error(invalido)

      const fd = new FormData()
      fd.append('activity_type', activityType)
      // El backend lee request.FILES.getlist("files"): mismo nombre de campo N veces.
      for (const file of files) fd.append('files', file)

      const { data, error } = await apiClient.POST(
        '/api/v1/field_ops/tasks/{id}/batch-import/',
        {
          params: { path: { id: programaId } },
          body: fd as never,
          // openapi-fetch serializaria el FormData a JSON sin esto.
          bodySerializer: (b: unknown) => b as FormData,
        },
      )
      if (error) throw error
      return data as unknown as BatchCreateResponse
    },
  })
}
