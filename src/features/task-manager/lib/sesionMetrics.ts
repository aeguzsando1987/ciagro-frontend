/**
 * Seleccion de titulares para las tarjetas informativas de una sesion.
 *
 * El modal de Rendimiento muestra cuatro tarjetas con las cifras que resumen la sesion. Los
 * demas tipos tenian el dato pero no la tarjeta: aspersion y NDVI lo enterraban en una tabla
 * de medias, minimos, maximos y desviaciones, y mapeo de suelo no mostraba NADA pese a tener
 * su endpoint de estadisticas desde la FASE SL (lo consumian solo el Visor y el reporteador).
 *
 * El problema no es de formato sino de CANTIDAD: el backend devuelve 5 variables en aspersion,
 * 15 indices en NDVI y 50 capas en suelo. Una rejilla de 50 tarjetas no es un resumen. Por eso
 * cada tipo declara sus titulares, y si alguno no trae datos se rellena con las variables que
 * si los tengan, para que la rejilla nunca salga vacia o coja.
 */

export interface VariableLike {
  key: string
  label: string
  count: number
  mean: number | null
}

export interface HeadlineMetric {
  key: string
  label: string
  value: string
}

/** Tipos de sesion que resumen variables numericas via /variable-stats/. */
export type MetricSesionType = 'aspersion' | 'ndvi' | 'soil_map'

/**
 * Titulares por tipo, en orden de importancia.
 *
 * - aspersion: las que describen la aplicacion en si. El backend ya cura cinco en
 *   ASPERSION_SUMMARY_FIELDS; se toman las cuatro de operacion y la quinta (producto
 *   aplicado) queda en la tabla de detalle.
 * - ndvi: los cuatro indices que se leen primero de una imagen; los once restantes
 *   siguen en la tabla.
 * - soil_map: los cuatro de un analisis de suelo basico. NINGUNO esta garantizado,
 *   porque depende de que columnas traiga el CSV del proveedor; de ahi el relleno.
 */
export const HEADLINE_KEYS: Record<MetricSesionType, readonly string[]> = {
  aspersion: ['speed_kmh', 'liquid_flow_ls', 'boom_pressure_bar', 'applied_rate_l'],
  ndvi: ['ndvi', 'ndre', 'osavi', 'vari'],
  soil_map: ['pH', 'OM', 'CEC', 'Cond'],
}

/**
 * Decimales por tipo. NDVI necesita tres: los indices vegetativos se mueven en rangos
 * estrechos (NDRE varia ~0.27 de punta a punta) y con dos varias tarjetas saldrian iguales.
 * Es el mismo criterio que ya aplicaba NdviImportSummary a su tabla.
 */
export const METRIC_DIGITS: Record<MetricSesionType, number> = {
  aspersion: 2,
  ndvi: 3,
  soil_map: 2,
}

/** Una variable sirve de titular solo si tiene puntos Y una media que mostrar. */
function hasData(variable: VariableLike): boolean {
  return variable.count > 0 && variable.mean !== null
}

export function formatMetricMean(mean: number | null, digits: number): string {
  if (mean === null || !Number.isFinite(mean)) return '—'
  return mean.toLocaleString('es-MX', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

/**
 * Titulares a mostrar: primero los declarados para el tipo que tengan datos, y si faltan,
 * las primeras variables con datos que no se hayan usado ya. Devuelve como mucho `max`.
 *
 * El relleno importa sobre todo en suelo: un CSV sin pH ni materia organica dejaria la
 * rejilla vacia aunque la sesion tenga 40 capas cargadas, y el usuario leeria "sin datos"
 * donde hay de sobra.
 */
export function pickHeadlineMetrics(
  variables: VariableLike[] | undefined,
  type: MetricSesionType,
  max = 4
): HeadlineMetric[] {
  if (!variables?.length) return []

  const digits = METRIC_DIGITS[type]
  const byKey = new Map(variables.map((v) => [v.key, v]))
  const elegidas: VariableLike[] = []

  for (const key of HEADLINE_KEYS[type]) {
    const variable = byKey.get(key)
    if (variable && hasData(variable)) elegidas.push(variable)
    if (elegidas.length === max) break
  }

  if (elegidas.length < max) {
    const yaElegidas = new Set(elegidas.map((v) => v.key))
    for (const variable of variables) {
      if (yaElegidas.has(variable.key) || !hasData(variable)) continue
      elegidas.push(variable)
      if (elegidas.length === max) break
    }
  }

  return elegidas.map((variable) => ({
    key: variable.key,
    label: variable.label,
    value: formatMetricMean(variable.mean, digits),
  }))
}
