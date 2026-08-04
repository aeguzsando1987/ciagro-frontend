/**
 * Suavizado del campo interpolado: la corrección del efecto "bulletshot".
 *
 * Medido sobre la sesión NDVI real de desarrollo (1024 puntos en 9.50 ha, malla regular
 * de ~9.5 m tipo Sentinel-2): la diferencia media entre vecinos es 0.0313, mientras que
 * la banda superior por cuartiles mide apenas 0.0247 de ancho. Como el ruido supera al
 * ancho de banda, celdas contiguas cruzan la frontera de clase sin parar y la mancha se
 * rompe en islas (en el backend esa banda salió en 243 polígonos sobre 0.27 ha).
 *
 * Interpoladores EXACTOS —IDW, y el kriging del cliente cuando el nugget ajustado es
 * bajo— reproducen ese ruido, así que el arreglo no está en el motor sino en suavizar el
 * campo a la escala del muestreo. Estos tests lo verifican con una métrica, no a ojo.
 */
import { describe, it, expect } from 'vitest'
import {
  blurGrid,
  buildValueGrid,
  classTransitionRatio,
  sampleSpacing,
  ABSOLUTE_BANDS_SMOOTHING_FACTOR,
  DEFAULT_SMOOTHING_FACTOR,
  type InterpPoint,
} from './ndviInterpolation'

const W = 64
const H = 64

/** Generador determinista: los tests no deben depender de Math.random. */
function makeRng(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

/**
 * Campo realista: rampa suave (la señal agronómica) + ruido de la amplitud medida en los
 * datos reales. Los valores caen en el rango observado (~0.36 a ~0.83).
 */
function noisyField(noiseAmplitude: number): Float32Array {
  const rnd = makeRng(42)
  const g = new Float32Array(W * H)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const signal = 0.45 + 0.35 * ((x + y) / (W + H - 2))
      g[y * W + x] = signal + (rnd() - 0.5) * 2 * noiseAmplitude
    }
  }
  return g
}

/** Clases por umbrales fijos, como las bandas de la config. */
function classifier(breaks: number[]) {
  return (v: number) => {
    let c = 0
    for (const b of breaks) if (v >= b) c++
    return c
  }
}

describe('sampleSpacing', () => {
  it('recupera la separacion real de la sesion de desarrollo', () => {
    // 9.50 ha = 95 000 m2 repartidas en 1024 puntos -> ~9.6 m, y lo medido en PostGIS
    // sobre los datos reales fue 9.49 m.
    const lado = Math.sqrt(95_000)
    expect(sampleSpacing(lado, lado, 1024)).toBeCloseTo(9.6, 1)
  })

  it('devuelve 0 con datos degenerados', () => {
    expect(sampleSpacing(0, 10, 100)).toBe(0)
    expect(sampleSpacing(10, 10, 1)).toBe(0)
  })
})

describe('blurGrid', () => {
  it('reduce drasticamente el moteado con bandas mas estrechas que el ruido', () => {
    // Bandas de 0.025 (como Q4 real) contra ruido de 0.03: el caso que rompe la mancha.
    const field = noisyField(0.03)
    const cls = classifier([0.55, 0.575, 0.6, 0.625, 0.65])

    const antes = classTransitionRatio(field, W, H, cls)
    const despues = classTransitionRatio(blurGrid(field, W, H, 3), W, H, cls)

    expect(antes).toBeGreaterThan(0.3)
    // El campo suavizado solo debe cambiar de clase en las fronteras reales.
    expect(despues).toBeLessThan(antes / 4)
  })

  it('conserva la señal: la rampa sigue yendo de menor a mayor', () => {
    const field = noisyField(0.03)
    const suave = blurGrid(field, W, H, 3)

    // Esquina inferior-izquierda (señal baja) vs superior-derecha (señal alta).
    expect(suave[0]!).toBeLessThan(suave[W * H - 1]!)
    // Y no desplaza el nivel global: la media se mantiene.
    const media = (g: Float32Array) => g.reduce((a, b) => a + b, 0) / g.length
    expect(media(suave)).toBeCloseTo(media(field), 2)
  })

  it('ignora las celdas fuera del area (NaN) sin contaminar a las vecinas', () => {
    const g = new Float32Array(W * H).fill(0.5)
    for (let y = 0; y < H; y++) g[y * W] = NaN // primera columna fuera del casco

    const suave = blurGrid(g, W, H, 2)

    expect(Number.isNaN(suave[0]!)).toBe(false) // el promedio ignora los NaN vecinos
    expect(suave[W * 3 + 10]!).toBeCloseTo(0.5, 5) // el interior no se altera
  })

  it('no hace nada con radio menor a una celda', () => {
    const field = noisyField(0.03)
    expect(blurGrid(field, W, H, 0.4)).toBe(field)
  })
})

