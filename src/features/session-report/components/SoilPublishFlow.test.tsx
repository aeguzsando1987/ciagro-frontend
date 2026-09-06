/**
 * Eleccion de las capas del entregable (RS-17).
 *
 * PREPARAR NO ES PUBLICAR: las capas se preparan solas al abrirlas en el panel, y
 * aqui solo se elige cuales salen en el PDF y el KMZ. Antes hojear el selector
 * metia paginas al entregable.
 *
 * Se mockea `SoilLayerCapture` y NO el motor de preparacion, para que el gate
 * —el que espera al raster— siga cubierto por estos tests.
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockOptions = vi.fn()
const mockFreeze = vi.fn()
const mockSetPublished = vi.fn()
/** Captura montada: layerKey, gate y callbacks, para dispararlos desde el test. */
const captura = {
  layerKey: null as string | null,
  ready: false,
  onComputed: null as null | ((r: unknown) => void),
  onCaptured: null as null | ((b: Blob) => void),
  onError: null as null | ((m: string) => void),
}

vi.mock('./SoilLayerPicker', () => ({ useSoilLayerOptions: () => mockOptions() }))
const mockStats = vi.fn()
vi.mock('../hooks/useSoilLayerStats', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../hooks/useSoilLayerStats')>()),
  useSoilLayerStats: () => mockStats(),
}))
vi.mock('../hooks/useFreezeSoilLayer', () => ({
  useFreezeSoilLayer: () => ({ mutate: mockFreeze, isPending: false }),
  useSetPublishedLayers: () => ({ mutate: mockSetPublished, isPending: false }),
}))
vi.mock('./SoilLayerCapture', () => ({
  SoilLayerCapture: (p: {
    layerKey: string
    ready: boolean
    onComputed: (r: unknown) => void
    onCaptured: (b: Blob) => void
    onError: (m: string) => void
  }) => {
    captura.layerKey = p.layerKey
    captura.ready = p.ready
    captura.onComputed = p.onComputed
    captura.onCaptured = p.onCaptured
    captura.onError = p.onError
    return <div data-testid="captura">{p.layerKey}</div>
  },
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { SoilPublishFlow } from './SoilPublishFlow'

function capa(key: string, label: string, kind: 'numeric' | 'category' = 'numeric') {
  return {
    key, label, field: key, group: '', unit: '',
    kind, class_count: 3, break_count: 2, palette: ['#a', '#b', '#c'],
  }
}
const GRUPOS = [
  { group: 'Físicas', layers: [capa('ph', 'pH'), capa('clay', 'Arcilla')] },
  { group: 'Macro', layers: [capa('potassium', 'Potasio')] },
]

/** Lo que emite SoilMap al terminar de clasificar, YA con el raster. */
const COMPUTED = {
  layerKey: 'ph',
  entries: [
    { key: 'band-0', color: '#a', label: '7–9' },
    { key: 'band-1', color: '#b', label: '5–7' },
    { key: 'band-2', color: '#c', label: '3–5' },
  ],
  breaks: [5, 7],
  sampleBuckets: ['band-0', 'band-1'],
  bucketCellCounts: { 'band-0': 50, 'band-1': 50, 'band-2': 0 },
  totalAreaHa: 10,
}

function renderFlow(over: Record<string, unknown> = {}) {
  return render(
    <SoilPublishFlow
      reportId="r1"
      sessionType="soilmap"
      objectId="h1"
      plotId="p1"
      canWrite
      preparedLayers={[]}
      publishedLayers={[]}
      {...over}
    />
  )
}

function clasificar(layerKey = captura.layerKey!, over: Record<string, unknown> = {}) {
  act(() => captura.onComputed!({ ...COMPUTED, layerKey, ...over }))
}

/** El componente real no fotografia con el gate cerrado; afirmarlo evita simular
 *  un orden que la realidad no permite. */
function fotografiar() {
  expect(captura.ready).toBe(true)
  act(() => captura.onCaptured!(new Blob(['x'])))
}

function completarCapa() {
  clasificar()
  fotografiar()
  const opciones = mockFreeze.mock.calls.at(-1)![1] as { onSuccess: () => void }
  act(() => opciones.onSuccess())
}

const aplicar = () => fireEvent.click(screen.getByRole('button', { name: /Aplicar selección/ }))

describe('SoilPublishFlow', () => {
  beforeEach(() => {
    mockFreeze.mockReset()
    mockSetPublished.mockReset()
    captura.layerKey = null
    captura.ready = false
    mockOptions.mockReturnValue({
      groups: GRUPOS,
      layers: GRUPOS.flatMap((g) => g.layers),
      isLoading: false,
    })
    mockStats.mockReturnValue({
      data: {
        layer: { kind: 'numeric' },
        histogram: { bin_count: 2, bins: [{ lower: 3, upper: 6, count: 1 }] },
      },
    })
  })

  it('marca las capas que ya están preparadas', () => {
    // Sin la marca habria que abrirlas una por una para saber cual falta.
    renderFlow({ preparedLayers: ['ph'] })
    expect(screen.getAllByText('✓ lista')).toHaveLength(1)
  })

  it('con todas preparadas solo guarda la selección: no recalcula nada', () => {
    renderFlow({ preparedLayers: ['ph', 'clay'], publishedLayers: ['ph'] })
    fireEvent.click(screen.getByLabelText(/Arcilla/))
    aplicar()

    expect(screen.queryByTestId('captura')).toBeNull()
    expect(mockFreeze).not.toHaveBeenCalled()
    // Orden del CATALOGO, no de clic: define las paginas del PDF.
    expect(mockSetPublished).toHaveBeenCalledWith(['ph', 'clay'], expect.anything())
  })

  it('prepara solo lo que falta y después guarda la selección', () => {
    renderFlow({ preparedLayers: ['ph'] })
    fireEvent.click(screen.getByLabelText(/pH/))
    fireEvent.click(screen.getByLabelText(/Arcilla/))
    aplicar()

    // pH ya estaba lista: solo se prepara Arcilla.
    expect(captura.layerKey).toBe('clay')
    expect(mockSetPublished).not.toHaveBeenCalled()

    completarCapa()
    expect(mockSetPublished).toHaveBeenCalledWith(['ph', 'clay'], expect.anything())
  })

  it('prepara UNA capa a la vez, no todas en paralelo', async () => {
    renderFlow()
    fireEvent.click(screen.getByLabelText(/Arcilla/))
    fireEvent.click(screen.getByLabelText(/pH/))
    aplicar()

    expect(screen.getAllByTestId('captura')).toHaveLength(1)
    expect(captura.layerKey).toBe('ph')

    completarCapa()
    await waitFor(() => expect(captura.layerKey).toBe('clay'))
    expect(screen.getAllByTestId('captura')).toHaveLength(1)
  })

  it('congela la capa CON su histograma y SIN publicarla por su cuenta', () => {
    // El histograma lo calcula el backend; y publicar es la eleccion de despues.
    renderFlow()
    fireEvent.click(screen.getByLabelText(/pH/))
    aplicar()
    clasificar('ph')
    fotografiar()

    const payload = mockFreeze.mock.calls[0]![0] as {
      histogram?: { bins: unknown[] }
      publish?: boolean
    }
    expect(payload.histogram?.bins).toHaveLength(1)
    expect(payload.publish).toBe(false)
  })

  /**
   * SoilMap clasifica desde los valores crudos cuando el raster no ha llegado, asi
   * que la clasificacion aparece ANTES que la superficie. Congelar ahi daba la foto
   * del satelite sin puntos y la columna "Superficie" en guiones.
   */
  it('NO captura una capa numérica sin el reparto por superficie', () => {
    renderFlow()
    fireEvent.click(screen.getByLabelText(/pH/))
    aplicar()

    clasificar('ph', { bucketCellCounts: null })
    expect(captura.ready).toBe(false)

    clasificar('ph')
    expect(captura.ready).toBe(true)
  })

  it('una capa categórica no espera raster: no interpola', () => {
    const cat = capa('texture', 'Clase textural', 'category')
    mockOptions.mockReturnValue({
      groups: [{ group: 'Físicas', layers: [cat] }],
      layers: [cat],
      isLoading: false,
    })
    renderFlow()
    fireEvent.click(screen.getByLabelText(/Clase textural/))
    aplicar()

    clasificar('texture', { bucketCellCounts: null })
    expect(captura.ready).toBe(true)
  })

  it('el gate exige que la clasificación sea de LA capa en turno', () => {
    // Al encadenar, el resultado de la anterior sigue un instante en estado:
    // capturar ahi congelaria la capa equivocada con el titulo correcto.
    renderFlow()
    fireEvent.click(screen.getByLabelText(/pH/))
    fireEvent.click(screen.getByLabelText(/Arcilla/))
    aplicar()

    clasificar('clay')
    expect(captura.layerKey).toBe('ph')
    expect(captura.ready).toBe(false)
  })

  /**
   * DEFECTO REAL: "en el PDF no aparecen todas las capas seleccionadas". Un solo
   * fallo vaciaba la cola, asi que todas las capas POSTERIORES se quedaban sin
   * preparar y la seleccion no se guardaba — sin decir por que.
   */
  it('una capa que falla se salta: el resto del lote sigue', async () => {
    renderFlow()
    fireEvent.click(screen.getByLabelText(/pH/))
    fireEvent.click(screen.getByLabelText(/Arcilla/))
    aplicar()

    expect(captura.layerKey).toBe('ph')
    act(() => captura.onError!('WebGL no disponible'))

    // Se pasa a la siguiente en vez de abortar.
    await waitFor(() => expect(captura.layerKey).toBe('clay'))
    completarCapa()

    // Y se guarda SOLO la que quedo lista: incluir la fallida haria que el backend
    // rechazara la seleccion entera y se perdiera tambien la buena.
    expect(mockSetPublished).toHaveBeenCalledWith(['clay'], expect.anything())
  })

  it('si fallan todas no guarda una selección vacía por accidente', async () => {
    renderFlow()
    fireEvent.click(screen.getByLabelText(/pH/))
    aplicar()
    act(() => captura.onError!('WebGL no disponible'))

    await waitFor(() => expect(screen.queryByTestId('captura')).toBeNull())
    expect(mockFreeze).not.toHaveBeenCalled()
    expect(mockSetPublished).toHaveBeenCalledWith([], expect.anything())
  })

  it('permite seleccionar todas y limpiar', () => {
    renderFlow()
    fireEvent.click(screen.getByRole('button', { name: /Seleccionar todas \(3\)/ }))
    expect(screen.getByLabelText(/Potasio/)).toBeChecked()

    fireEvent.click(screen.getByRole('button', { name: 'Limpiar' }))
    expect(screen.getByLabelText(/Potasio/)).not.toBeChecked()
  })

  it('arranca con las capas ya elegidas marcadas', () => {
    renderFlow({ preparedLayers: ['clay'], publishedLayers: ['clay'] })
    expect(screen.getByLabelText(/Arcilla/)).toBeChecked()
    expect(screen.getByLabelText(/pH/)).not.toBeChecked()
  })

  it('sin permiso de escritura no deja tocar nada', () => {
    renderFlow({ canWrite: false })
    expect(screen.getByLabelText(/pH/)).toBeDisabled()
  })
})
