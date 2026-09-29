import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createTestQueryClient } from '@/test/test-utils'
import { apiClient } from '@/lib/api/client'
import { SentinelImportDialog } from './SentinelImportDialog'

// Se mockea el CLIENTE y no se usa MSW: apiClient (openapi-fetch) escapa al interceptor en
// jsdom, cosa ya documentada en BatchImportDialog.test.tsx y useSoilMapImport.test.ts.
vi.mock('@/lib/api/client', () => ({
  apiClient: { GET: vi.fn(), POST: vi.fn() },
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}))

const getMock = vi.mocked(apiClient.GET)
const postMock = vi.mocked(apiClient.POST)

const HEADER = 'ndvi-1'

/** Las tres adquisiciones son las de la prueba real contra CDSE: delta -5, 0 y +5. */
const TRES_PASADAS = {
  target_date: '2024-10-25',
  days: 7,
  count: 3,
  results: [
    {
      acquisition_id: 'S2A_20241020T1728',
      datetime: '2024-10-20T17:28:11.000Z',
      cloud_cover: 42.5,
      platform: 'sentinel-2a',
      tiles: ['14QKH'],
      delta_days: -5,
    },
    {
      acquisition_id: 'S2B_20241025T1728',
      datetime: '2024-10-25T17:28:17.893Z',
      cloud_cover: 0,
      platform: 'sentinel-2b',
      tiles: ['14QKH', '14QLH'],
      delta_days: 0,
    },
    {
      acquisition_id: 'S2A_20241030T1728',
      datetime: '2024-10-30T17:28:09.000Z',
      cloud_cover: 3.1,
      platform: 'sentinel-2a',
      tiles: ['14QKH'],
      delta_days: 5,
    },
  ],
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ok(data: unknown): any {
  return { data, error: undefined, response: { status: 200 } }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fail(status: number, payload: unknown): any {
  return { data: undefined, error: payload, response: { status } }
}

beforeEach(() => {
  getMock.mockReset()
  postMock.mockReset()
})

afterEach(() => {
  vi.clearAllMocks()
})

function renderDialog(over: { pointsCount?: number; onGoToExisting?: (id: string) => void } = {}) {
  const onOpenChange = vi.fn()
  render(
    <QueryClientProvider client={createTestQueryClient()}>
      <SentinelImportDialog
        headerId={HEADER}
        sessionDate="2024-10-25"
        pointsCount={over.pointsCount ?? 0}
        open
        onOpenChange={onOpenChange}
        onGoToExisting={over.onGoToExisting}
      />
    </QueryClientProvider>,
  )
  return { onOpenChange }
}

async function buscar() {
  await userEvent.click(screen.getByRole('button', { name: 'Buscar' }))
}

/**
 * LO QUE ESTOS TESTS PROTEGEN es el flujo de DOS pasos. Si alguien lo "simplifica" a uno
 * (pedir fecha e importar la pasada mas cercana), el agronomo deja de ver que se descarto y
 * por que: una pasada al dia exacto puede venir con 42% de nubes y la de cinco dias despues
 * limpia. Esa eleccion es suya, y estos tests la fijan.
 */
describe('SentinelImportDialog', () => {
  it('lista las adquisiciones con su distancia en dias y su nubosidad', async () => {
    getMock.mockResolvedValue(ok(TRES_PASADAS))
    renderDialog()
    await buscar()

    expect(await screen.findByText('3 adquisiciones disponibles')).toBeInTheDocument()
    // La distancia es el dato que justifica el flujo de dos pasos.
    expect(screen.getByText(/5 dias antes/)).toBeInTheDocument()
    expect(screen.getByText(/el dia pedido/)).toBeInTheDocument()
    expect(screen.getByText(/5 dias despues/)).toBeInTheDocument()
    // Y la nube es lo que hace que la mas cercana no sea siempre la mejor.
    expect(screen.getByText('42.5% de nubes')).toBeInTheDocument()
    expect(screen.getByText('0% de nubes')).toBeInTheDocument()
  })

  it('manda la fecha y el radio de dias que eligio el usuario', async () => {
    getMock.mockResolvedValue(ok({ ...TRES_PASADAS, results: [] }))
    renderDialog()

    await userEvent.clear(screen.getByLabelText('Radio (dias)'))
    await userEvent.type(screen.getByLabelText('Radio (dias)'), '30')
    await buscar()

    await waitFor(() => expect(getMock).toHaveBeenCalled())
    expect(getMock.mock.calls[0]?.[1]).toMatchObject({
      params: { path: { id: HEADER }, query: { target_date: '2024-10-25', days: 30 } },
    })
  })

  // Radio 0 significa "solo ese dia exacto", que es un caso de uso real y ademas es falsy
  // en JavaScript: con `days ? ...` el parametro no viajaba y el backend aplicaba su
  // default de 7 dias sin decirlo. El usuario habria visto pasadas de otros dias creyendo
  // que pidio uno solo.
  it('respeta el radio 0: solo la fecha exacta', async () => {
    getMock.mockResolvedValue(ok({ ...TRES_PASADAS, results: [] }))
    renderDialog()

    await userEvent.clear(screen.getByLabelText('Radio (dias)'))
    await userEvent.type(screen.getByLabelText('Radio (dias)'), '0')
    await buscar()

    await waitFor(() => expect(getMock).toHaveBeenCalled())
    expect(getMock.mock.calls[0]?.[1]).toMatchObject({
      params: { query: { target_date: '2024-10-25', days: 0 } },
    })
  })

  it('una ventana sin pasadas no se redacta como error, sino como sugerencia', async () => {
    getMock.mockResolvedValue(ok({ target_date: '2024-10-25', days: 7, count: 0, results: [] }))
    renderDialog()
    await buscar()

    expect(await screen.findByText(/No hubo pasadas del satelite/)).toBeInTheDocument()
    expect(screen.getByText(/radio de dias mayor/)).toBeInTheDocument()
  })

  it('el 503 dice que Copernicus no responde, no que el sistema fallo', async () => {
    getMock.mockResolvedValue(fail(503, { detail: 'Copernicus no esta disponible: timeout' }))
    renderDialog()
    await buscar()

    // Lo que se le dice al usuario NO puede sugerir un fallo de CIAgro: mandaria a reportar
    // un problema que no existe y que se resuelve solo.
    const aviso = await screen.findByText(/Copernicus no responde en este momento/)
    expect(aviso).toBeInTheDocument()
    expect(screen.queryByText(/error del sistema/i)).not.toBeInTheDocument()
  })

  it('no deja importar sin haber elegido una adquisicion', async () => {
    getMock.mockResolvedValue(ok(TRES_PASADAS))
    renderDialog()
    await buscar()
    await screen.findByText('3 adquisiciones disponibles')

    expect(screen.getByRole('button', { name: 'Importar la seleccionada' })).toBeDisabled()
  })

  it('importa la adquisicion elegida, no la primera de la lista', async () => {
    getMock.mockResolvedValue(ok(TRES_PASADAS))
    postMock.mockResolvedValue(ok({ header_id: HEADER, celery_task_id: 't-1' }))
    const { onOpenChange } = renderDialog()
    await buscar()
    await screen.findByText('3 adquisiciones disponibles')

    await userEvent.click(screen.getByText(/5 dias despues/))
    await userEvent.click(screen.getByRole('button', { name: 'Importar la seleccionada' }))

    await waitFor(() => expect(postMock).toHaveBeenCalled())
    expect(postMock.mock.calls[0]?.[1]).toMatchObject({
      body: { acquisition_id: 'S2A_20241030T1728' },
    })
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
  })

  it('advierte del reemplazo solo cuando la sesion ya tiene puntos', async () => {
    getMock.mockResolvedValue(ok(TRES_PASADAS))
    renderDialog({ pointsCount: 4303 })
    // Antes de buscar no se grita: todavia no hay nada que elegir.
    expect(screen.queryByText(/4,303 puntos cargados/)).not.toBeInTheDocument()

    await buscar()
    expect(await screen.findByText(/4,303 puntos cargados/)).toBeInTheDocument()
  })

  it('no advierte del reemplazo si la sesion esta vacia', async () => {
    getMock.mockResolvedValue(ok(TRES_PASADAS))
    renderDialog({ pointsCount: 0 })
    await buscar()
    await screen.findByText('3 adquisiciones disponibles')

    expect(screen.queryByText(/Importar los/)).not.toBeInTheDocument()
  })

  it('ofrece abrir la sesion que ya tiene esa pasada cuando el backend responde 409', async () => {
    getMock.mockResolvedValue(ok(TRES_PASADAS))
    postMock.mockResolvedValue(
      fail(409, {
        detail: 'Esta parcela ya tiene otra sesion con esa misma adquisicion de Sentinel-2.',
        existing_header_id: 'ndvi-otra',
      }),
    )
    const onGoToExisting = vi.fn()
    renderDialog({ onGoToExisting })
    await buscar()
    await screen.findByText('3 adquisiciones disponibles')

    await userEvent.click(screen.getByText(/el dia pedido/))
    await userEvent.click(screen.getByRole('button', { name: 'Importar la seleccionada' }))

    const ir = await screen.findByRole('button', { name: 'Ver la sesion existente' })
    await userEvent.click(ir)
    // El id tiene que ser el que dio el backend: buscar la sesion a mano es justo lo que
    // este camino evita.
    expect(onGoToExisting).toHaveBeenCalledWith('ndvi-otra')
  })

  it('sin onGoToExisting el 409 informa pero no ofrece navegar', async () => {
    getMock.mockResolvedValue(ok(TRES_PASADAS))
    postMock.mockResolvedValue(
      fail(409, { detail: 'duplicada', existing_header_id: 'ndvi-otra' }),
    )
    renderDialog()
    await buscar()
    await screen.findByText('3 adquisiciones disponibles')

    await userEvent.click(screen.getByText(/el dia pedido/))
    await userEvent.click(screen.getByRole('button', { name: 'Importar la seleccionada' }))

    expect(await screen.findByText(/ya tiene esa misma pasada/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Ver la sesion existente' })).not.toBeInTheDocument()
  })
})
