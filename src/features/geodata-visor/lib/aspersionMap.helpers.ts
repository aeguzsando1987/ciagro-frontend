import type { RectangleProps } from '@/features/task-manager/lib/plotRectangles'

// ─── ESRI satellite style — mismo que PlotMiniMap ─────────────────────────────
// Incluye, además de la imagen base, dos capas de referencia de ESRI (carreteras y
// etiquetas/lugares) inicialmente OCULTAS. El modo "Híbrido" simplemente las muestra
// (ver useMapMode): son PNG transparentes que se superponen a la imagen. Todas las capas
// del basemap se definen aquí, así quedan SIEMPRE al fondo (las capas de datos que añade
// react-map-gl se montan encima). Alternar visibilidad no reordena ni remonta nada.
export const ESRI_STYLE = {
  version: 8 as const,
  sources: {
    esri: {
      type: 'raster' as const,
      tiles: [
        'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      ],
      tileSize: 256,
      // maxzoom = último nivel con teselas REALES que pedimos a ESRI. ESRI World Imagery
      // tiene cobertura aérea casi universal hasta z18; pedir z19 en zonas rurales devuelve
      // 404 → mapa en blanco. Con 18, MapLibre hace overzoom (estira la última foto) más
      // allá de 18, así la imagen SIEMPRE está disponible aunque se vea menos nítida.
      maxzoom: 18,
      attribution: '© Esri',
    },
    // Capas de referencia gratuitas y sin API key (PNG transparente).
    'esri-transportation': {
      type: 'raster' as const,
      tiles: [
        'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}',
      ],
      tileSize: 256,
      maxzoom: 18,
    },
    'esri-places': {
      type: 'raster' as const,
      tiles: [
        'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
      ],
      tileSize: 256,
      maxzoom: 18,
    },
  },
  layers: [
    { id: 'esri-base', type: 'raster' as const, source: 'esri' },
    {
      id: 'esri-transportation',
      type: 'raster' as const,
      source: 'esri-transportation',
      layout: { visibility: 'none' as const },
    },
    {
      id: 'esri-places',
      type: 'raster' as const,
      source: 'esri-places',
      layout: { visibility: 'none' as const },
    },
  ],
}

/** Suma `area_ha` por bucket sobre los rectángulos ya clasificados. Función pura (testeable). */
export function sumAreaByBucket(
  fc: GeoJSON.FeatureCollection<GeoJSON.Polygon, RectangleProps & { bucket: string }>,
): Record<string, number> {
  const acc: Record<string, number> = {}
  for (const f of fc.features) {
    const area = f.properties.area_ha
    if (area == null || !Number.isFinite(area)) continue
    const b = f.properties.bucket
    acc[b] = (acc[b] ?? 0) + area
  }
  return acc
}

/**
 * % de área de cada bucket sobre la suma de los buckets indicados (base). Función pura.
 * `keys` acota la base (p. ej. las 5 categorías con meta, excluyendo `sin_meta`), por lo
 * que los porcentajes de esas claves suman ~100%. Si la base es 0, devuelve 0 para todas.
 */
export function areaShareByBucket(
  areaByBucket: Record<string, number>,
  keys: string[],
): Record<string, number> {
  const base = keys.reduce((acc, k) => acc + (areaByBucket[k] ?? 0), 0)
  const out: Record<string, number> = {}
  for (const k of keys) {
    out[k] = base > 0 ? ((areaByBucket[k] ?? 0) / base) * 100 : 0
  }
  return out
}

/** Formatea hectáreas a string es-MX con 2 decimales (null/NaN → '—'). */
export function formatHa(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return value.toLocaleString('es-MX', { maximumFractionDigits: 2 })
}
