import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  points: [] as Array<Record<string, unknown>>,
  plot: null as null | {
    geometry?: {
      type: 'Polygon'
      coordinates: number[][][]
    } | null
    properties?: { total_area?: string | null }
  },
  analyzeSurface: vi.fn(() => null),
  // Permiten desacoplar la respuesta del endpoint del fixture de puntos, que es
  // justo lo que hay que poder probar: el combobox lo gobiernan las estadisticas.
  statsOverride: null as null | Record<string, unknown>,
  statsLoading: false,
}))

/**
 * Derivados del fixture, cacheados por render.
 *
 * Los hooks reales los sirve react-query, que devuelve la MISMA referencia entre
 * renders mientras el dato no cambie. Devolver un objeto nuevo en cada llamada
 * romperia esa suposicion: `samples` se recalcularia siempre, con el `legendEntries`
 * nuevo cada vez, y el efecto que marca los rangos visibles entraria en un ciclo
 * infinito de renders. El cache reproduce la estabilidad de react-query; se
 * invalida con `setPoints`.
 */
const derived = vi.hoisted(() => ({
  geoms: null as null | Array<Record<string, unknown>>,
  values: new Map<string, Map<string, number | string>>(),
  stats: null as null | Record<string, unknown>,
}))

const geomsFromFixture = vi.hoisted(
  () => () => {
    if (!derived.geoms) {
      derived.geoms = mocks.points.map((point) => ({ id: point.id, geom: point.geom }))
    }
    return derived.geoms
  }
)

/**
 * Respuesta de /variable-stats/ armada a partir del fixture.
 *
 * Se clasifica por el tipo del valor en vez de consultar el catálogo de capas:
 * así el helper no necesita importar nada y sigue funcionando cuando un test
 * agrega campos nuevos al fixture. Las etiquetas no importan aquí — el combobox
 * usa las de `soilMapLayers.ts`, no las del endpoint.
 */
const statsFromFixture = vi.hoisted(
  () => () => {
    if (derived.stats) return derived.stats
    const numeric = new Map<string, number>()
    const text = new Map<string, number>()
    for (const point of mocks.points) {
      for (const [key, value] of Object.entries(point)) {
        if (key === 'id' || key === 'geom' || value == null) continue
        if (typeof value === 'number') {
          numeric.set(key, (numeric.get(key) ?? 0) + 1)
        } else if (typeof value === 'string' && value.trim() !== '') {
          text.set(key, (text.get(key) ?? 0) + 1)
        }
      }
    }
    derived.stats = {
      header_id: 'soil-1',
      points_count: mocks.points.length,
      variables: [...numeric].map(([key, count]) => ({
        key,
        label: key,
        count,
        mean: null,
        min: null,
        max: null,
        stddev: null,
      })),
      text_variables: [...text].map(([key, count]) => ({ key, label: key, count })),
    }
    return derived.stats
  }
)

const valuesFromFixture = vi.hoisted(
  () => (field: string | null) => {
    if (!field) return new Map<string, number | string>()
    const cached = derived.values.get(field)
    if (cached) return cached
    const values = new Map<string, number | string>(
      mocks.points
        .filter((point) => point[field] != null)
        .map((point) => [point.id as string, point[field] as number | string])
    )
    derived.values.set(field, values)
    return values
  }
)

/** Reemplaza el fixture e invalida los derivados. Usar siempre en vez de asignar. */
const setPoints = vi.hoisted(
  () => (points: Array<Record<string, unknown>>) => {
    mocks.points = points
    derived.geoms = null
    derived.values.clear()
    derived.stats = null
  }
)