/**
 * Nube sintetica con la forma de la sesion real: malla regular de 32x32 muestras sobre
 * ~0.0027 x 0.0038 grados, senal suave que recorre el rango observado (~0.36 a ~0.83) y
 * ruido de la amplitud medida entre vecinos (0.031).
 */
function syntheticSession(): InterpPoint[] {
  const rnd = makeRng(2026)
  const pts: InterpPoint[] = []
  const N = 32
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      const fx = i / (N - 1)
      const fy = j / (N - 1)
      const signal = 0.38 + 0.44 * (0.6 * fx + 0.4 * (1 - (fy - 0.5) * (fy - 0.5) * 4))
      pts.push({
        lon: -100.8336 + fx * 0.00265,
        lat: 20.5773 + fy * 0.00377,
        value: signal + (rnd() - 0.5) * 2 * 0.031,
      })
    }
  }
  return pts
}

/** Bandas absolutas de 0.1 de ancho, como las que configura el usuario a mano. */
const ABS_EDGES = [0.02, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1]
function absBand(v: number): number {
  for (let i = 0; i < ABS_EDGES.length - 1; i++) {
    if (v >= ABS_EDGES[i]! && v < ABS_EDGES[i + 1]!) return i
  }
  return -1
}

/**
 * Fidelidad de la superficie frente a umbrales ABSOLUTOS.
 *
 * El IDW con potencia baja convertia cada celda en un promedio de toda la nube: la
 * superficie tendia a la media global, el rango se aplastaba y con bandas manuales el
 * mapa pintaba el color equivocado (un punto de 0.534 caia en una mancha de 0.6-0.7) y
 * dejaba de mostrar la mayoria de las clases. En modo cuartiles el fallo pasaba
 * inadvertido porque los cortes se recalculan desde la propia superficie aplastada.
 */
