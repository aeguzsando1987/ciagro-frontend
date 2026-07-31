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
import { blurGrid, classTransitionRatio, sampleSpacing } from './ndviInterpolation'

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