vi.mock('react-map-gl/maplibre', async () => {
  const { forwardRef } = await import('react')
  return {
    default: forwardRef<
      unknown,
      {
        children?: React.ReactNode
        cooperativeGestures?: boolean
        onClick?: (event: unknown) => void
        onMouseMove?: (event: unknown) => void
        onMouseLeave?: () => void
      }
    >(({ children, cooperativeGestures, onClick, onMouseMove, onMouseLeave }, _ref) => (
      <div
        data-testid="mock-map"
        data-cooperative-gestures={String(cooperativeGestures)}
        onClick={() =>
          onClick?.({
            features: [
              {
                geometry: { type: 'Point', coordinates: [-101, 20] },
                properties: { id: 'point-1', value: 900, bucket: 'band-6' },
              },
            ],
          })
        }
        onMouseMove={() =>
          onMouseMove?.({
            features: [
              {
                geometry: { type: 'Point', coordinates: [-101, 20] },
                properties: { id: 'point-1', value: 900, bucket: 'band-6' },
              },
            ],
          })
        }
        onMouseLeave={onMouseLeave}
      >
        {children}
      </div>
    )),
    Source: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    Layer: ({
      id,
      paint,
      filter,
    }: {
      id: string
      paint?: Record<string, unknown>
      filter?: unknown
    }) => (
      <div
        data-testid={`layer-${id}`}
        data-paint={JSON.stringify(paint ?? {})}
        data-filter={JSON.stringify(filter ?? null)}
      />
    ),
    Popup: ({
      children,
      closeButton,
      offset,
      style,
    }: {
      children?: React.ReactNode
      closeButton?: boolean
      offset?: number
      style?: React.CSSProperties
    }) => (
      <div
        data-testid="mock-popup"
        data-close-button={String(closeButton)}
        data-offset={String(offset)}
        data-pointer-events={style?.pointerEvents}
      >
        {children}
      </div>
    ),
  }
})

/*
 * El Visor carga los puntos en dos partes —geometría por un lado, valores de la
 * capa activa por otro— y pregunta a un tercer endpoint qué capas tienen datos.
 * Los tres mocks se DERIVAN del mismo fixture `mocks.points` para que siga
 * habiendo una sola fuente de verdad en las pruebas: un test que agrega un campo
 * al fixture lo ve aparecer en el combobox y en el mapa, igual que antes.
 */
vi.mock('@/features/task-manager/hooks/useSoilMapPoints', () => ({
  useSoilMapPoints: () => ({ data: geomsFromFixture(), isLoading: false, error: null }),
}))

vi.mock('@/features/task-manager/hooks/useSoilMapLayerValues', () => ({
  useSoilMapLayerValues: (_headerId: string | null, field: string | null) => ({
    data: valuesFromFixture(field),
    isLoading: false,
    error: null,
  }),
}))

// buildLayerCountMap se deja REAL: es el que traduce la respuesta del endpoint a
// "esta capa tiene datos", y mockearlo dejaría sin probar justo esa traducción.
vi.mock('@/features/task-manager/hooks/useSoilMapVariableStats', async (importOriginal) => ({
  ...(await importOriginal<
    typeof import('@/features/task-manager/hooks/useSoilMapVariableStats')
  >()),
  useSoilMapVariableStats: () => ({
    data: mocks.statsLoading ? undefined : (mocks.statsOverride ?? statsFromFixture()),
    isLoading: mocks.statsLoading,
    error: null,
  }),
}))

vi.mock('@/features/task-manager/hooks/usePlotGeometry', () => ({
  usePlotGeometry: () => ({ data: mocks.plot }),
}))

vi.mock('@/features/task-manager/lib/soilMapSurface', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/task-manager/lib/soilMapSurface')>()),
  analyzeSoilSurface: mocks.analyzeSurface,
}))

import { SoilMap } from './SoilMap'

function soilPoint(id: string, offset: number) {
  const coordinates = [
    [-101, 20],
    [-100.999, 20],
    [-101, 20.001],
  ][offset] ?? [-101 + offset * 0.001, 20 + offset * 0.001]
  return {
    id,
    geom: { type: 'Point', coordinates },
    Countrate: 900 + offset,
    pH: 5.5 + offset,
    OM: 1 + offset,
    CEC: 10 + offset,
    Clay: 15 + offset,
    Silt: 30 + offset,
    Sand: 45 + offset,
    Mn: 3 + offset,
    classtexture: ['Arcilloso', 'Franco', 'Arenoso'][offset] ?? 'Arcilloso',
    compfisic: 'Baja compactacion',
    compquim: offset === 0 ? 'Compactacion' : 'Sincompactacion',
  }
}

