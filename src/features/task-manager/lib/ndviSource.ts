/**
 * Procedencia de una sesion NDVI (GAP-SN-006).
 *
 * POR QUE ESTO EXISTE Y NO ES COSMETICO. Desde la FASE SN hay dos pipelines hermanos que
 * escriben en las MISMAS tablas: el importador CSV del proveedor y la ingesta directa de
 * Sentinel-2. Que el render sea identico para ambos es el objetivo cumplido de esa fase.
 * Ocultar la PROCEDENCIA, en cambio, es un defecto: GAP-SN-001 establece MEDIDO que
 * red_edge, ndre y psri NO son comparables entre las dos fuentes (el "Limite rojo" del
 * proveedor no es B05: sesgo sistematico de -0.0867 con r=0.87, mientras las otras seis
 * variables cierran con r de 0.93 a 0.96). Un agronomo mirando una serie mezclada ve un
 * escalon que parece un evento agronomico y no lo es.
 *
 * Vive aqui y no dentro de un componente porque lo leen el modal de la sesion y el panel de
 * sesiones del visor, y dos redacciones distintas del mismo dato serian peores que ninguna.
 */

export type NdviSource = 'csv' | 'sentinel2'

/** Etiqueta larga, para la ficha del modal. */
export function sourceLabel(source: string | null | undefined): string {
  switch (source) {
    case 'sentinel2':
      return 'Sentinel-2 (satelite)'
    case 'csv':
      return 'CSV del proveedor'
    default:
      return 'Sin registrar'
  }
}

/** Etiqueta corta, para el badge de la cabecera y la lista del visor, donde no cabe la larga. */
export function sourceShortLabel(source: string | null | undefined): string {
  switch (source) {
    case 'sentinel2':
      return 'Sentinel-2'
    case 'csv':
      return 'CSV'
    default:
      return 'Sin origen'
  }
}

export function isSentinel(source: string | null | undefined): boolean {
  return source === 'sentinel2'
}

/** acquisition_meta llega como `unknown` (el backend lo documenta como JSON libre). */
function metaNumber(meta: unknown, key: string): number | null {
  if (!meta || typeof meta !== 'object') return null
  const v = (meta as Record<string, unknown>)[key]
  return typeof v === 'number' ? v : null
}

function metaString(meta: unknown, key: string): string | null {
  if (!meta || typeof meta !== 'object') return null
  const v = (meta as Record<string, unknown>)[key]
  return typeof v === 'string' ? v : null
}

/**
 * Resumen de la pasada para la ficha: plataforma, nubosidad y porcentaje enmascarado.
 * El enmascarado es el dato que dice cuanta de la parcela quedo sin valor util por nubes o
 * sombras; sin el, una sesion con la mitad de los pixeles invalidos se ve igual que una limpia.
 */
export function acquisitionSummary(meta: unknown): string | null {
  const partes: string[] = []
  const platform = metaString(meta, 'platform')
  if (platform) partes.push(platform)

  const cloud = metaNumber(meta, 'cloud_cover')
  if (cloud !== null) {
    partes.push(`${cloud.toLocaleString('es-MX', { maximumFractionDigits: 1 })}% de nubes`)
  }

  const masked = metaNumber(meta, 'masked_pct')
  if (masked !== null) {
    partes.push(`${masked.toLocaleString('es-MX', { maximumFractionDigits: 1 })}% enmascarado`)
  }

  return partes.length > 0 ? partes.join(' · ') : null
}
