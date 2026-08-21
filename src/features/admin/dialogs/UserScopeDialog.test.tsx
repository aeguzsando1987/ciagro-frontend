import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { UserScopeDialog } from './UserScopeDialog'
import { useAssignmentScope } from '../hooks/useAssignmentScope'
import { useProducers } from '../hooks/useProducers'
import { usePlots } from '../hooks/usePlots'

const guardar = vi.hoisted(() => vi.fn())

vi.mock('../hooks/useAssignmentScope', async () => {
  const real = await vi.importActual<object>('../hooks/useAssignmentScope')
  return {
    ...real,
    useAssignmentScope: vi.fn(),
    useUpdateAssignmentScope: () => ({ mutateAsync: guardar, isPending: false }),
  }
})
vi.mock('../hooks/useProducers', () => ({ useProducers: vi.fn() }))
vi.mock('../hooks/useRanches', () => ({
  useRanches: () => ({ data: [], isLoading: false, isError: false }),
}))
vi.mock('../hooks/usePlots', () => ({ usePlots: vi.fn() }))

const PRODUCTORES = [
  { id: 'ag-1', commercial_name: 'Agrounidad Uno' },
  { id: 'ag-2', commercial_name: 'Agrounidad Dos' },
]

const PARCELAS = [
  {
    id: 'p1', code: 'P-001', ranch: 'r-1', ranch_name: 'Rancho Norte',
    producer_id: 'ag-1', producer_name: 'Agrounidad Uno',
  },
  {
    id: 'p2', code: 'P-002', ranch: 'r-1', ranch_name: 'Rancho Norte',
    producer_id: 'ag-1', producer_name: 'Agrounidad Uno',
  },
  {
    id: 'p3', code: 'P-003', ranch: 'r-2', ranch_name: 'Rancho Sur',
    producer_id: 'ag-2', producer_name: 'Agrounidad Dos',
  },
]

function montar(alcance: { access_mode: string; plots?: unknown[] }, parcelas = PARCELAS) {
  vi.mocked(useAssignmentScope).mockReturnValue({
    data: { id: 7, access_mode: alcance.access_mode, plots: alcance.plots ?? [] },
    isLoading: false,
    isError: false,
  } as never)
  vi.mocked(useProducers).mockReturnValue({
    data: PRODUCTORES, isLoading: false, isError: false,
  } as never)
  vi.mocked(usePlots).mockReturnValue({
    data: parcelas, isLoading: false, isError: false,
  } as never)

  return render(
    <UserScopeDialog
      open
      onOpenChange={vi.fn()}
      assignmentId={7}
      username="tecnico01"
      datacentralId="dc-1"
      datacentralName="CIA Norte"
    />
  )
}

describe('UserScopeDialog', () => {
  beforeEach(() => {
    guardar.mockReset()
    guardar.mockResolvedValue({})
  })

  it('en acceso completo NO muestra el selector de parcelas', () => {
    // Mostrarlo sugeriria que la seleccion importa, cuando en modo completo se ignora.
    montar({ access_mode: 'full' })
    expect(screen.getByText('Acceso completo')).toBeInTheDocument()
    expect(screen.queryByPlaceholderText('Buscar parcela…')).not.toBeInTheDocument()
  })

  it('al elegir delimitado aparece el selector agrupado Agrounidad → Rancho', async () => {
    const user = userEvent.setup()
    montar({ access_mode: 'full' })

    await user.click(screen.getByRole('radio', { name: /Delimitado por parcela/i }))

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Buscar parcela…')).toBeInTheDocument()
    })
    expect(screen.getByText('Agrounidad Uno')).toBeInTheDocument()
    expect(screen.getByText('Agrounidad Dos')).toBeInTheDocument()
    expect(screen.getByText('Rancho Norte')).toBeInTheDocument()
    expect(screen.getByText('P-001')).toBeInTheDocument()
  })

  it('parte del alcance ya guardado, no de un estado en blanco', () => {
    montar({
      access_mode: 'restricted',
      plots: [{ id: 'p1', code: 'P-001' }],
    })
    expect(screen.getByText(/1 parcela\(s\) seleccionada/)).toBeInTheDocument()
  })

  it('avisa cuando delimitado se queda sin ninguna parcela', () => {
    // Es un estado valido en la BD pero deja al usuario sin ver NADA: se avisa antes
    // de guardar, no despues.
    montar({ access_mode: 'restricted', plots: [] })
    expect(screen.getByText(/no verá\s+nada dentro de/i)).toBeInTheDocument()
  })

  it('distingue "esta CIAgro no tiene parcelas" de un fallo de carga', () => {
    // Hay CIAgros con productores y cero parcelas: sin este aviso el modal parece roto.
    montar({ access_mode: 'restricted', plots: [] }, [])
    expect(screen.getByText('Esta CIAgro no tiene parcelas')).toBeInTheDocument()
  })

  it('guarda el modo y el conjunto completo de parcelas en UNA sola llamada', async () => {
    const user = userEvent.setup()
    montar({ access_mode: 'restricted', plots: [{ id: 'p1', code: 'P-001' }] })

    await user.click(screen.getByLabelText('P-003', { exact: false }))
    await user.click(screen.getByRole('button', { name: /Guardar alcance/i }))

    await waitFor(() => expect(guardar).toHaveBeenCalledTimes(1))
    const payload = guardar.mock.calls[0]![0] as { accessMode: string; plotIds: string[] }
    expect(payload.accessMode).toBe('restricted')
    expect([...payload.plotIds].sort()).toEqual(['p1', 'p3'])
  })

  it('el checkbox del rancho marca todas sus parcelas de golpe', async () => {
    const user = userEvent.setup()
    montar({ access_mode: 'restricted', plots: [] })

    await user.click(screen.getByLabelText(/Rancho Norte/i, { exact: false }))
    await user.click(screen.getByRole('button', { name: /Guardar alcance/i }))

    await waitFor(() => expect(guardar).toHaveBeenCalled())
    const payload = guardar.mock.calls[0]![0] as { plotIds: string[] }
    expect([...payload.plotIds].sort()).toEqual(['p1', 'p2'])
  })
})
