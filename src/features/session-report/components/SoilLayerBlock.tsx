/**
 * Bloque de capas del reporteador de suelo (FASE RS, F2).
 *
 * Aspersion reporta UNA magnitud con un semaforo fijo; suelo reporta 49 capas
 * independientes. De ahi que este bloque sustituya al semaforo en vez de sumarse:
 * la unidad de analisis es la capa, y se elige.
 *
 * El histograma (D3) entra en RS-14; aqui van los descriptivos, que son la parte
 * que el backend entrega ya calculada.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LoadingState } from '@/components/ui/loading-state'
import { mediaUrl } from '@/lib/api/media'
import {
  useSoilLayerStats,
  isNumericStats,
  type SoilLayerStats,
} from '../hooks/useSoilLayerStats'
import { SoilLayerPicker, useSoilLayerOptions } from './SoilLayerPicker'
import { SoilHistogram } from './SoilHistogram'
import type { SoilFrozenLayer } from '../types'

/** Capa con la que abre el reporte: la misma que el visor (radiacion natural). */
const DEFAULT_LAYER_KEY = 'countrate'

function num(v: number | null | undefined, digits = 2): string {
  if (v === null || v === undefined) return '—'
  return v.toLocaleString('es-MX', { maximumFractionDigits: digits })
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="truncate text-sm font-medium tabular-nums">{value}</dd>
    </div>
  )
}

export function SoilLayerBlock({
  headerId,
  frozenLayers,
  onPrepare,
  preparing,
}: {
  headerId: string
  /** Capas ya preparadas: de ahi salen la captura y la clasificacion. */
  frozenLayers?: Record<string, SoilFrozenLayer>
  /** Prepara una capa que aun no lo esta. Sin esto el bloque es solo lectura. */
  onPrepare?: (layerKey: string) => void
  /** Capa que se esta preparando ahora mismo. */
  preparing?: string | null
}) {
  const [layerKey, setLayerKey] = useState<string | null>(null)
  const { data: stats, isLoading, isError } = useSoilLayerStats(headerId, layerKey)
  const congelada = layerKey ? frozenLayers?.[layerKey] : undefined
  const { layers } = useSoilLayerOptions(headerId)

  // Preparar al ELEGIR: calcular el raster y mostrarlo son el mismo trabajo, asi
  // que pedirle al usuario un paso aparte para ver su propia capa era fricción
  // inventada. Solo se prepara lo que falta; volver a una capa ya lista no cuesta.
  const elegir = useCallback(
    (key: string) => {
      setLayerKey(key)
      if (onPrepare && !frozenLayers?.[key]) onPrepare(key)
    },
    [frozenLayers, onPrepare]
  )

  // Capa de arranque: la misma con la que abre el visor, para que el reporte no
  // empiece en una variable distinta de la que el usuario venia mirando. Si la
  // sesion no la trae, se cae a la primera con datos en vez de dejar el bloque
  // vacio. Solo una vez: despues manda lo que el usuario elija.
  const arrancado = useRef(false)
  useEffect(() => {
    if (arrancado.current || layerKey || layers.length === 0) return
    arrancado.current = true
    elegir(layers.find((l) => l.key === DEFAULT_LAYER_KEY)?.key ?? layers[0]!.key)
  }, [elegir, layerKey, layers])
  // Absoluta: la ruta que guarda el backend es relativa y el front vive en otro
  // origen, asi que sin resolverla la imagen no carga y no avisa.
  const mapaCongelado = mediaUrl(congelada?.image_url)

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Capas del mapeo</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <SoilLayerPicker
          headerId={headerId}
          value={layerKey}
          onChange={elegir}
          preparedLayers={Object.keys(frozenLayers ?? {})}
          disabled={!!preparing}
        />

        {/* Mismo indicador que el visor (GpaLoader via LoadingState): preparar una
            capa es el mismo trabajo que pintarla alla, asi que la espera se ve
            igual y no como si fueran dos cosas distintas. */}
        {preparing && preparing === layerKey && (
          <LoadingState
            compact
            label="Preparando la capa: superficie y mapa. Puede tardar un poco…"
            className="rounded-md border"
          />
        )}

        {layerKey && isLoading && !preparing && (
          <LoadingState compact label="Cargando estadísticos…" />
        )}
        {layerKey && isError && (
          <p className="text-sm text-destructive">No se pudieron cargar los estadísticos.</p>
        )}
        {stats && (
          <LayerStats
            stats={stats}
            mapSrc={mapaCongelado}
            // Los cortes de las clases: sin ellos el histograma del panel no decia
            // donde cae cada clase y el del PDF si. Son los CONGELADOS, no unos
            // nuevos, para que ambos digan lo mismo.
            breaks={congelada?.breaks}
          />
        )}

        {/* La CLASIFICACION, que es el corazon del reporte: el PDF la imprime y el
            reporte del sistema tiene que mostrar lo mismo. Ademas es donde se ve si
            una capa quedo sin superficie, cosa que en el PDF solo se nota al abrirlo. */}
        {stats && (
          <ClassificationTable
            palette={stats.layer.palette}
            classes={congelada?.classes}
            unit={stats.layer.unit}
          />
        )}
      </CardContent>
    </Card>
  )
}

