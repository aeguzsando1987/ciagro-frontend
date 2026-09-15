import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { BatchItemMessages } from './BatchItemMessages'
import { describeImportErrors, itemDisplayStatus } from '../lib/batchMessages'
import type { BatchItem } from '../hooks/useBatchImport'

/**
 * Lo que se fija aqui es que los TRES canales de mensaje se vean por separado.
 * reject_reason (nunca hubo sesion) e import_errors (la sesion se creo y el importador
 * fallo) son cosas distintas: si solo se mostrara uno, el usuario veria "sesion creada"
 * con cero puntos y sin explicacion.
 */

function item(overrides: Partial<BatchItem> = {}): BatchItem {
  return {
    id: 'i-1',
    filename: 'archivo.csv',
    status: 'done',
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

describe('describeImportErrors', () => {
  it('no inventa nada cuando no hay errores', () => {
    expect(describeImportErrors(null)).toEqual([])
    expect(describeImportErrors([])).toEqual([])
  })

  it('traduce el codigo de CSV fuera de la parcela a algo accionable', () => {
    const [error] = describeImportErrors([
      { error: 'csv_outside_selected_plot', detail: 'bbox fuera', plot_bbox: [1, 2, 3, 4] },
    ])
    expect(error!.text).toMatch(/fuera de la parcela/i)
  })

  it('agrupa y CUENTA las filas con el mismo problema en vez de listarlas todas', () => {
    const errores = describeImportErrors([
      { row: 3, error: 'invalid_geometry' },
      { row: 9, error: 'invalid_geometry' },
      { row: 40, error: 'invalid_geometry' },
    ])
    expect(errores).toHaveLength(1)
    expect(errores[0]!.count).toBe(3)
  })

  it('nombra las columnas que faltan', () => {
    const [error] = describeImportErrors([
      { error: 'required_columns_missing', fields: ['lat', 'lon'] },
    ])
    expect(error!.text).toContain('lat, lon')
  })

  it('cae en el detalle o el codigo crudo antes que dejar al usuario sin explicacion', () => {
    expect(describeImportErrors([{ error: 'algo_no_catalogado' }])[0]!.text).toBe(
      'algo_no_catalogado',
    )
    expect(describeImportErrors(['fallo raro'])[0]!.text).toBe('fallo raro')
  })
})

describe('itemDisplayStatus', () => {
  it('no anuncia como Procesando un archivo que ya no avanzara solo', () => {
    const clavado = item({ status: 'processing', import_status: 'pending_mapping' })
    expect(itemDisplayStatus(clavado).label).toMatch(/mapeo manual/i)
  })

  it('distingue rechazado de error: el primero lo arregla el usuario', () => {
    expect(itemDisplayStatus(item({ status: 'rejected' })).variant).toBe('warning')
    expect(itemDisplayStatus(item({ status: 'error' })).variant).toBe('danger')
  })
})

describe('BatchItemMessages', () => {
  it('no ocupa espacio cuando el archivo salio limpio', () => {
    const { container } = render(<BatchItemMessages item={item()} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('muestra TODOS los motivos de rechazo, no solo el primero', () => {
    render(
      <BatchItemMessages
        item={item({
          status: 'rejected',
          reject_reason: [
            { code: 'missing_columns', message: 'Falta la columna Fecha de inicio.' },
            { code: 'missing_columns', message: 'Falta la columna Fecha de fin.' },
          ],
        })}
      />,
    )
    expect(screen.getByText(/Fecha de inicio/)).toBeInTheDocument()
    expect(screen.getByText(/Fecha de fin/)).toBeInTheDocument()
  })

  // El caso que justifica la fase: sesion creada, cero puntos, y hay que decir por que.
  it('explica el fallo del IMPORTADOR aunque la sesion si se haya creado', () => {
    render(
      <BatchItemMessages
        item={item({
          status: 'error',
          session_name: 'P02-Rendimiento-2026/09/02',
          import_errors: [{ error: 'csv_outside_selected_plot' }],
        })}
      />,
    )
    expect(screen.getByText(/fuera de la parcela/i)).toBeInTheDocument()
  })

  it('muestra las advertencias de un archivo aceptado con reservas', () => {
    render(
      <BatchItemMessages
        item={item({
          warnings: [
            { code: 'duplicate_in_batch', message: 'Mismo contenido que otro archivo.' },
          ],
        })}
      />,
    )
    expect(screen.getByText(/Mismo contenido/)).toBeInTheDocument()
  })

  it('tolera warnings en null, que es como llegan cuando no hay ninguna', () => {
    expect(() => render(<BatchItemMessages item={item({ warnings: null })} />)).not.toThrow()
  })

  it('dice que hacer con un archivo que quedo esperando mapeo manual', () => {
    render(
      <BatchItemMessages
        item={item({ status: 'processing', import_status: 'pending_mapping' })}
      />,
    )
    expect(screen.getByText(/mapees sus columnas/i)).toBeInTheDocument()
  })
})
