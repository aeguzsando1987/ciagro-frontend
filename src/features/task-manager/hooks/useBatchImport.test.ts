import { describe, expect, it } from 'vitest'
import {
  MAX_FILES_PER_BATCH,
  isItemStuck,
  isJobActive,
  validateBatchSelection,
  type BatchItem,
  type BatchJob,
} from './useBatchImport'

/**
 * Lo que se prueba aqui es la LOGICA PURA del lote, que es donde vive el riesgo:
 * cuando dejar de pollear y cuando rechazar una seleccion antes de subirla.
 */

function item(overrides: Partial<BatchItem> = {}): BatchItem {
  return {
    id: 'item-1',
    filename: 'archivo.csv',
    status: 'pending',
    session_name: null,
    header_type: null,
    header_id: null,
    reject_reason: null,
    warnings: null,
    source_lot: null,
    import_status: null,
    import_errors: null,
    points_count: null,
    created_at: '2026-09-14T10:00:00Z',
    ...overrides,
  } as BatchItem
}

function job(items: BatchItem[]): BatchJob {
  return {
    id: 'job-1',
    program: 'prog-1',
    program_name: 'CL Manual',
    plot_code: 'CL-ASP',
    activity_type: 'aspersion',
    status: 'processing',
    total_files: items.length,
    summary: {
      pending: 0,
      rejected: 0,
      processing: 0,
      done: 0,
      error: 0,
      total: items.length,
    },
    items,
    created_at: '2026-09-14T10:00:00Z',
    updated_at: '2026-09-14T10:00:00Z',
  } as BatchJob
}

function fileOf(name: string, sizeMb: number): File {
  const file = new File(['x'], name, { type: 'text/csv' })
  // File.size es de solo lectura: se redefine para no materializar 20 MB en memoria.
  Object.defineProperty(file, 'size', { value: Math.round(sizeMb * 1024 * 1024) })
  return file
}

describe('isJobActive', () => {
  it('no pollea si no hay lote todavia', () => {
    expect(isJobActive(undefined)).toBe(false)
  })

  it('pollea mientras haya archivos en espera o procesando', () => {
    expect(isJobActive(job([item({ status: 'pending' })]))).toBe(true)
    expect(isJobActive(job([item({ status: 'processing' })]))).toBe(true)
  })

  it('deja de pollear cuando todos los archivos llegaron a un estado terminal', () => {
    const terminal = job([
      item({ id: 'a', status: 'done' }),
      item({ id: 'b', status: 'rejected' }),
      item({ id: 'c', status: 'error' }),
    ])
    expect(isJobActive(terminal)).toBe(false)
  })

  it('un archivo rechazado no mantiene vivo el polling del resto ya terminado', () => {
    expect(isJobActive(job([item({ status: 'rejected' }), item({ status: 'done' })]))).toBe(
      false,
    )
  })

  // LA TRAMPA PRINCIPAL DE LA FASE.
  // El backend solo traduce `done` y `error` del importador al estado del item, asi que un
  // header en `pending_mapping` deja el archivo en `processing` para siempre. Sin este
  // corte, el front sondearia el servidor indefinidamente sin que nada cambie nunca.
  it('deja de pollear un archivo clavado en pending_mapping, aunque siga en processing', () => {
    const clavado = job([item({ status: 'processing', import_status: 'pending_mapping' })])
    expect(isItemStuck(clavado.items[0]!)).toBe(true)
    expect(isJobActive(clavado)).toBe(false)
  })

  it('sigue polleando si otro archivo avanza, aunque uno este clavado', () => {
    const mixto = job([
      item({ id: 'a', status: 'processing', import_status: 'pending_mapping' }),
      item({ id: 'b', status: 'processing', import_status: 'processing' }),
    ])
    expect(isJobActive(mixto)).toBe(true)
  })

  it('no confunde un archivo terminado con uno clavado', () => {
    expect(isItemStuck(item({ status: 'done', import_status: 'done' }))).toBe(false)
  })
})

describe('validateBatchSelection', () => {
  it('exige al menos un archivo', () => {
    expect(validateBatchSelection([])).toMatch(/al menos un archivo/i)
  })

  it('acepta una seleccion dentro de los limites', () => {
    expect(validateBatchSelection([fileOf('a.csv', 1), fileOf('b.csv', 19.9)])).toBeNull()
  })

  it('acepta exactamente el maximo de archivos', () => {
    const justos = Array.from({ length: MAX_FILES_PER_BATCH }, (_, i) => fileOf(`f${i}.csv`, 1))
    expect(validateBatchSelection(justos)).toBeNull()
  })

  it('rechaza pasarse del maximo de archivos, diciendo cuantos llegaron', () => {
    const demasiados = Array.from({ length: MAX_FILES_PER_BATCH + 1 }, (_, i) =>
      fileOf(`f${i}.csv`, 1),
    )
    const error = validateBatchSelection(demasiados)
    expect(error).toContain('21')
    expect(error).toMatch(/varios lotes/i)
  })

  it('rechaza los archivos pesados NOMBRANDOLOS, que es lo accionable', () => {
    const error = validateBatchSelection([fileOf('ok.csv', 1), fileOf('enorme.csv', 21)])
    expect(error).toContain('enorme.csv')
    expect(error).not.toContain('ok.csv')
  })
})
