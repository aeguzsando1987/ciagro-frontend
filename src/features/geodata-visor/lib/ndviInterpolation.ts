/**
 * Interpolación de una superficie continua a partir de puntos, en el CLIENTE.
 *
 * Genera una malla sobre el bounding box de la parcela, interpola cada celda desde los
 * puntos (IDW: distancia inversa ponderada, potencia 2), la colorea con una rampa continua
 * y devuelve una imagen (dataURL) + las coordenadas geográficas de sus esquinas para usarla
 * como `image source` en MapLibre. Las celdas fuera del polígono quedan transparentes, de
 * modo que la superficie se recorta exactamente a la parcela.
 *
 * El motor de interpolación (idwValue) está AISLADO: si se quiere Kriging real, se sustituye
 * esa función sin tocar el resto. IDW da el mismo aspecto de gradiente suave y escala a
 * cualquier número de puntos (O(celdas x puntos)); Kriging es O(n^3) y solo conviene con
 * pocos puntos.
 */

export interface InterpPoint {
  lon: number
  lat: number
  value: number
}

export interface InterpolatedImage {
  dataUrl: string
  /** Esquinas [TL, TR, BR, BL] en [lng, lat] para el image source de MapLibre. */
  coordinates: [[number, number], [number, number], [number, number], [number, number]]
  min: number
  max: number
}

// Rampa continua rojo -> naranja -> azul claro -> azul (RdYlBu, bajo -> alto).
const RAMP: [number, number, number][] = [
  [215, 25, 28],   // #d7191c rojo
  [253, 174, 97],  // #fdae61 naranja
  [171, 217, 233], // #abd9e9 azul claro
  [44, 123, 182],  // #2c7bb6 azul
]

function rampColor(t: number): [number, number, number] {
  const clamped = Math.max(0, Math.min(1, t))
  const seg = clamped * (RAMP.length - 1)
  const i = Math.min(RAMP.length - 2, Math.floor(seg))
  const f = seg - i
  const a = RAMP[i]!
  const b = RAMP[i + 1]!
  return [
    Math.round(a[0] + (b[0] - a[0]) * f),
    Math.round(a[1] + (b[1] - a[1]) * f),
    Math.round(a[2] + (b[2] - a[2]) * f),
  ]
}

/** Punto dentro del polígono (ray casting sobre el anillo exterior). */
function pointInRing(x: number, y: number, ring: number[][]): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i]![0]!, yi = ring[i]![1]!
    const xj = ring[j]![0]!, yj = ring[j]![1]!
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi
    if (intersect) inside = !inside
  }
  return inside
}

/** Motor de interpolación (intercambiable). IDW potencia 2. */
function idwValue(x: number, y: number, pts: InterpPoint[], power = 2): number {
  let num = 0
  let den = 0
  for (const p of pts) {
    const dx = x - p.lon
    const dy = y - p.lat
    const d2 = dx * dx + dy * dy
    if (d2 === 0) return p.value // coincide con un punto de muestreo
    const w = 1 / Math.pow(d2, power / 2)
    num += w * p.value
    den += w
  }
  return den === 0 ? NaN : num / den
}

export function buildInterpolatedImage(
  pts: InterpPoint[],
  ring: number[][],
  gridSize = 220,
): InterpolatedImage | null {
  if (pts.length < 3 || ring.length < 3) return null

  const xs = ring.map((c) => c[0]!)
  const ys = ring.map((c) => c[1]!)
  const xmin = Math.min(...xs)
  const xmax = Math.max(...xs)
  const ymin = Math.min(...ys)
  const ymax = Math.max(...ys)
  if (xmax === xmin || ymax === ymin) return null

  const values = pts.map((p) => p.value)
  const vmin = Math.min(...values)
  const vmax = Math.max(...values)
  const range = vmax - vmin || 1

  // Malla con relación de aspecto del bbox.
  const w = gridSize
  const h = Math.max(1, Math.round((gridSize * (ymax - ymin)) / (xmax - xmin)))

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  const img = ctx.createImageData(w, h)

  for (let row = 0; row < h; row++) {
    // row 0 = arriba = ymax.
    const lat = ymax - (row / (h - 1)) * (ymax - ymin)
    for (let col = 0; col < w; col++) {
      const lon = xmin + (col / (w - 1)) * (xmax - xmin)
      const idx = (row * w + col) * 4
      if (!pointInRing(lon, lat, ring)) {
        img.data[idx + 3] = 0 // transparente fuera de la parcela
        continue
      }
      const v = idwValue(lon, lat, pts)
      if (Number.isNaN(v)) {
        img.data[idx + 3] = 0
        continue
      }
      const [r, g, b] = rampColor((v - vmin) / range)
      img.data[idx] = r
      img.data[idx + 1] = g
      img.data[idx + 2] = b
      img.data[idx + 3] = 255
    }
  }

  ctx.putImageData(img, 0, 0)

  return {
    dataUrl: canvas.toDataURL('image/png'),
    coordinates: [
      [xmin, ymax], // top-left
      [xmax, ymax], // top-right
      [xmax, ymin], // bottom-right
      [xmin, ymin], // bottom-left
    ],
    min: vmin,
    max: vmax,
  }
}
