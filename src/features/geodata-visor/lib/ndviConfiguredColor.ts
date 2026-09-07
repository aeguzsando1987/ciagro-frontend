/**
 * Color NDVI compartido por:
 *
 * - Línea de tiempo
 * - Evaluación / gráfica
 *
 * El objetivo es utilizar la MISMA configuración
 * que ya utiliza NdviMap.
 *
 * Soporta:
 *
 * 1. Estrategia MANUAL:
 *    usa exactamente los rangos y colores
 *    configurados por la organización.
 *
 * 2. Estrategia QUARTILE con colores:
 *    utiliza los colores configurados y genera
 *    los cortes sobre los valores de referencia.
 *
 * 3. Estrategia QUARTILE sin colores:
 *    utiliza la misma rampa continua del mapa.
 */

import {
  readVariableConfig,
  resolveQuartileColors,
} from '../hooks/useNdviVariableConfig'

import {
  quantileBreaks,
} from './ndviInterpolation'

/* =========================================================
   TIPO
   ========================================================= */

export type NdviColorResolver = (
  value: number
) => string

/* =========================================================
   COLOR DE RESPALDO
   ========================================================= */

const FALLBACK_COLOR =
  '#71717a'

/* =========================================================
   MISMA RAMPA CONTINUA DEL MAPA
   ========================================================= */

/**
 * Bajo → Alto
 *
 * rojo
 * naranja
 * verde
 * cian
 * azul
 */
const CONTINUOUS_RAMP = [
  '#d32f2f',
  '#f57c00',
  '#388e3c',
  '#00acc1',
  '#1565c0',
] as const

/* =========================================================
   HEX → RGB
   ========================================================= */

function hexToRgb(
  hex: string
): [number, number, number] {
  const clean =
    hex.replace('#', '')

  return [
    Number.parseInt(
      clean.substring(0, 2),
      16
    ) || 0,

    Number.parseInt(
      clean.substring(2, 4),
      16
    ) || 0,

    Number.parseInt(
      clean.substring(4, 6),
      16
    ) || 0,
  ]
}

/* =========================================================
   RGB → HEX
   ========================================================= */

function rgbToHex(
  red: number,
  green: number,
  blue: number
): string {
  const component = (
    value: number
  ) =>
    Math.max(
      0,
      Math.min(
        255,
        Math.round(value)
      )
    )
      .toString(16)
      .padStart(2, '0')

  return (
    '#' +
    component(red) +
    component(green) +
    component(blue)
  )
}

/* =========================================================
   COLOR DE LA RAMPA CONTINUA
   ========================================================= */

function continuousRampColor(
  fraction: number
): string {
  const safe =
    Math.max(
      0,
      Math.min(
        1,
        fraction
      )
    )

  const position =
    safe *
    (
      CONTINUOUS_RAMP.length -
      1
    )

  const index =
    Math.min(
      CONTINUOUS_RAMP.length - 2,
      Math.floor(position)
    )

  const interpolation =
    position -
    index

  const colorA =
    CONTINUOUS_RAMP[index]

  const colorB =
    CONTINUOUS_RAMP[
      index + 1
    ]

  if (
    !colorA ||
    !colorB
  ) {
    return FALLBACK_COLOR
  }

  const [
    r1,
    g1,
    b1,
  ] = hexToRgb(
    colorA
  )

  const [
    r2,
    g2,
    b2,
  ] = hexToRgb(
    colorB
  )

  return rgbToHex(
    r1 +
      (
        r2 -
        r1
      ) *
        interpolation,

    g1 +
      (
        g2 -
        g1
      ) *
        interpolation,

    b1 +
      (
        b2 -
        b1
      ) *
        interpolation
  )
}

/* =========================================================
   POSICIÓN PERCENTIL
   ========================================================= */

/**
 * Calcula aproximadamente dónde se encuentra
 * un valor dentro de la distribución.
 *
 * Devuelve:
 *
 * 0   = valores bajos
 * 0.5 = valores medios
 * 1   = valores altos
 */
function rankFraction(
  value: number,
  sortedValues: number[]
): number {
  const length =
    sortedValues.length

  if (
    length <= 1
  ) {
    return 0.5
  }

  let low =
    0

  let high =
    length

  while (
    low <
    high
  ) {
    const middle =
      (
        low +
        high
      ) >>
      1

    const current =
      sortedValues[
        middle
      ]

    if (
      current !== undefined &&
      current <
        value
    ) {
      low =
        middle +
        1
    } else {
      high =
        middle
    }
  }

  return (
    low /
    (
      length -
      1
    )
  )
}

