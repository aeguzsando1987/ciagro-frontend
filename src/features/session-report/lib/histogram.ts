/**
 * Geometria del histograma de suelo (FASE RS, F3).
 *
 * Espejo de `apps/field_ops/report_charts.py`. Es a proposito: el PDF se dibuja en
 * el backend y la pantalla en el navegador, y si no coinciden el reporte publicado
 * no cuadra con la app en la que se genero. Las constantes y las formulas se
 * mantienen iguales; lo que cambia es que aqui se devuelven DATOS y no una cadena
 * SVG, para que el componente pueda colgarles eventos.
 *
 * Funciones puras: se prueban sin montar React.
 */
import type { SoilHistogram, SoilHistogramBin } from '../hooks/useSoilLayerStats'

export const W = 380
export const H = 260
export const PAD_L = 62
export const PAD_R = 10
export const PAD_T = 26
export const PAD_B = 46
export const FONT = 17
/** Marcas del eje Y. Cinco no caben legibles en este ancho; tres si. */
export const Y_TICKS = 3

/** Un bin con su hectareaje, si el raster ya lo calculo. */
export interface HistogramBinInput extends SoilHistogramBin {
  area_ha?: number | null
}

export interface HistogramBar {
  x: number
  y: number
  width: number
  height: number
  fill: string
  bin: HistogramBinInput
  /** Valor graficado: Ha si las hay, conteo si no. */
  value: number
  index: number
}

export interface HistogramGeometry {
  bars: HistogramBar[]
  /** Una linea por corte. Son `len(breaks)`, NO siete: hay capas de 1 y 8 clases. */
  breakLines: Array<{ x: number; value: number }>
  /** Curva de tendencia sobre los centros de las barras. */
  curve: string
  yTicks: Array<{ y: number; label: string }>
  axisY: number
  lo: number
  hi: number
  /** "Ha" o "Puntos", segun el front haya podido convertir. */
  yLabel: string
}

/** Ha si el raster las produjo; conteo de puntos si no (H9). */
export function barValue(b: HistogramBinInput): number {
  return b.area_ha !== null && b.area_ha !== undefined ? Number(b.area_ha) : Number(b.count ?? 0)
}

function yLabelOf(bins: HistogramBinInput[]): string {
  return bins.some((b) => b.area_ha !== null && b.area_ha !== undefined) ? 'Ha' : 'Puntos'
}

/**
 * Color de la clase en que cae `value`.
 *
 * La paleta va de valor ALTO a BAJO (convencion del catalogo y del visor), asi que
 * el indice se invierte respecto al orden ascendente de los cortes.
 */
export function classColor(value: number, breaks: number[], palette: string[]): string {
  if (palette.length === 0) return '#8ea9c1'
  const ascendente = breaks.findIndex((cut) => value < cut)
  const i = ascendente === -1 ? breaks.length : ascendente
  return palette[Math.max(0, palette.length - 1 - i)]!
}

/**
 * Bezier cubica con tangentes tipo Catmull-Rom sobre los centros de las barras.
 * Unir los puntos con rectas dibujaria el mismo histograma otra vez.
 */
export function smoothPath(points: Array<[number, number]>): string {
  if (points.length < 2) return ''
  const f = (n: number) => n.toFixed(2)
  const d = [`M ${f(points[0]![0])} ${f(points[0]![1])}`]
  for (let i = 0; i < points.length - 1; i++) {
    const [x0, y0] = points[Math.max(i - 1, 0)]!
    const [x1, y1] = points[i]!
    const [x2, y2] = points[i + 1]!
    const [x3, y3] = points[Math.min(i + 2, points.length - 1)]!
    const c1x = x1 + (x2 - x0) / 6
    const c1y = y1 + (y2 - y0) / 6
    const c2x = x2 - (x3 - x1) / 6
    const c2y = y2 - (y3 - y1) / 6
    d.push(`C ${f(c1x)} ${f(c1y)}, ${f(c2x)} ${f(c2y)}, ${f(x2)} ${f(y2)}`)
  }
  return d.join(' ')
}

function fmt(v: number): string {
  return String(Number(v.toPrecision(6)))
}

export function histogramGeometry(
  histogram: SoilHistogram | { bins?: HistogramBinInput[] } | null | undefined,
  breaks: number[] = [],
  palette: string[] = [],
  width = W,
  height = H,
): HistogramGeometry | null {
  const bins = (histogram?.bins ?? []) as HistogramBinInput[]
  if (bins.length === 0) return null

  const values = bins.map(barValue)
  const vmax = Math.max(...values) || 1
  const lo = Number(bins[0]!.lower)
  const hi = Number(bins[bins.length - 1]!.upper)
  // Capa constante: sin rango que repartir, una barra de ancho completo dice "toda
  // la masa esta en un valor". Con la escala normal saldria una linea.
  const constante = hi === lo
  const span = hi - lo || 1

  const plotW = width - PAD_L - PAD_R
  const plotH = height - PAD_T - PAD_B
  const xOf = (v: number) => PAD_L + ((v - lo) / span) * plotW
  const yOf = (v: number) => PAD_T + plotH - (v / vmax) * plotH

  const bars: HistogramBar[] = bins.map((b, index) => {
    const x1 = constante ? PAD_L : xOf(Number(b.lower))
    const x2 = constante ? width - PAD_R : xOf(Number(b.upper))
    const value = values[index]!
    const y = yOf(value)
    const mid = (Number(b.lower) + Number(b.upper)) / 2
    return {
      x: x1,
      y,
      width: Math.max(x2 - x1 - 1, 0.5),
      height: PAD_T + plotH - y,
      fill: classColor(mid, breaks, palette),
      bin: b,
      value,
      index,
    }
  })

  const centers: Array<[number, number]> = bins.map((b, i) => [
    (xOf(Number(b.lower)) + xOf(Number(b.upper))) / 2,
    yOf(values[i]!),
  ])

  return {
    bars,
    breakLines: breaks.map((cut) => ({ x: xOf(cut), value: cut })),
    curve: smoothPath(centers),
    yTicks: Array.from({ length: Y_TICKS }, (_, i) => {
      const v = (vmax * i) / (Y_TICKS - 1)
      return { y: yOf(v), label: fmt(Math.round(v)) }
    }),
    axisY: PAD_T + plotH,
    lo: Number(lo.toFixed(2)),
    hi: Number(hi.toFixed(2)),
    yLabel: yLabelOf(bins),
  }
}
