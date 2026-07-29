import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SoilMapImportDialog } from './SoilMapImportDialog'
import type { SoilMapPreviewResult } from '../hooks/useSoilMapImport'

beforeAll(() => {
  Element.prototype.hasPointerCapture = vi.fn() as never
  Element.prototype.releasePointerCapture = vi.fn() as never
  Element.prototype.scrollIntoView = vi.fn() as never
})

const mocks = vi.hoisted(() => ({
  preview: vi.fn<(args: unknown) => Promise<SoilMapPreviewResult>>(),
  importData: vi.fn<(args: unknown) => Promise<unknown>>(),
}))

vi.mock('../hooks/useSoilMapImport', () => ({
  usePreviewSoilMapColumns: () => ({ mutateAsync: mocks.preview, isPending: false }),
  useImportSoilMapData: () => ({ mutateAsync: mocks.importData, isPending: false }),
}))

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

beforeEach(() => {
  mocks.preview.mockReset()
  mocks.importData.mockReset()
})

function renderDialog(props: Partial<React.ComponentProps<typeof SoilMapImportDialog>> = {}) {
  const onOpenChange = vi.fn()
  render(<SoilMapImportDialog headerId="header-1" open onOpenChange={onOpenChange} {...props} />)
  return { onOpenChange }
}

function csvFile() {
  return new File(['longitude,latitude,pH,extra\n-103.3,20.7,6.8,x\n'], 'soil.csv', {
    type: 'text/csv',
  })
}

describe('SoilMapImportDialog', () => {
  it('no renderiza el diálogo cuando está cerrado', () => {
    renderDialog({ open: false })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('muestra el estado de procesamiento sin selector de archivo', () => {
    renderDialog({ importStatus: 'processing' })
    expect(screen.getByText(/Importación en curso/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/Archivo CSV/i)).not.toBeInTheDocument()
  })

  it('presenta las columnas reconocidas y las que serán ignoradas', async () => {
    mocks.preview.mockResolvedValue({
      matched: ['pH'],
      unmatched: ['extra'],
      col_map: { pH: 'pH' },
    })
    const user = userEvent.setup()
    renderDialog()

    await user.upload(screen.getByLabelText(/Archivo CSV/i), csvFile())

    await waitFor(() => expect(screen.getByText(/Columnas reconocidas \(1\)/i)).toBeInTheDocument())
    expect(screen.getByText(/Columnas no reconocidas \(1\)/i)).toBeInTheDocument()
    expect(screen.getByText('extra')).toBeInTheDocument()
  })

  it('envía el archivo y cierra el diálogo al encolar la importación', async () => {
    mocks.preview.mockResolvedValue({ matched: ['pH'], unmatched: [], col_map: { pH: 'pH' } })
    mocks.importData.mockResolvedValue({ header_id: 'header-1' })
    const user = userEvent.setup()
    const { onOpenChange } = renderDialog()
    const file = csvFile()

    await user.upload(screen.getByLabelText(/Archivo CSV/i), file)
    await user.click(screen.getByRole('button', { name: 'Importar' }))

    await waitFor(() => expect(mocks.importData).toHaveBeenCalledOnce())
    expect(mocks.importData).toHaveBeenCalledWith({ headerId: 'header-1', file })
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})