/* =========================================================
   COLOR POR CUANTIL
   ========================================================= */

function colorFromQuantile(
  value: number,
  breaks: number[],
  colors: string[]
): string {
  if (
    colors.length === 0
  ) {
    return FALLBACK_COLOR
  }

  if (
    breaks.length <
    colors.length +
      1
  ) {
    return (
      colors[
        Math.floor(
          colors.length /
            2
        )
      ] ??
      FALLBACK_COLOR
    )
  }

  const first =
    breaks[0]

  const last =
    breaks[
      breaks.length -
        1
    ]

  if (
    first !== undefined &&
    value <= first
  ) {
    return (
      colors[0] ??
      FALLBACK_COLOR
    )
  }

  if (
    last !== undefined &&
    value >= last
  ) {
    return (
      colors[
        colors.length -
          1
      ] ??
      FALLBACK_COLOR
    )
  }

  for (
    let index = 0;
    index <
    colors.length;
    index += 1
  ) {
    const min =
      breaks[index]

    const max =
      breaks[
        index + 1
      ]

    if (
      min === undefined ||
      max === undefined
    ) {
      continue
    }

    const isLast =
      index ===
      colors.length -
        1

    const inside =
      value >= min &&
      (
        isLast
          ? value <= max
          : value < max
      )

    if (
      inside
    ) {
      return (
        colors[index] ??
        FALLBACK_COLOR
      )
    }
  }

  return FALLBACK_COLOR
}

/* =========================================================
   CONSTRUCTOR PRINCIPAL
   ========================================================= */

export function buildNdviColorResolver(
  config:
    Record<
      string,
      unknown
    > |
    undefined,

  referenceValues:
    number[]
): NdviColorResolver {

  /**
   * Limpiamos los valores de referencia.
   *
   * NDVI = 0 sigue siendo válido.
   */
  const values =
    referenceValues
      .filter(
        (
          value
        ) =>
          Number.isFinite(
            value
          )
      )
      .slice()
      .sort(
        (
          a,
          b
        ) =>
          a -
          b
      )

  /**
   * Solamente necesitamos la configuración
   * de la variable "ndvi".
   */
  const cfg =
    readVariableConfig(
      config,
      'ndvi'
    )

  /* =====================================================
     MODO MANUAL

     Aquí la coincidencia con el mapa es directa:
     mismo mínimo
     mismo máximo
     mismo color.
     ===================================================== */

  if (
    cfg.strategy ===
      'manual' &&
    cfg.bands &&
    cfg.bands.length >
      0
  ) {
    const bands =
      cfg.bands
        .slice()
        .sort(
          (
            a,
            b
          ) =>
            a.order -
            b.order
        )

    return (
      value: number
    ): string => {

      for (
        const band
        of bands
      ) {
        const lowerOk =
          band.min ===
            null ||
          value >=
            band.min

        const upperOk =
          band.max ===
            null ||
          value <
            band.max

        if (
          lowerOk &&
          upperOk
        ) {
          return (
            band.color ||
            FALLBACK_COLOR
          )
        }
      }

      return FALLBACK_COLOR
    }
  }

  /* =====================================================
     MODO CUARTIL CON COLORES CONFIGURADOS
     ===================================================== */

  if (
    cfg.strategy ===
      'quartile' &&
    cfg.colors &&
    cfg.colors.length >
      0
  ) {
    const numberOfBands =
      Math.max(
        2,
        cfg.n_bands ??
          cfg.colors.length
      )

    const colors =
      resolveQuartileColors(
        cfg,
        numberOfBands
      )

    const breaks =
      quantileBreaks(
        values,
        colors.length
      )

    return (
      value: number
    ): string =>
      colorFromQuantile(
        value,
        breaks,
        colors
      )
  }

  /* =====================================================
     GRADIENTE CONTINUO

     Si no existen colores de cuartiles,
     utilizamos la misma rampa del mapa.
     ===================================================== */

  return (
    value: number
  ): string => {

    if (
      values.length ===
      0
    ) {
      return continuousRampColor(
        0.5
      )
    }

    return continuousRampColor(
      rankFraction(
        value,
        values
      )
    )
  }
}