import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createTestQueryClient } from '@/test/test-utils'
import { apiClient } from '@/lib/api/client'
import { BatchImportDialog } from './BatchImportDialog'
import { MAX_FILES_PER_BATCH } from '../hooks/useBatchImport'

// Se mockea el CLIENTE y no se usa MSW: `apiClient` (openapi-fetch) escapa al
// interceptor en jsdom, cosa ya documentada en HijoModal.test.tsx para useHijoDetail.
// Es la misma via que usa useSoilMapImport.test.ts.
vi.mock('@/lib/api/client', () => ({
  apiClient: { GET: vi.fn(), POST: vi.fn() },
}))

const postMock = vi.mocked(apiClient.POST)
const getMock = vi.mocked(apiClient.GET)

const PROGRAMA = 'prog-1'
const JOB = 'job-1'

beforeEach(() => {
  postMock.mockReset()
  getMock.mockReset()
})

afterEach(() => {
  vi.clearAllMocks()
})

function csv(name: string) {
  return new File(['Fecha de inicio,Fecha de fin\n02/09/2026,02/09/2026\n'], name, {
    type: 'text/csv',
  })
}

function renderDialog() {
  const qc = createTestQueryClient()
  const onOpenChange = vi.fn()
  const onFinished = vi.fn()
  render(
    <QueryClientProvider client={qc}>
      <BatchImportDialog
        programaId={PROGRAMA}
        plotCode="CL-ASP"
        open
        onOpenChange={onOpenChange}
        onFinished={onFinished}
      />
    </QueryClientProvider>,
  )
  return { onOpenChange, onFinished }
}

/** Lote mixto: un aceptado y un rechazado, igual que los datos reales de prueba. */
function lotePartial() {
  return {
    id: JOB,
    program: PROGRAMA,
    program_name: 'CL Manual',
    plot_code: 'CL-ASP',
    activity_type: 'aspersion',
    status: 'partial',
    total_files: 2,
    summary: { pending: 0, rejected: 1, processing: 0, done: 1, error: 0, total: 2 },
    items: [
      {
        id: 'i-ok',
        filename: 'bueno.csv',
        status: 'done',
        session_name: 'CL-ASP-Aspersion-2026/09/02',
        header_type: 'datalayers.AspersionSessionHeader',
        header_id: 'h-1',
        reject_reason: null,
        warnings: null,
        source_lot: null,
        import_status: 'done',
        import_errors: null,
        points_count: 6248,
        created_at: '2026-09-14T10:00:00Z',
      },
      {
        id: 'i-bad',
        filename: 'viejo.csv',
        status: 'rejected',
        session_name: null,
        header_type: null,
        header_id: null,
        reject_reason: [
          { code: 'missing_columns', message: 'El archivo no trae la columna Fecha de inicio.' },
        ],
        warnings: null,
        source_lot: null,
        import_status: null,
        import_errors: null,
        points_count: null,
        created_at: '2026-09-14T10:00:00Z',
      },
    ],
    created_at: '2026-09-14T10:00:00Z',
    updated_at: '2026-09-14T10:00:00Z',
  }
}

function aceptaElLote(accepted = 1, rejected = 1) {
  postMock.mockResolvedValue({
    data: {
      job_id: JOB,
      status: 'processing',
      total_files: accepted + rejected,
      accepted,
      rejected,
      items: [],
      detail: 'ok',
    },
    error: undefined,
  } as never)
  getMock.mockResolvedValue({ data: lotePartial(), error: undefined } as never)
}