/**
 * Clasificacion de la capa, con las MISMAS dos bases que imprime el PDF.
 *
 * `Muestras` reparte por puntos analizados y `Superficie` por celdas del raster.
 * Con cortes por cuantiles, `Muestras` sale casi pareja por construccion; es
 * `Superficie` la que revela si una clase ocupa mas terreno del que sugieren sus
 * muestras. Por eso van las dos y no una: por separado, la primera parece un error.
 */
function ClassificationTable({
  palette,
  classes,
  unit,
}: {
  palette: string[]
  classes?: SoilFrozenLayer['classes']
  unit: string
}) {
  if (!classes || classes.length === 0) {
    return (
      <p className="border-t pt-3 text-xs text-muted-foreground">
        Esta capa aún no se ha preparado: sus clases se calculan al prepararla para
        publicar.
      </p>
    )
  }
  const porIndice = new Map(classes.map((c) => [c.index, c]))
  const sinSuperficie = classes.every((c) => c.by_area == null)

  return (
    <div className="border-t pt-3">
      <p className="mb-1 text-xs font-medium text-muted-foreground">
        Clasificación ({palette.length} clase{palette.length === 1 ? '' : 's'})
      </p>
      <table className="w-full text-xs">
        <thead className="text-muted-foreground">
          <tr>
            <th className="w-6" />
            <th className="text-left font-normal">Rango{unit ? ` (${unit})` : ''}</th>
            <th className="text-right font-normal" colSpan={2}>Muestras</th>
            <th className="text-right font-normal" colSpan={2}>Superficie</th>
          </tr>
          <tr className="text-[10px]">
            <th colSpan={2} />
            <th className="text-right font-normal">%</th>
            <th className="text-right font-normal">ha</th>
            <th className="text-right font-normal">%</th>
            <th className="text-right font-normal">ha</th>
          </tr>
        </thead>
        <tbody>
          {palette.map((color, i) => {
            const c = porIndice.get(i)
            return (
              <tr key={i} className="border-t border-border/40">
                <td className="py-0.5">
                  <span
                    className="inline-block h-3 w-4 rounded-sm border"
                    style={{ backgroundColor: color }}
                    aria-hidden
                  />
                </td>
                <td className="truncate">{c?.label ?? '—'}</td>
                <td className="text-right tabular-nums">{num(c?.by_points?.pct, 1)}</td>
                <td className="text-right tabular-nums">{num(c?.by_points?.area_ha)}</td>
                <td className="text-right tabular-nums">{num(c?.by_area?.pct, 1)}</td>
                <td className="text-right tabular-nums">{num(c?.by_area?.area_ha)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {sinSuperficie && (
        // Sin esto, la columna vacia parece un error de datos y no lo que es.
        <p className="mt-1 text-xs text-destructive">
          Esta capa se preparó sin el reparto por superficie. Vuelve a prepararla para
          obtenerlo.
        </p>
      )}
    </div>
  )
}

/** Captura congelada de la capa. Se ve aqui para no publicar un mapa que salio mal. */
function LayerMap({ src, label }: { src: string; label: string }) {
  return (
    <figure className="min-w-0">
      <p className="mb-1 text-xs font-medium text-muted-foreground">Mapa de la capa</p>
      <img src={src} alt={`Mapa de ${label}`} className="w-full rounded-md border" />
      <figcaption className="mt-1 text-xs text-muted-foreground">
        Captura congelada: es la que sale en el PDF.
      </figcaption>
    </figure>
  )
}

function LayerStats({
  stats,
  mapSrc,
  breaks,
}: {
  stats: SoilLayerStats
  /** Captura congelada de la capa. `null` mientras no se haya preparado. */
  mapSrc?: string | null
  /** Cortes congelados: `class_count - 1`, nunca siete fijos (H8). */
  breaks?: number[]
}) {
  const unidad = stats.layer.unit ? ` ${stats.layer.unit}` : ''

  // Las categoricas no llevan media ni percentiles: no significan nada sobre una
  // clase textural. Lo informativo es el reparto.
  if (!isNumericStats(stats)) {
    // Mismo criterio que en las numericas: el mapa acompaña al reparto en una fila.
    return (
      <div className="grid gap-4 border-t pt-3 md:grid-cols-2">
        {mapSrc && <LayerMap src={mapSrc} label={stats.layer.label} />}
        <div className="min-w-0 space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            Reparto por clase · {num(stats.count, 0)} muestras
          </p>
          <ul className="space-y-1">
            {stats.values.map((v) => (
              <li key={v.value} className="flex justify-between gap-2 text-sm">
                <span className="truncate">{v.value}</span>
                <span className="tabular-nums text-muted-foreground">{num(v.count, 0)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3 border-t pt-3">
      <dl className="grid grid-cols-3 gap-x-4 gap-y-2">
        <Metric label="Muestras" value={num(stats.count, 0)} />
        <Metric label="Media" value={`${num(stats.mean)}${unidad}`} />
        <Metric label="Mediana" value={`${num(stats.median)}${unidad}`} />
        <Metric label="Mínimo" value={`${num(stats.min)}${unidad}`} />
        <Metric label="Máximo" value={`${num(stats.max)}${unidad}`} />
        <Metric label="Desv. est." value={num(stats.stddev)} />
        <Metric label="P10" value={`${num(stats.p10)}${unidad}`} />
        <Metric label="P90" value={`${num(stats.p90)}${unidad}`} />
        <Metric label="Coef. variación" value={num(stats.cv)} />
      </dl>
      {stats.nulls > 0 && (
        <p className="text-xs text-muted-foreground">
          {num(stats.nulls, 0)} de {num(stats.points_count, 0)} muestras sin valor en esta capa.
        </p>
      )}

      {/* Mapa e histograma EN LA MISMA FILA: son las dos vistas de la misma capa y
          se leen juntas — donde estan los valores altos, y como se reparten. En una
          columna se pierde esa comparacion. Apilan en pantallas angostas. */}
      <div className="grid gap-4 border-t pt-3 md:grid-cols-2">
        {mapSrc && <LayerMap src={mapSrc} label={stats.layer.label} />}

        <div className="min-w-0">
          <p className="mb-1 text-xs font-medium text-muted-foreground">Distribución</p>
          {/* Con los cortes y la paleta el histograma colorea cada barra por su
              clase y marca los limites, igual que en el PDF. Sin capa preparada
              todavia no hay cortes: sale en gris, que es lo honesto. El eje Y va en
              puntos porque el raster reparte por banda, no por bin (H9). */}
          <SoilHistogram
            histogram={stats.histogram}
            breaks={breaks}
            palette={stats.layer.palette}
            unit={stats.layer.unit}
          />
        </div>
      </div>
    </div>
  )
}
