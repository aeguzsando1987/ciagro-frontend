import type { BatchItem, BatchItemStatus, BatchJobStatus } from '../hooks/useBatchImport'
import { isItemStuck } from '../hooks/useBatchImport'

/**
 * Logica pura de como se le cuenta al usuario el desenlace de cada archivo del lote.
 *
 * Vive fuera del componente para poder probarse sin montar React, igual que el resto de
 * funciones puras del modulo.
 *
 * HAY TRES CANALES DISTINTOS Y LOS TRES TIENEN QUE VERSE. Es donde esta fase se gana o se
 * pierde:
 *
 *   reject_reason  el archivo no cumplio el contrato de fechas y NUNCA hubo sesion.
 *   import_errors  la sesion SI se creo, pero el importador fallo (p. ej. el CSV cae fuera
 *                  de la parcela). Si solo se mostrara reject_reason, el usuario veria
 *                  "sesion creada" con cero puntos y sin ninguna explicacion.
 *   warnings       se acepto, pero con reservas.
 *
 * Ademas tienen FORMA distinta, asi que no se pueden pintar con el mismo renderizador.
 */

export type BadgeVariant = 'secondary' | 'info' | 'success' | 'warning' | 'danger'

/**
 * Los estados del LOTE y los del ARCHIVO son conjuntos DISTINTOS: `partial` solo existe en
 * el lote y `rejected` solo en el archivo. Un unico mapa para ambos deja huecos, asi que
 * son dos mapas separados a proposito.
 */
const ITEM_STATUS_LABELS: Record<BatchItemStatus, string> = {
  pending: 'En espera',
  processing: 'Procesando',
  done: 'Completado',
  rejected: 'Rechazado',
  error: 'Error',
}

const JOB_STATUS_LABELS: Record<BatchJobStatus, string> = {
  pending: 'Pendiente',
  processing: 'Procesando',
  done: 'Completado',
  partial: 'Completado con rechazos',
  error: 'Error',
}

const ITEM_STATUS_VARIANTS: Record<BatchItemStatus, BadgeVariant> = {
  pending: 'secondary',
  processing: 'info',
  done: 'success',
  // Rechazado es accionable por el usuario (corregir el CSV); error no lo es.
  rejected: 'warning',
  error: 'danger',
}

const JOB_STATUS_VARIANTS: Record<BatchJobStatus, BadgeVariant> = {
  pending: 'secondary',
  processing: 'info',
  done: 'success',
  partial: 'warning',
  error: 'danger',
}

/**
 * Estado que se le ENSEÑA al usuario, que no siempre es el que trae el campo `status`.
 *
 * Un archivo clavado en `pending_mapping` sigue diciendo `processing` en la base, pero no
 * va a avanzar solo nunca: anunciarlo como "Procesando" seria mentir y dejar al usuario
 * esperando un final que no llega.
 */
export function itemDisplayStatus(item: BatchItem): { label: string; variant: BadgeVariant } {
  if (isItemStuck(item)) {
    return { label: 'Requiere mapeo manual', variant: 'warning' }
  }
  return { label: ITEM_STATUS_LABELS[item.status], variant: ITEM_STATUS_VARIANTS[item.status] }
}

export function jobStatusLabel(status: BatchJobStatus): string {
  return JOB_STATUS_LABELS[status]
}

export function jobStatusVariant(status: BatchJobStatus): BadgeVariant {
  return JOB_STATUS_VARIANTS[status]
}

/** Codigos del importador que merecen una frase entendible en vez del codigo crudo. */
const IMPORT_ERROR_TEXTS: Record<string, string> = {
  csv_outside_selected_plot:
    'Las coordenadas del archivo caen fuera de la parcela del subprograma. Revisa que el archivo corresponda a esta parcela.',
  required_columns_missing: 'Al archivo le faltan columnas obligatorias de datos.',
  invalid_geometry: 'Filas con coordenadas invalidas que no se pudieron ubicar en el mapa.',
  no_data_rows: 'El archivo no traia ninguna fila de datos.',
}

export interface ParsedImportError {
  text: string
  /** Cuantas filas comparten este mismo problema. */
  count: number
}

/**
 * Traduce `import_errors` a frases para el usuario.
 *
 * La forma es HETEROGENEA a proposito del backend: unas entradas son
 * `{error: "<codigo>"}`, otras `{error, fields}`, otras `{row, error}` una por fila, y la
 * de rendimiento trae ademas `detail` y dos bounding boxes. Se agrupa por problema y se
 * cuenta, porque un CSV con mil filas malas produce mil entradas identicas y listarlas
 * todas no informa mas que decir cuantas son.
 */
export function describeImportErrors(errors: unknown): ParsedImportError[] {
  if (!Array.isArray(errors) || errors.length === 0) return []

  const agrupados = new Map<string, ParsedImportError>()

  for (const entrada of errors) {
    let texto: string

    if (typeof entrada === 'string') {
      texto = entrada
    } else if (entrada && typeof entrada === 'object') {
      const registro = entrada as Record<string, unknown>
      const codigo = typeof registro.error === 'string' ? registro.error : ''
      const detalle = typeof registro.detail === 'string' ? registro.detail : ''
      const campos = Array.isArray(registro.fields) ? registro.fields.join(', ') : ''

      // Orden de preferencia: frase conocida, si no el detalle del backend, si no el
      // codigo crudo. Nunca se deja al usuario sin ninguna explicacion.
      texto = IMPORT_ERROR_TEXTS[codigo] ?? (detalle || codigo || 'Error no identificado.')
      if (campos) texto = `${texto} Faltan: ${campos}.`
    } else {
      texto = 'Error no identificado.'
    }

    const previo = agrupados.get(texto)
    if (previo) previo.count += 1
    else agrupados.set(texto, { text: texto, count: 1 })
  }

  return [...agrupados.values()]
}

/** `reject_reason` y `warnings` ya vienen redactados por el backend: no se traducen. */
export function messageList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .map((m) =>
      m && typeof m === 'object' && typeof (m as { message?: unknown }).message === 'string'
        ? (m as { message: string }).message
        : '',
    )
    .filter(Boolean)
}