describe('fidelidad con umbrales absolutos', () => {
  const pts = syntheticSession()
  const valores = pts.map((p) => p.value)
  const amplitudPuntos = Math.max(...valores) - Math.min(...valores)

  function surface(smoothing: number) {
    const f = buildValueGrid(pts, 'idw', 200, smoothing)
    if (!f) throw new Error('sin superficie')
    return f
  }

  it('conserva el rango de valores de los puntos', () => {
    const { grid } = surface(ABSOLUTE_BANDS_SMOOTHING_FACTOR)
    let min = Infinity
    let max = -Infinity
    for (let i = 0; i < grid.length; i++) {
      const v = grid[i]!
      if (!Number.isNaN(v)) { min = Math.min(min, v); max = Math.max(max, v) }
    }
    // En la sesion real (nube mas irregular) la potencia 1.2 dejaba la amplitud en ~55%
    // de la de los puntos. Esta nube sintetica es mas suave y ahi el aplastamiento es
    // menor, asi que quien delata la regresion son los tres tests siguientes.
    expect(max - min).toBeGreaterThan(amplitudPuntos * 0.85)
  })

  it('pinta a cada punto con el color de su propio valor', () => {
    const f = surface(ABSOLUTE_BANDS_SMOOTHING_FACTOR)
    let aciertos = 0
    for (const p of pts) {
      const col = Math.round(((p.lon - f.xmin) / (f.xmax - f.xmin)) * (f.w - 1))
      const row = Math.round(((f.ymax - p.lat) / (f.ymax - f.ymin)) * (f.h - 1))
      const v = f.grid[row * f.w + col]
      if (v !== undefined && !Number.isNaN(v) && absBand(v) === absBand(p.value)) aciertos++
    }
    // Con potencia 1.2 y suavizado esto caia por debajo del 50%.
    expect(aciertos / pts.length).toBeGreaterThan(0.9)
  })

  it('no hace desaparecer del mapa las clases con peso real', () => {
    const { grid } = surface(ABSOLUTE_BANDS_SMOOTHING_FACTOR)
    const areaPorClase = new Array(ABS_EDGES.length - 1).fill(0)
    let pintadas = 0
    for (let i = 0; i < grid.length; i++) {
      const v = grid[i]!
      if (Number.isNaN(v)) continue
      pintadas++
      const c = absBand(v)
      if (c >= 0) areaPorClase[c]++
    }
    const puntosPorClase = new Array(ABS_EDGES.length - 1).fill(0)
    for (const p of pts) { const c = absBand(p.value); if (c >= 0) puntosPorClase[c]++ }

    // Toda clase que agrupe al menos el 5% de los puntos debe verse en el mapa.
    for (let c = 0; c < puntosPorClase.length; c++) {
      if (puntosPorClase[c] / pts.length >= 0.05) {
        expect(areaPorClase[c] / pintadas).toBeGreaterThan(0.01)
      }
    }
  })

  it('el suavizado desplaza el valor, por eso se anula con bandas absolutas', () => {
    const sin = surface(ABSOLUTE_BANDS_SMOOTHING_FACTOR)
    const con = surface(DEFAULT_SMOOTHING_FACTOR)
    const desvio = (f: ReturnType<typeof surface>) => {
      let max = 0
      for (const p of pts) {
        const col = Math.round(((p.lon - f.xmin) / (f.xmax - f.xmin)) * (f.w - 1))
        const row = Math.round(((f.ymax - p.lat) / (f.ymax - f.ymin)) * (f.h - 1))
        const v = f.grid[row * f.w + col]
        if (v !== undefined && !Number.isNaN(v)) max = Math.max(max, Math.abs(v - p.value))
      }
      return max
    }
    // Sin suavizar la superficie pasa por los datos; suavizada se aleja lo bastante
    // como para cruzar una banda de 0.1.
    expect(desvio(sin)).toBeLessThan(0.02)
    expect(desvio(con)).toBeGreaterThan(desvio(sin))
    expect(ABSOLUTE_BANDS_SMOOTHING_FACTOR).toBe(0)
  })

  it('el moteado se mantiene bajo aunque no se suavice', () => {
    const { grid, w, h } = surface(ABSOLUTE_BANDS_SMOOTHING_FACTOR)
    // Con bandas de 0.1 (mas del triple del ruido) el moteado que motivo el blur no
    // aparece: en la sesion real fueron 4.23% de celdas contiguas cambiando de clase,
    // frente al 11.72% historico que lo justifico.
    expect(classTransitionRatio(grid, w, h, absBand)).toBeLessThan(0.08)
  })
})

describe('classTransitionRatio', () => {
  it('es 0 en un campo de una sola clase y alto en uno moteado', () => {
    const plano = new Float32Array(W * H).fill(0.5)
    const cls = classifier([0.4, 0.6])
    expect(classTransitionRatio(plano, W, H, cls)).toBe(0)

    const rnd = makeRng(7)
    const ruido = new Float32Array(W * H)
    for (let i = 0; i < ruido.length; i++) ruido[i] = rnd()
    expect(classTransitionRatio(ruido, W, H, cls)).toBeGreaterThan(0.4)
  })
})