describe('SoilMap', () => {
  beforeEach(() => {
    setPoints([soilPoint('point-1', 0), soilPoint('point-2', 1), soilPoint('point-3', 2)])
    mocks.plot = {
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-101.01, 19.99],
            [-100.98, 19.99],
            [-100.98, 20.02],
            [-101.01, 20.02],
            [-101.01, 19.99],
          ],
        ],
      },
      properties: { total_area: '20' },
    }
    mocks.statsOverride = null
    mocks.statsLoading = false
    mocks.analyzeSurface.mockReset()
    mocks.analyzeSurface.mockReturnValue(null)
  })

  it('muestra únicamente las capas presentes en el CSV y siete rangos para Countrate', () => {
    render(<SoilMap sessionId="soil-1" plotId={null} sessionsSlot={<div>Sesiones</div>} />)

    const selector = screen.getByRole('combobox', { name: 'Variable del mapa' })
    expect(selector).toHaveValue('countrate')
    expect(screen.getByRole('option', { name: 'pH del suelo' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'MN del suelo' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Límite inferior CC' })).toBeNull()
    expect(screen.queryByRole('option', { name: 'Cap. efi. fert.' })).toBeNull()
    expect(screen.queryByRole('option', { name: 'C de MO' })).toBeNull()
    expect(screen.getAllByRole('checkbox')).toHaveLength(7)
    expect(screen.getByText(/3 muestras válidas/)).toBeInTheDocument()
    expect(screen.getByText(/% de superficie · Countrate/)).toBeInTheDocument()
    expect(screen.getAllByText(/Área total: 20 ha/).length).toBeGreaterThan(0)
  })

  it('incorpora las capas opcionales cuando el CSV sí contiene valores', () => {
    setPoints(
      mocks.points.map((point, index) => ({
        ...point,
        lim_inf_CC: 10 + index,
        Cap_efi_fert: 20 + index,
        C_de_MO: 30 + index,
      }))
    )

    render(<SoilMap sessionId="soil-1" plotId={null} />)

    expect(screen.getByRole('option', { name: 'Límite inferior CC' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Cap. efi. fert.' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'C de MO' })).toBeInTheDocument()
  })

  it('cambia de variable y usa rangos interpolados sin saturar la interfaz con modos', () => {
    render(<SoilMap sessionId="soil-1" plotId={null} />)

    fireEvent.change(screen.getByRole('combobox', { name: 'Variable del mapa' }), {
      target: { value: 'manganese' },
    })
    expect(screen.getByRole('combobox', { name: 'Variable del mapa' })).toHaveValue('manganese')
    expect(screen.getAllByText('MN del suelo')).toHaveLength(2)
    expect(screen.queryByRole('button', { name: 'Superficie' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Rangos' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Muestras' })).toBeNull()
    expect(mocks.analyzeSurface).toHaveBeenLastCalledWith(
      expect.objectContaining({ paletteSize: 7 })
    )
  })

  it('filtra los puntos al desmarcar un rango de la leyenda', () => {
    render(<SoilMap sessionId="soil-1" plotId={null} />)

    fireEvent.click(screen.getAllByRole('checkbox')[0]!)

    const filter = JSON.parse(
      screen.getByTestId('layer-soil-sample-points').dataset.filter ?? 'null'
    )
    expect(filter).toEqual([
      'match',
      ['get', 'bucket'],
      ['band-1', 'band-2', 'band-3', 'band-4', 'band-5', 'band-6'],
      true,
      false,
    ])
    expect(mocks.analyzeSurface).toHaveBeenCalledTimes(1)
  })

  it('renderiza y filtra las clases texturales como categorías', () => {
    render(<SoilMap sessionId="soil-1" plotId={null} />)

    fireEvent.change(screen.getByRole('combobox', { name: 'Variable del mapa' }), {
      target: { value: 'texture_class' },
    })

    expect(screen.getByText('Arcilloso')).toBeInTheDocument()
    expect(screen.getByText('Franco')).toBeInTheDocument()
    expect(screen.getByText('Arenoso')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Superficie' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Rangos' })).toBeNull()
  })

  it('mantiene Ctrl + rueda para hacer zoom, igual que el visor de aspersión', () => {
    render(<SoilMap sessionId="soil-1" plotId={null} />)

    expect(screen.getByTestId('mock-map')).toHaveAttribute('data-cooperative-gestures', 'true')
  })

  it('pinta muestras opacas y sin contorno negro', () => {
    render(<SoilMap sessionId="soil-1" plotId={null} />)

    const paint = JSON.parse(screen.getByTestId('layer-soil-sample-points').dataset.paint ?? '{}')
    expect(paint['circle-opacity']).toBe(1)
    expect(paint['circle-stroke-width']).toBe(0)
    expect(paint['circle-stroke-color']).toBeUndefined()
  })

  it('muestra el valor de una muestra al pasar el cursor', () => {
    render(<SoilMap sessionId="soil-1" plotId={null} />)

    fireEvent.mouseMove(screen.getByTestId('mock-map'))
    expect(screen.getByText('900')).toBeInTheDocument()
    expect(screen.getByText('20.000000, -101.000000')).toBeInTheDocument()
    expect(screen.getByTestId('mock-popup')).toHaveAttribute('data-close-button', 'false')
    expect(screen.getByTestId('mock-popup')).toHaveAttribute('data-offset', '12')
    expect(screen.getByTestId('mock-popup')).toHaveAttribute('data-pointer-events', 'none')
  })

  it('no fija la muestra al hacer clic y oculta el globo al salir del mapa', () => {
    render(<SoilMap sessionId="soil-1" plotId={null} />)

    const map = screen.getByTestId('mock-map')
    fireEvent.mouseMove(map)
    expect(screen.getByTestId('mock-popup')).toBeInTheDocument()

    fireEvent.click(map)
    fireEvent.mouseLeave(map)
    expect(screen.queryByTestId('mock-popup')).toBeNull()
  })

  it('desactiva la interpolación cuando hay menos de tres valores', () => {
    setPoints([soilPoint('point-1', 0), soilPoint('point-2', 1)])

    render(<SoilMap sessionId="soil-1" plotId={null} />)

    expect(mocks.analyzeSurface).not.toHaveBeenCalled()
    expect(screen.getByText(/Se requieren al menos 3 muestras para interpolar/)).toBeInTheDocument()
  })

  it('no inventa un límite ni hectáreas cuando la parcela no tiene geometría', () => {
    mocks.plot = { geometry: null, properties: { total_area: null } }

    render(<SoilMap sessionId="soil-1" plotId="plot-without-geometry" />)

    expect(mocks.analyzeSurface).not.toHaveBeenCalled()
    expect(screen.getAllByText(/Área total: — ha/).length).toBeGreaterThan(0)
    expect(screen.queryByText(/La parcela no tiene geometría/)).toBeNull()
    expect(screen.queryByTestId('layer-soil-plot-line')).toBeNull()
  })

  it('calcula hectáreas por celdas de la superficie, no por cantidad de muestras', () => {
    mocks.analyzeSurface.mockReturnValue({
      min: 899,
      max: 903,
      breaks: [899.5, 900, 900.5, 901, 901.5, 902],
      bucketCellCounts: {
        'band-0': 30,
        'band-1': 20,
        'band-2': 10,
        'band-3': 10,
        'band-4': 10,
        'band-5': 10,
        'band-6': 10,
      },
    } as never)

    render(<SoilMap sessionId="soil-1" plotId={null} sessionsSlot={<div>Sesiones</div>} />)

    expect(screen.getAllByText(/30.0% · 6 ha/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/20.0% · 4 ha/).length).toBeGreaterThan(0)
  })

  it('oculta la capa que el endpoint reporta en cero, aunque los puntos traigan el valor', () => {
    // El catálogo de capas disponibles ya NO se deduce de los puntos: con la
    // precarga por campos esos valores no están en memoria. Manda el endpoint de
    // estadísticas, y este test lo fija desacoplando ambas fuentes a propósito.
    mocks.statsOverride = {
      header_id: 'soil-1',
      points_count: 3,
      variables: [
        { key: 'Countrate', label: 'Countrate', count: 3, mean: null, min: null, max: null, stddev: null },
        { key: 'pH', label: 'pH', count: 0, mean: null, min: null, max: null, stddev: null },
      ],
      text_variables: [],
    }

    render(<SoilMap sessionId="soil-1" plotId={null} />)

    expect(screen.getByRole('option', { name: 'Countrate' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'pH del suelo' })).toBeNull()
  })

  it('incluye las capas categóricas que llegan en text_variables', () => {
    mocks.statsOverride = {
      header_id: 'soil-1',
      points_count: 3,
      variables: [],
      text_variables: [
        { key: 'classtexture', label: 'classtexture', count: 3 },
        { key: 'compfisic', label: 'compfisic', count: 0 },
      ],
    }

    render(<SoilMap sessionId="soil-1" plotId={null} />)

    expect(screen.getByRole('option', { name: 'Clase textural' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Compactación física' })).toBeNull()
  })

  it('deshabilita el selector mientras no sabe qué variables hay', () => {
    // Un desplegable vacío se leería como "esta sesión no tiene variables".
    mocks.statsLoading = true

    render(<SoilMap sessionId="soil-1" plotId={null} />)

    const selector = screen.getByRole('combobox', { name: 'Variable del mapa' })
    expect(selector).toBeDisabled()
    expect(screen.getByRole('option', { name: 'Cargando variables…' })).toBeInTheDocument()
  })
})
