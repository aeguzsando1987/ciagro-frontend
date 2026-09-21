/**
 * Atribucion de procedencia de los datos de un indice vegetativo.
 *
 * Copernicus exige acreditar el origen de los datos de Sentinel. La regla vive aparte del
 * mapa para poder probarla sin montar MapLibre.
 */

/** Texto de atribucion, o null si no corresponde mostrarlo. */
export function copernicusAttribution(
  source: string | null | undefined,
  sessionDate: string | null | undefined,
  acquisitionDatetime?: string | null,
): string | null {
  // Solo satelite: en las sesiones de CSV el dato viene de un proveedor externo y
  // atribuirlo a Copernicus seria falso (ver GAP-SN-001).
  if (source !== 'sentinel2') return null
  const raw = sessionDate ?? acquisitionDatetime
  const year = raw ? String(raw).slice(0, 4) : null
  if (!year || !/^\d{4}$/.test(year)) return null
  return `Datos de Copernicus Sentinel ${year}, procesados a través del catálogo de Sentinel Hub.`
}
