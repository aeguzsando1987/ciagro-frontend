/**
 * Del raster del navegador al payload que congela una capa (FASE RS, RS-15).
 *
 * Es el sentido FRONT -> BACK de la costura. Todo lo que hay aqui es TRADUCCION:
 * los cortes, las celdas y las hectareas ya los calculan `soilMapSurface` y
 * `soilMapArea`, que son los del visor. No se recalcula nada — si se recalculara,
 * el PDF podria clasificar distinto que la pantalla, que es H4.
 *
 * Correspondencia de identificadores, que es lo unico no obvio:
 *   visor            `band-{i}`  con i = indice de PALETA (de valor alto a bajo)
 *   backend          `classes[].index` = ese mismo i
 *   PDF              `layer.palette[i]` da el color
 * Romper esa alineacion pintaria la leyenda con los colores corridos.
 */
import {
  buildSoilBucketAreaStats,
  buildSoilRasterAreaStats,
} from '@/features/geodata-visor/lib/soilMapArea'
import type { SoilMapLegendEntry } from '@/features/task-manager/lib/soilMapLayers'
import type { FrozenClass, FreezeLayerPayload } from '../hooks/useFreezeSoilLayer'
import type { SoilHistogram } from '../hooks/useSoilLayerStats'

interface BuildParams {
  layerKey: string
  /** Las categoricas no tienen rangos: sus clases son las categorias del dato. */
  kind?: 'numeric' | 'category'
  /** Bandas de la leyenda, en orden de paleta. Las produce el visor. */
  entries: SoilMapLegendEntry[]
  /** Cortes ascendentes del raster. Deben ser `entries.length - 1` (H8). */
  breaks: number[]
  /** Banda en la que cae cada muestra, como `band-{i}`. */
  sampleBuckets: string[]
  /** Celdas del raster por banda. Ausente en capas categoricas. */
  bucketCellCounts?: Record<string, number> | null
  totalAreaHa: number | null
  histogram?: SoilHistogram | null
  image?: Blob | null
}

/**
 * Payload de una capa, o `null` si los cortes no cuadran con la paleta.
 *
 * Se valida aqui y no solo en el servidor porque a mitad de una publicacion de N
 * capas conviene detectarlo antes de gastar la subida.
 */
export function buildFreezePayload({
  layerKey,
  kind = 'numeric',
  entries,
  breaks,
  sampleBuckets,
  bucketCellCounts,
  totalAreaHa,
  histogram,
  image,
}: BuildParams): FreezeLayerPayload | null {
  if (entries.length === 0) return null
  // Una capa CATEGORICA no lleva cortes: sus clases son las categorias presentes.
  // Contarlas contra la paleta hacia que `texture_class` —3 colores, 3 clases— se
  // rechazara por "no cuadrar con su paleta", que es lo que reporto el dev.
  const cortesEsperados = kind === 'category' ? 0 : Math.max(0, entries.length - 1)
  if (breaks.length !== cortesEsperados) return null

  const bucketKeys = entries.map((e) => e.key)
  const porMuestras = buildSoilBucketAreaStats(bucketKeys, sampleBuckets, totalAreaHa)
  // Sin raster (capa categorica) no hay reparto espacial: se omite `by_area` en
  // vez de rellenarlo con el de muestras, que serian dos columnas iguales
  // fingiendo ser dos medidas distintas.
  const porArea = bucketCellCounts
    ? buildSoilRasterAreaStats(bucketKeys, bucketCellCounts, totalAreaHa)
    : null

  const classes: FrozenClass[] = entries.map((entry, index) => {
    const m = porMuestras[entry.key]
    const a = porArea?.[entry.key]
    return {
      index,
      label: entry.label,
      // El color viaja SOLO en las categoricas: sus clases no corresponden 1:1 con
      // la paleta, asi que el PDF no puede deducirlo por indice como en las
      // numericas. Ahi se sigue leyendo del catalogo (sobrevive a un cambio de
      // paleta), y por eso no se manda.
      ...(kind === 'category' ? { color: entry.color } : {}),
      by_points: {
        count: m?.count ?? 0,
        // El porcentaje SIEMPRE se puede calcular; las hectareas no, si la parcela
        // no tiene superficie conocida. Por eso solo `area_ha` admite null.
        pct: pct(m?.percentage),
        area_ha: redondear(m?.areaHa),
      },
      ...(a ? { by_area: { pct: pct(a.percentage), area_ha: redondear(a.areaHa) } } : {}),
    }
  })

  return {
    layer: layerKey,
    breaks: breaks.map((b) => Number(b)),
    classes,
    ...(histogram?.bins?.length ? { histogram: { bins: histogram.bins } } : {}),
    image: image ?? null,
  }
}

/** Porcentaje a dos decimales. Siempre hay uno, aunque sea 0. */
function pct(v: number | null | undefined): number {
  return Number.isFinite(v) ? Math.round((v as number) * 100) / 100 : 0
}

/** Dos decimales. `null` se conserva: es "no se pudo calcular", no cero. */
function redondear(v: number | null | undefined): number | null {
  if (v === null || v === undefined || !Number.isFinite(v)) return null
  return Math.round(v * 100) / 100
}
