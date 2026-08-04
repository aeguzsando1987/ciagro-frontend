/**
 * Utilidades de escala para los graficos del visor. Puras y sin React, para poder fijarlas
 * con tests: un eje mal escalado se ve "casi bien" y pasa desapercibido a ojo.
 */

/**
 * Redondea un rango al numero "bonito" mas cercano (1, 2, 5 o 10 por potencia de diez).
 * Es lo que evita ejes con marcas del tipo 1.0975.
 */
function niceNum(range: number, round: boolean): number {
  const exponent = Math.floor(Math.log10(range))
  const fraction = range / Math.pow(10, exponent)
  let nice: number
  if (round) {
    if (fraction < 1.5) nice = 1
    else if (fraction < 3) nice = 2
    else if (fraction < 7) nice = 5
    else nice = 10
  } else {
    if (fraction <= 1) nice = 1
    else if (fraction <= 2) nice = 2
    else if (fraction <= 5) nice = 5
    else nice = 10
  }
  return nice * Math.pow(10, exponent)
}

/**
 * Marcas de un eje que arranca en 0 y llega, como minimo, hasta maxValue.
 *
 * Con una sola marca arriba y otra abajo no se puede estimar cuanto vale una barra a
 * media altura; con marcas intermedias en valores redondos, si. `targetTicks` es una
 * aspiracion, no una promesa: el paso se redondea a un numero legible y eso puede dar una
 * marca mas o menos.
 */
export function niceAxisTicks(
  maxValue: number,
  targetTicks = 4,
): { axisMax: number; ticks: number[] } {
  if (!Number.isFinite(maxValue) || maxValue <= 0) return { axisMax: 0, ticks: [0] }

  const step = niceNum(maxValue / Math.max(1, targetTicks), true)
  const axisMax = Math.ceil(maxValue / step) * step
  const ticks: number[] = []
  // El epsilon evita que el ultimo valor se pierda por el error de coma flotante.
  for (let v = 0; v <= axisMax + step / 2; v += step) {
    ticks.push(Number(v.toFixed(10)))
  }
  return { axisMax, ticks }
}

/** Componente de color 0..1 linealizado, segun la definicion de luminancia de la WCAG. */
function linearize(channel: number): number {
  return channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4)
}

/**
 * Color de texto legible sobre un fondo dado.
 *
 * Los colores de las clases los elige el usuario en el configurador y pueden ser
 * cualquier cosa, desde un verde muy claro hasta un rojo oscuro. Fijar el texto en blanco
 * o en negro dejaria la mitad de los casos ilegibles, asi que se decide por la luminancia
 * del fondo.
 */
export function readableTextColor(hex: string): string {
  const clean = hex.replace('#', '')
  if (clean.length < 6) return '#1f2937'
  const r = parseInt(clean.slice(0, 2), 16) / 255
  const g = parseInt(clean.slice(2, 4), 16) / 255
  const b = parseInt(clean.slice(4, 6), 16) / 255
  if ([r, g, b].some((c) => Number.isNaN(c))) return '#1f2937'

  const luminance = 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b)
  return luminance > 0.45 ? '#1f2937' : '#ffffff'
}