describe('BatchImportDialog', () => {
  it('no deja enviar sin archivos', () => {
    renderDialog()
    expect(screen.getByRole('button', { name: /cargar lote/i })).toBeDisabled()
  })

  it('ofrece solo los tres tipos que el backend admite, sin suelo ni fitosanitario', async () => {
    const user = userEvent.setup()
    renderDialog()

    await user.click(screen.getByRole('combobox', { name: /tipo de actividad/i }))

    expect(await screen.findByRole('option', { name: 'Aspersion' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'NDVI' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Rendimiento' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: /suelo/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('option', { name: /fitosanitario/i })).not.toBeInTheDocument()
  })

  it('envia el tipo que se eligio en el selector, no siempre el de por defecto', async () => {
    const user = userEvent.setup()
    aceptaElLote(1, 0)
    renderDialog()

    await user.click(screen.getByRole('combobox', { name: /tipo de actividad/i }))
    await user.click(await screen.findByRole('option', { name: 'Rendimiento' }))
    await user.upload(screen.getByLabelText(/archivos csv/i), [csv('a.csv')])
    await user.click(screen.getByRole('button', { name: /cargar lote/i }))

    await waitFor(() => expect(postMock).toHaveBeenCalledOnce())
    const [, options] = postMock.mock.calls[0] as unknown as [string, { body: FormData }]
    expect(options.body.get('activity_type')).toBe('yield_map')
  })

  it('frena la carga ANTES de subir si se pasa del maximo de archivos', async () => {
    const user = userEvent.setup()
    renderDialog()
    const demasiados = Array.from({ length: MAX_FILES_PER_BATCH + 1 }, (_, i) => csv(`f${i}.csv`))

    await user.upload(screen.getByLabelText(/archivos csv/i), demasiados)

    expect(await screen.findByText(/divide la carga en varios lotes/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /cargar lote/i })).toBeDisabled()
    expect(postMock).not.toHaveBeenCalled()
  })

  it('envia el tipo y TODOS los archivos en el mismo campo files', async () => {
    const user = userEvent.setup()
    aceptaElLote(2, 0)
    renderDialog()

    await user.upload(screen.getByLabelText(/archivos csv/i), [csv('a.csv'), csv('b.csv')])
    await user.click(screen.getByRole('button', { name: /cargar lote/i }))

    await waitFor(() => expect(postMock).toHaveBeenCalledOnce())
    const [path, options] = postMock.mock.calls[0] as unknown as [
      string,
      { params: { path: { id: string } }; body: FormData },
    ]
    expect(path).toBe('/api/v1/field_ops/tasks/{id}/batch-import/')
    expect(options.params.path.id).toBe(PROGRAMA)
    expect(options.body).toBeInstanceOf(FormData)
    expect(options.body.get('activity_type')).toBe('aspersion')
    expect(options.body.getAll('files').map((f) => (f as File).name)).toEqual([
      'a.csv',
      'b.csv',
    ])
  })

  // El desenlace completo: el rechazado con su motivo Y el aceptado con sus puntos.
  it('muestra el archivo rechazado con su motivo junto al aceptado con su conteo', async () => {
    const user = userEvent.setup()
    aceptaElLote()
    renderDialog()

    await user.upload(screen.getByLabelText(/archivos csv/i), [csv('bueno.csv')])
    await user.click(screen.getByRole('button', { name: /cargar lote/i }))

    expect(await screen.findByText('viejo.csv')).toBeInTheDocument()
    expect(screen.getByText(/no trae la columna Fecha de inicio/i)).toBeInTheDocument()
    expect(screen.getByText('CL-ASP-Aspersion-2026/09/02')).toBeInTheDocument()
    expect(screen.getByText(/6,248 puntos/)).toBeInTheDocument()
    expect(screen.getByText(/1 de 2 listas/)).toBeInTheDocument()
  })

  it('conserva la seleccion cuando el envio falla, para poder reintentar', async () => {
    const user = userEvent.setup()
    postMock.mockResolvedValue({ data: undefined, error: { detail: 'token expirado' } } as never)
    renderDialog()

    await user.upload(screen.getByLabelText(/archivos csv/i), [csv('a.csv'), csv('b.csv')])
    await user.click(screen.getByRole('button', { name: /cargar lote/i }))

    // Sigue en el paso de seleccion y con los dos archivos puestos: el refreshMiddleware
    // no reintenta POST, asi que perder la seleccion obligaria a reelegirlos a mano.
    expect(await screen.findByText(/2 archivo\(s\) seleccionado\(s\)/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /cargar lote/i })).toBeEnabled()
  })

  it('avisa al padre al cerrar para que refresque el arbol con las sesiones creadas', async () => {
    const user = userEvent.setup()
    aceptaElLote()
    const { onFinished } = renderDialog()

    await user.upload(screen.getByLabelText(/archivos csv/i), [csv('bueno.csv')])
    await user.click(screen.getByRole('button', { name: /cargar lote/i }))
    await screen.findByText('viejo.csv')
    // Radix ya monta su propia X con texto accesible "Cerrar": el del pie es el ultimo.
    const cerrar = screen.getAllByRole('button', { name: /cerrar/i })
    await user.click(cerrar[cerrar.length - 1]!)

    expect(onFinished).toHaveBeenCalled()
  })
})
