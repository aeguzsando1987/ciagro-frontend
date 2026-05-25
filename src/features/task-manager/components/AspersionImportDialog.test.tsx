import { screen, waitFor, render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import type { PreviewResult } from '../hooks/useAspersionImport'
import { AspersionImportDialog } from './AspersionImportDialog'

// jsdom no implementa estas APIs de puntero que Radix Select usa al abrirse.
beforeAll(() => {
  Element.prototype.hasPointerCapture = vi.fn() as never
  Element.prototype.releasePointerCapture = vi.fn() as never
  Element.prototype.scrollIntoView = vi.fn() as never
})

// apiClient (openapi-fetch) captura globalThis.fetch al crearse, antes de que MSW
// lo parchee, por lo que MSW no intercepta sus llamadas en tests. Mockeamos el
// módulo de hooks para probar la lógica del componente de forma aislada.
const mocks = vi.hoisted(() => ({
  preview: vi.fn<(args: unknown) => Promise<PreviewResult>>(),
  importData: vi.fn<(args: unknown) => Promise<unknown>>(),
  createTemplate: vi.fn<(args: unknown) => Promise<{ id: string }>>(),
}))

vi.mock('../hooks/useAspersionImport', () => ({
  useAspersionTemplates: () => ({ data: [] }),
  usePreviewColumns: () => ({ mutateAsync: mocks.preview, isPending: false }),
  useImportAspersionData: () => ({ mutateAsync: mocks.importData, isPending: false }),
  useCreateAspersionTemplate: () => ({ mutateAsync: mocks.createTemplate, isPending: false }),
}))

// sonner: evitar render real del toaster.
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

beforeEach(() => {
  mocks.preview.mockReset()
  mocks.importData.mockReset()
  mocks.createTemplate.mockReset()
})

function renderDialog(props: Partial<React.ComponentProps<typeof AspersionImportDialog>> = {}) {
  const onOpenChange = vi.fn()
  render(<AspersionImportDialog headerId="hdr-1" open onOpenChange={onOpenChange} {...props} />)
  return { onOpenChange }
}

function csvFile() {
  return new File(['lon,lat,Agricultor\n-101,20,Grupo U\n'], 'asp.csv', { type: 'text/csv' })
}

describe('AspersionImportDialog', () => {
  it('no renderiza el diálogo cuando open=false', () => {
    renderDialog({ open: false })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('muestra el selector de archivo y plantilla cuando open=true', () => {
    renderDialog()
    expect(screen.getByLabelText(/Archivo CSV/i)).toBeInTheDocument()
    expect(screen.getByText(/Plantilla \(opcional\)/i)).toBeInTheDocument()
  })

  it('muestra estado de procesamiento sin selector de archivo', () => {
    renderDialog({ importStatus: 'processing' })
    expect(screen.getByText(/Importación en curso/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/Archivo CSV/i)).not.toBeInTheDocument()
  })

  it('separa columnas reconocidas y no reconocidas tras subir un CSV', async () => {
    mocks.preview.mockResolvedValue({
      matched: ['lon', 'lat'],
      unmatched: ['Agricultor'],
      col_map: { lon: 'lon', lat: 'lat' },
    })
    const user = userEvent.setup()
    renderDialog()

    await user.upload(screen.getByLabelText(/Archivo CSV/i), csvFile())

    await waitFor(() => expect(screen.getByText(/Columnas reconocidas \(2\)/i)).toBeInTheDocument())
    expect(screen.getByText(/Columnas no reconocidas \(1\)/i)).toBeInTheDocument()
    expect(screen.getByText('Agricultor')).toBeInTheDocument()
  })

  it('al remapear una columna y guardar plantilla, envía el column_mapping correcto', async () => {
    mocks.preview.mockResolvedValue({
      matched: ['lon', 'lat'],
      unmatched: ['Velocidad'],
      col_map: { lon: 'lon', lat: 'lat' },
    })
    mocks.createTemplate.mockResolvedValue({ id: 'tmpl-new' })
    mocks.importData.mockResolvedValue({ header_id: 'hdr-1' })

    const user = userEvent.setup()
    renderDialog()
    await user.upload(screen.getByLabelText(/Archivo CSV/i), csvFile())
    await waitFor(() => screen.getByText(/Columnas no reconocidas/i))

    // Remapear "Velocidad" → speed_kmh. El combobox de remapeo es el segundo
    // (el primero es el selector de plantilla).
    const combos = screen.getAllByRole('combobox')
    await user.click(combos[1]!)
    const option = await screen.findByText(/Velocidad \(km\/h\)/i)
    await user.click(option)

    await user.click(screen.getByRole('checkbox'))
    await user.type(screen.getByPlaceholderText('Nombre'), 'Mi plantilla')
    await user.type(screen.getByPlaceholderText('Código'), 'TMPL-X')
    await user.click(screen.getByRole('button', { name: /Importar/i }))

    await waitFor(() => expect(mocks.createTemplate).toHaveBeenCalled())
    expect(mocks.createTemplate.mock.calls[0]?.[0]).toMatchObject({
      code: 'TMPL-X',
      name: 'Mi plantilla',
      column_mapping: { speed_kmh: ['velocidad'] },
    })
    // El import se hace con el template_id recién creado.
    await waitFor(() => expect(mocks.importData).toHaveBeenCalled())
    expect(mocks.importData.mock.calls[0]?.[0]).toMatchObject({ headerId: 'hdr-1', templateId: 'tmpl-new' })
  })
})
