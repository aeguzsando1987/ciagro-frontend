/**
 * Captura del mapa por capa (RS-16).
 *
 * Es la pieza con mas modos de fallo silencioso: el mapa emite `idle` varias veces,
 * el canvas puede devolver una imagen vacia, y si nunca llega a `idle` el usuario
 * se queda esperando sin señal. Cada uno tiene su test.
 */
import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/** Props con las que se monto el SoilMap, para disparar su onIdle desde el test. */
const montado = { props: null as null | Record<string, unknown> }

vi.mock('@/features/geodata-visor/components/SoilMap', () => ({
  SoilMap: (props: Record<string, unknown>) => {
    montado.props = props
    return <div data-testid="soil-map" />
  },
}))

import { SoilLayerCapture } from './SoilLayerCapture'

/** Canvas falso: `toBlob` entrega lo que el test decida. */
function mapaCon(blob: Blob | null, lanza = false) {
  return {
    target: {
      // El componente lo usa para provocar el idle POSTERIOR a la clasificacion.
      triggerRepaint: () => {},
      getCanvas: () => {
        if (lanza) throw new Error('tainted')
        return {
          toBlob: (cb: (b: Blob | null) => void) => cb(blob),
        }
      },
    },
  } as never
}

type CaptureProps = React.ComponentProps<typeof SoilLayerCapture>

function renderCapture(over: Partial<CaptureProps> = {}) {
  const props: CaptureProps = {
    sessionId: 'h1',
    plotId: 'p1',
    layerKey: 'ph',
    onComputed: vi.fn(),
    // Por defecto ya clasificada: los tests que prueban la carrera lo bajan.
    ready: true,
    onCaptured: vi.fn(),
    onError: vi.fn(),
    ...over,
  }
  const utils = render(<SoilLayerCapture {...props} />)
  return { ...utils, props }
}

beforeEach(() => {
  vi.useFakeTimers()
  montado.props = null
})
afterEach(() => vi.useRealTimers())

describe('SoilLayerCapture', () => {
  it('monta el visor real en modo captura, no un mapa aparte', () => {
    // Un mapa nuevo seria una segunda implementacion del pintado y podria
    // clasificar distinto que la pantalla: eso es H4.
    renderCapture()
    expect(screen.getByTestId('soil-map')).toBeTruthy()
    expect(montado.props).toMatchObject({
      activeLayerKey: 'ph',
      locked: true,
      tightFrame: true,
      preserveDrawingBuffer: true,
    })
  })

  /**
   * DEFECTO REAL, hallado por el dev: salia "El mapa no alcanzo a clasificar la capa
   * antes de la captura" y el reporte quedaba sin paginas.
   *
   * `idle` significa "termine de dibujar", NO "ya tengo los datos": el raster corre
   * en un worker, asi que el mapa pinta el satelite vacio y se declara idle mucho
   * antes de tener los cortes. Funcionaba solo en capas ya vistas en el visor, que
   * tienen su raster en cache — de ahi que fallara de forma intermitente.
   *
   * El test anterior disparaba onComputed y luego onCaptured en ESE orden, que es
   * justo el que la realidad no garantiza: probaba la suposicion, no el sistema.
   */
  it('NO captura mientras la capa no esté clasificada', () => {
    const { props } = renderCapture({ ready: false })
    ;(montado.props!.onIdle as (e: never) => void)(mapaCon(new Blob(['a'])))

    expect(props.onCaptured).not.toHaveBeenCalled()
    expect(props.onError).not.toHaveBeenCalled()
  })

  /**
   * SEGUNDO DEFECTO REAL: el PDF salia con el satelite SIN PUNTOS en todas las
   * hojas. El idle previo corresponde al mapa antes de pintar las muestras, asi que
   * capturar ese fotograma —aunque el gate ya estuviera abierto— daba una foto del
   * terreno pelado. Hay que esperar un idle POSTERIOR a la apertura del gate.
   */
  it('NO reusa el idle anterior al gate: esa foto es el mapa sin puntos', () => {
    const onCaptured = vi.fn()
    const { rerender } = renderCapture({ ready: false, onCaptured })
    ;(montado.props!.onIdle as (e: never) => void)(mapaCon(new Blob(['sin-puntos'])))
    expect(onCaptured).not.toHaveBeenCalled()

    rerender(
      <SoilLayerCapture
        sessionId="h1" plotId="p1" layerKey="ph" ready
        onComputed={vi.fn()} onCaptured={onCaptured} onError={vi.fn()}
      />
    )
    // Abrir el gate no basta: todavia no hay foto buena que tomar.
    expect(onCaptured).not.toHaveBeenCalled()

    // El repintado provoca el idle siguiente, ya con los puntos dibujados.
    ;(montado.props!.onIdle as (e: never) => void)(mapaCon(new Blob(['con-puntos'])))
    expect(onCaptured).toHaveBeenCalledTimes(1)
  })

  it('captura en el primer idle y no repite en los siguientes', () => {
    // El mapa emite `idle` al cargar tiles y al reencuadrar: sin guard se subiria
    // la misma imagen N veces.
    const { props } = renderCapture()
    const onIdle = montado.props!.onIdle as (e: never) => void

    onIdle(mapaCon(new Blob(['a'])))
    onIdle(mapaCon(new Blob(['b'])))

    expect(props.onCaptured).toHaveBeenCalledTimes(1)
  })

  it('un canvas vacío se reporta como error, no como captura', () => {
    const { props } = renderCapture()
    ;(montado.props!.onIdle as (e: never) => void)(mapaCon(null))

    expect(props.onCaptured).not.toHaveBeenCalled()
    expect(props.onError).toHaveBeenCalledWith(expect.stringMatching(/vacía/))
  })

  it('un canvas bloqueado por CORS da un mensaje claro', () => {
    // Si los tiles se sirvieran sin CORS, leer el canvas lanza SecurityError.
    const { props } = renderCapture()
    ;(montado.props!.onIdle as (e: never) => void)(mapaCon(null, true))

    expect(props.onError).toHaveBeenCalledWith(expect.stringMatching(/seguridad del navegador/))
  })

  it('si el mapa nunca renderiza avisa en vez de dejar esperando', () => {
    const { props } = renderCapture()
    vi.advanceTimersByTime(60_000)

    expect(props.onError).toHaveBeenCalledWith(
      expect.stringMatching(/tardó demasiado en clasificarse/)
    )
  })

  it('el tiempo de espera no dispara si ya se capturó', () => {
    const { props } = renderCapture()
    ;(montado.props!.onIdle as (e: never) => void)(mapaCon(new Blob(['a'])))
    vi.advanceTimersByTime(60_000)

    expect(props.onError).not.toHaveBeenCalled()
  })

  it('cambiar de capa reinicia el guard: si no, solo se capturaría la primera', () => {
    const onCaptured = vi.fn()
    const { rerender } = renderCapture({ onCaptured })
    ;(montado.props!.onIdle as (e: never) => void)(mapaCon(new Blob(['ph'])))

    rerender(
      <SoilLayerCapture
        sessionId="h1"
        plotId="p1"
        layerKey="clay"
        ready
        onComputed={vi.fn()}
        onCaptured={onCaptured}
        onError={vi.fn()}
      />
    )
    ;(montado.props!.onIdle as (e: never) => void)(mapaCon(new Blob(['clay'])))

    expect(onCaptured).toHaveBeenCalledTimes(2)
  })
})
