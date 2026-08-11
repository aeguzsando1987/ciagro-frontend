/**
 * Tests del modal de búsqueda avanzada (fase AS).
 *
 * Lo que se protege: la cascada. Elegir un productor debe limpiar los ranchos y
 * parcelas ya marcados, porque una selección incoherente -un rancho de un productor
 * que ya no está elegido- se combina con AND en el backend y devuelve cero resultados
 * sin explicación visible para el usuario.
 */
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/features/admin/hooks/useDataCentrals', () => ({
  useDataCentralMains: () => ({ data: [{ id: 'org-1', name: 'Organización Uno' }] }),
}))
vi.mock('../hooks/useSearchOptions', () => ({
  useProducerOptions: () => ({
    data: [
      { id: 'prod-1', label: 'Dr. Crampie' },
      { id: 'prod-2', label: 'Otro Productor' },
    ],
    isLoading: false,
  }),
  useRanchOptions: () => ({
    data: [{ id: 'ranch-1', label: 'La tijera' }],
    isLoading: false,
  }),
  usePlotOptions: () => ({ data: [{ id: 'plot-1', label: 'P-001' }], isLoading: false }),
}))

import { AdvancedSearchModal } from './AdvancedSearchModal'
import { EMPTY_CRITERIA } from '../lib/advancedSearch'

function renderModal(onApply = vi.fn()) {
  render(
    <AdvancedSearchModal
      open
      onOpenChange={vi.fn()}
      criteria={EMPTY_CRITERIA}
      onApply={onApply}
    />
  )
  return onApply
}

describe('AdvancedSearchModal', () => {
  it('ofrece los cuatro tipos de sesión, mapeo de suelo incluido', () => {
    renderModal()
    expect(screen.getByLabelText('Aspersión')).toBeInTheDocument()
    expect(screen.getByLabelText('Fitosanitaria')).toBeInTheDocument()
    expect(screen.getByLabelText('NDVI')).toBeInTheDocument()
    expect(screen.getByLabelText('Mapeo de suelo')).toBeInTheDocument()
  })

  it('pide elegir un rancho antes de listar parcelas', () => {
    renderModal()
    expect(screen.getByText(/Elige al menos un rancho/)).toBeInTheDocument()
  })

  it('aplica los criterios compuestos', () => {
    const onApply = renderModal()

    fireEvent.change(screen.getByLabelText('Buscar productor'), { target: { value: 'Cramp' } })
    fireEvent.click(screen.getByLabelText('Dr. Crampie'))
    fireEvent.click(screen.getByLabelText('NDVI'))
    fireEvent.click(screen.getByText('Aplicar filtro'))

    expect(onApply).toHaveBeenCalledWith(
      expect.objectContaining({ producers: ['prod-1'], types: ['ndvi'] })
    )
  })

  it('conserva los ranchos al AÑADIR un productor (solo ensancha la búsqueda)', () => {
    const onApply = renderModal()

    fireEvent.click(screen.getByLabelText('Dr. Crampie'))
    fireEvent.click(screen.getByLabelText('La tijera'))
    fireEvent.click(screen.getByLabelText('Otro Productor'))
    fireEvent.click(screen.getByText('Aplicar filtro'))

    expect(onApply).toHaveBeenCalledWith(
      expect.objectContaining({ producers: ['prod-1', 'prod-2'], ranches: ['ranch-1'] })
    )
  })

  it('limpia los niveles inferiores al QUITAR un productor', () => {
    // El rancho marcado podía ser del productor que se acaba de quitar: dejarlo
    // produciría un AND imposible y cero resultados sin explicación.
    const onApply = renderModal()

    fireEvent.click(screen.getByLabelText('Dr. Crampie'))
    fireEvent.click(screen.getByLabelText('La tijera'))
    fireEvent.click(screen.getByLabelText('Dr. Crampie'))
    fireEvent.click(screen.getByText('Aplicar filtro'))

    expect(onApply).toHaveBeenCalledWith(
      expect.objectContaining({ producers: [], ranches: [], plots: [] })
    )
  })
})
