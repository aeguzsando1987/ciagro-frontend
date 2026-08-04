import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClientProvider } from '@tanstack/react-query'
import { CreateSessionDialog } from './CreateSessionDialog'
import { createTestQueryClient } from '@/test/test-utils'
import type { MasterProgram } from '../types'

const mocks = vi.hoisted(() => ({
  post: vi.fn(),
}))

vi.mock('@/lib/api/client', () => ({
  apiClient: { POST: mocks.post },
}))

vi.mock('../hooks/useEvaluations', () => ({
  useEvaluations: () => ({ data: [], isLoading: false }),
}))

vi.mock('../hooks/useDatacentralUsers', () => ({
  useDatacentralUsers: () => ({ data: [] }),
}))

const PROGRAM_ID = '11111111-1111-4111-8111-111111111111'
const MASTER_ID = '22222222-2222-4222-8222-222222222222'
const PLOT_ID = '33333333-3333-4333-8333-333333333333'

const master: MasterProgram = {
  id: MASTER_ID,
  title: 'Programa Primavera',
  code: 'PROG-2026-A',
  agro_unit: 'productor-1',
  status: 'in_progress',
  status_display: 'En progreso',
  est_start_date: '2026-07-01',
  est_finish_date: '2026-08-31',
  real_start_date: null,
  real_finish_date: null,
  notes: '',
  created_at: '2026-07-01T00:00:00Z',
  updated_at: '2026-07-01T00:00:00Z',
}

function renderDialog(plot: string | null = PLOT_ID) {
  const onOpenChange = vi.fn()
  const queryClient = createTestQueryClient()
  const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries')

  render(
    <QueryClientProvider client={queryClient}>
      <CreateSessionDialog
        open
        onOpenChange={onOpenChange}
        programa={{
          id: PROGRAM_ID,
          master_program: MASTER_ID,
          title: 'Subprograma Norte',
          plot,
        }}
        master={master}
        datacentralId="datacentral-1"
      />
    </QueryClientProvider>
  )

  return { onOpenChange, invalidateQueries }
}

/** Elige un tipo de sesión en el select del encabezado del diálogo. */
async function selectSessionType(
  user: ReturnType<typeof userEvent.setup>,
  label: string,
) {
  await user.click(screen.getByRole('combobox', { name: /Tipo de sesión/i }))
  await user.click(await screen.findByRole('option', { name: label }))
}

beforeEach(() => {
  mocks.post.mockReset()
  mocks.post.mockResolvedValue({ data: { id: 'soil-map-1' }, error: undefined })
})

describe('CreateSessionDialog — mapeo de suelo', () => {
  it('permite elegir Mapeo de suelo y muestra sus campos propios', async () => {
    const user = userEvent.setup()
    renderDialog()

    await selectSessionType(user, 'Mapeo de suelo')

    expect(screen.getByLabelText('Fecha del mapeo *')).toBeInTheDocument()
    expect(screen.getByLabelText('Inicio estimado')).toBeInTheDocument()
    expect(screen.getByLabelText('Fin estimado')).toBeInTheDocument()
    expect(screen.queryByText('Evaluación')).not.toBeInTheDocument()
    expect(screen.queryByText('Modo estricto')).not.toBeInTheDocument()
  })

  it('crea el header, actualiza el árbol y cierra el diálogo', async () => {
    const user = userEvent.setup()
    const { onOpenChange, invalidateQueries } = renderDialog()

    await selectSessionType(user, 'Mapeo de suelo')
    await user.type(screen.getByLabelText('Fecha del mapeo *'), '2026-07-23')
    await user.type(screen.getByLabelText('Inicio estimado'), '2026-07-24')
    await user.type(screen.getByLabelText('Fin estimado'), '2026-07-30')
    await user.click(screen.getByRole('button', { name: 'Crear Sesión' }))

    await waitFor(() => expect(mocks.post).toHaveBeenCalledOnce())
    expect(mocks.post).toHaveBeenCalledWith('/api/v1/monitoring/soil-map/headers/', {
      body: {
        program_id: PROGRAM_ID,
        mapping_date: '2026-07-23',
        est_init_date: '2026-07-24',
        est_finish_date: '2026-07-30',
      },
    })
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['master-tree', MASTER_ID],
    })
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('advierte cuando el subprograma no tiene parcela asignada', async () => {
    const user = userEvent.setup()
    renderDialog(null)

    await selectSessionType(user, 'Mapeo de suelo')

    expect(screen.getByText(/no tiene parcela asignada/i)).toBeInTheDocument()
  })
})
