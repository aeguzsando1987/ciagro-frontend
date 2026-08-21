/**
 * El Visor como pantalla principal de una CIAgro.
 *
 * Lo que se protege aquí es que al entrar el panel derecho abra YA en el nivel de la
 * CIAgro, sin que el usuario toque el árbol. Ese mismo estado es el punto de retorno:
 * seleccionar la CIAgro en el explorador vuelve aquí desde cualquier nivel.
 */
import { screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { renderWithQueryClient } from '@/test/test-utils'
import { GeodataVisorShell } from '@/features/geodata-visor/components/GeodataVisorShell'
import type { VisorSelection } from '@/features/geodata-visor/types'

vi.mock('@tanstack/react-router', async () => {
  const real = await vi.importActual<object>('@tanstack/react-router')
  return { ...real, useSearch: () => ({}), useNavigate: () => vi.fn() }
})
vi.mock('@/features/admin/hooks/useDataCentrals', () => ({
  useDataCentralMains: () => ({ data: [], isLoading: false, error: null }),
  useDataCentrals: () => ({ data: [], isLoading: false, error: null }),
}))
vi.mock('@/features/admin/hooks/useProducers', () => ({
  useProducers: () => ({ data: [], isLoading: false }),
}))
vi.mock('@/features/admin/hooks/useRanches', () => ({
  useRanches: () => ({ data: [], isLoading: false }),
}))
vi.mock('@/features/admin/hooks/usePlots', () => ({
  usePlots: () => ({ data: [], isLoading: false }),
  usePlotDetail: () => ({ data: null, isLoading: false }),
}))
vi.mock('@/features/geodata-visor/hooks/useAdvancedSessionSearch', () => ({
  useAdvancedSessionSearch: () => ({ data: null, isLoading: false }),
}))

const SELECCION: VisorSelection = {
  level: 'datacentral',
  org: { id: 'org-1', name: 'Organización Uno' },
  datacentral: { id: 'dc-1', name: 'CIAgro Norte' },
}

describe('Visor como pantalla principal de la CIAgro', () => {
  it('sin selección inicial mantiene el estado vacío de siempre', () => {
    // Control: es el comportamiento de /visor-datos, que no debe cambiar.
    renderWithQueryClient(<GeodataVisorShell />)
    expect(screen.getByText('Explora tus datos agrícolas')).toBeInTheDocument()
  })

  it('con selección inicial abre directamente en el panel de la CIAgro', async () => {
    renderWithQueryClient(<GeodataVisorShell initialSelection={SELECCION} />)

    await waitFor(() => {
      expect(screen.queryByText('Explora tus datos agrícolas')).not.toBeInTheDocument()
    })
    // El saludo es el dashboard de entrada; debajo van los totales de la CIAgro.
    expect(screen.getByText(/Bienvenido/)).toBeInTheDocument()
    // El nombre sale dos veces (cabecera y saludo): basta con que el panel lo diga.
    expect(screen.getByText(/Estás en/)).toBeInTheDocument()
    expect(screen.getAllByText('CIAgro Norte').length).toBeGreaterThan(0)
  })
})
