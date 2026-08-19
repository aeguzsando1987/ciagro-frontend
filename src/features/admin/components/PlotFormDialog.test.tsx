import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PlotFormDialog } from './PlotFormDialog'
import { useRanches } from '../hooks/useRanches'

const createPlot = vi.hoisted(() => vi.fn())

vi.mock('../hooks/useRanches', () => ({
  useRanches: vi.fn(),
}))

vi.mock('../hooks/usePlots', () => ({
  useCreatePlot: () => ({ mutateAsync: createPlot, isPending: false }),
  useUpdatePlot: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))

const ranches = [
  { id: 'ranch-1', code: 'R-001', name: 'Rancho Norte' },
  { id: 'ranch-2', code: 'R-002', name: 'Rancho Sur' },
]

function mockRanches(data = ranches) {
  vi.mocked(useRanches).mockReturnValue({
    data,
    isLoading: false,
    isError: false,
  } as never)
}

describe('PlotFormDialog', () => {
  beforeEach(() => {
    createPlot.mockReset()
    createPlot.mockResolvedValue({ id: 'plot-1', code: 'P-001', ranch: 'ranch-1' })
    mockRanches()
  })

  it('consulta y muestra únicamente los ranchos del productor recibido', async () => {
    const user = userEvent.setup()
    render(<PlotFormDialog open onClose={vi.fn()} producerId="producer-1" />)

    expect(useRanches).toHaveBeenCalledWith('producer-1')
    await user.click(screen.getByRole('combobox', { name: 'Rancho' }))

    expect(screen.getByRole('option', { name: /Rancho Norte/i })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: /Rancho Sur/i })).toBeInTheDocument()
    expect(
      screen.getByText(/Solo se muestran ranchos pertenecientes a este productor/i)
    ).toBeInTheDocument()
  })

  it('permite elegir el rancho y lo envía al crear la parcela', async () => {
    const user = userEvent.setup()
    render(<PlotFormDialog open onClose={vi.fn()} producerId="producer-1" />)

    const codeInput = document.querySelector<HTMLInputElement>('input[name="code"]')
    expect(codeInput).not.toBeNull()
    await user.type(codeInput!, 'P-002')
    await user.click(screen.getByRole('combobox', { name: 'Rancho' }))
    await user.click(screen.getByRole('option', { name: /Rancho Sur/i }))
    await user.click(screen.getByRole('button', { name: 'Crear' }))

    await waitFor(() =>
      expect(createPlot).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'P-002',
          ranch: 'ranch-2',
        })
      )
    )
  })

  it('selecciona automáticamente el único rancho disponible', async () => {
    mockRanches([ranches[0]!])
    render(<PlotFormDialog open onClose={vi.fn()} producerId="producer-1" />)

    const ranchSelect = await screen.findByRole('combobox', { name: 'Rancho' })
    expect(ranchSelect).toBeEnabled()
    expect(ranchSelect).toHaveTextContent('Rancho Norte')
    expect(screen.getByText(/se seleccionó automáticamente/i)).toBeInTheDocument()
  })

  it('indica que debe crearse un rancho y bloquea la creación cuando no existen', async () => {
    const user = userEvent.setup()
    const onCreateRanch = vi.fn()
    mockRanches([])
    render(
      <PlotFormDialog
        open
        onClose={vi.fn()}
        producerId="producer-1"
        onCreateRanch={onCreateRanch}
      />
    )

    expect(screen.getByText('Primero crea un rancho')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Crear' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Crear rancho' }))
    expect(onCreateRanch).toHaveBeenCalledOnce()
  })

  it('resincroniza el rancho sugerido cuando un diálogo ya montado se abre', async () => {
    const { rerender } = render(
      <PlotFormDialog open={false} onClose={vi.fn()} producerId="producer-1" />
    )

    rerender(
      <PlotFormDialog open onClose={vi.fn()} producerId="producer-1" suggestedRanchId="ranch-2" />
    )

    const ranchSelect = await screen.findByRole('combobox', { name: 'Rancho' })
    expect(ranchSelect).toBeEnabled()
    expect(ranchSelect).toHaveTextContent('Rancho Sur')
  })
})
