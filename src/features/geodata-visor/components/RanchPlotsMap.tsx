/**
 * Mapa de los polígonos de las parcelas de un rancho (use case §2.3.2.3-2.3.2.4).
 *
 * Dibuja todas las parcelas de un rancho como una sola Source GeoJSON + capas fill/line
 * (no un componente por parcela). Al hacer clic sobre un polígono se selecciona esa
 * parcela (queryRenderedFeatures vía interactiveLayerIds). Enfoca el grupo completo de
 * parcelas; si hay una seleccionada, enfoca su bbox y la resalta. Solo lectura.
 */
import { useEffect, useMemo, useRef } from 'react'
import Map, { Layer, Marker, Source } from 'react-map-gl/maplibre'
import type { MapRef } from 'react-map-gl/maplibre'
import { ArrowLeft } from 'lucide-react'
import { MapModeSelector } from './MapModeSelector'
import { useMapMode } from '../lib/mapModes'
import { ESRI_STYLE } from '../lib/aspersionMap.helpers'
import type { PlotFlat } from '@/features/admin/types'

type Bounds = [number, number, number, number]

/** Centroide de una parcela: usa el `centroid` del backend o promedia el anillo exterior. */
function plotCentroid(plot: PlotFlat): [number, number] | null {
  const c = (plot.centroid as { coordinates?: number[] } | null | undefined)?.coordinates
  if (c && c.length >= 2) return [c[0]!, c[1]!]
  const ring = (plot.geom as { coordinates?: number[][][] } | null)?.coordinates?.[0]
  if (!ring || ring.length === 0) return null
  let sx = 0, sy = 0
  for (const [x, y] of ring as number[][]) { sx += x!; sy += y! }
  return [sx / ring.length, sy / ring.length]
}

/** bbox de una geometría Polygon/MultiPolygon. */
function bboxOfGeometry(geom: PlotFlat['geom'], acc: { minX: number; minY: number; maxX: number; maxY: number }) {
  if (!geom) return
  // Polygon: number[][][] ; MultiPolygon: number[][][][]. Aplanamos posiciones.
  const walk = (arr: unknown) => {
    if (!Array.isArray(arr)) return
    if (typeof arr[0] === 'number') {
      const [x, y] = arr as number[]
      if (x == null || y == null) return
      acc.minX = Math.min(acc.minX, x); acc.maxX = Math.max(acc.maxX, x)
      acc.minY = Math.min(acc.minY, y); acc.maxY = Math.max(acc.maxY, y)
      return
    }
    for (const el of arr) walk(el)
  }
  walk((geom as { coordinates?: unknown }).coordinates)
}

function boundsOf(plots: PlotFlat[], onlyId?: string | null): Bounds | null {
  const acc = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
  for (const p of plots) {
    if (onlyId && p.id !== onlyId) continue
    bboxOfGeometry(p.geom, acc)
  }
  if (!Number.isFinite(acc.minX)) return null
  return [acc.minX, acc.minY, acc.maxX, acc.maxY]
}

interface RanchPlotsMapProps {
  plots: PlotFlat[]
  selectedPlotId: string | null
  onSelectPlot: (plot: { id: string; name: string }) => void
  /** Para la tarjeta flotante de contexto (mismo productor/rancho para todo el mapa). */
  producerName?: string
  ranchName?: string
  /** Si se provee, la línea del rancho es clickeable y vuelve a la vista del rancho
   *  (deselecciona la parcela). */
  onBackToRanch?: () => void
  /** Si se provee, la línea del productor es clickeable y vuelve a la vista del productor
   *  (mapa de pines de ranchos). */
  onBackToProducer?: () => void
}

export function RanchPlotsMap({ plots, selectedPlotId, onSelectPlot, producerName, ranchName, onBackToRanch, onBackToProducer }: RanchPlotsMapProps) {
  const mapRef = useRef<MapRef>(null)
  const { mapMode, setMapMode } = useMapMode(mapRef)

  // Etiqueta semitransparente por parcela, anclada en su centroide.
  const labels = useMemo(
    () =>
      plots
        .map((p) => ({ plot: p, center: plotCentroid(p) }))
        .filter((l): l is { plot: PlotFlat; center: [number, number] } => l.center !== null),
    [plots],
  )

  const fc = useMemo<GeoJSON.FeatureCollection>(() => ({
    type: 'FeatureCollection',
    features: plots
      .filter((p) => p.geom)
      .map((p) => ({
        type: 'Feature',
        geometry: p.geom as GeoJSON.Geometry,
        properties: { id: p.id, code: p.code ?? '' },
      })),
  }), [plots])

  // Enfoque: si hay parcela seleccionada → su bbox; si no → el grupo completo.
  const bounds = useMemo(
    () => boundsOf(plots, selectedPlotId) ?? boundsOf(plots),
    [plots, selectedPlotId],
  )

  // Centro del grupo de parcelas → ancla del pin del rancho.
  const ranchCenter = useMemo<[number, number] | null>(() => {
    const b = boundsOf(plots)
    if (!b) return null
    return [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2]
  }, [plots])

  useEffect(() => {
    if (!mapRef.current || !bounds) return
    mapRef.current.fitBounds(bounds, { padding: 60, duration: 600, maxZoom: 17 })
  }, [bounds])

  const hasGeom = fc.features.length > 0

  return (
    <div className="relative h-full w-full">
      {!hasGeom && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 text-sm text-muted-foreground">
          Las parcelas de este rancho no tienen geometría cargada.
        </div>
      )}
      <Map
        ref={mapRef}
        initialViewState={
          bounds
            ? { bounds, fitBoundsOptions: { padding: 60, maxZoom: 17 } }
            : { longitude: -101, latitude: 20.5, zoom: 6 }
        }
        maxZoom={20}
        mapStyle={ESRI_STYLE}
        cooperativeGestures
        interactiveLayerIds={hasGeom ? ['plots-fill'] : []}
        attributionControl={false}
        style={{ width: '100%', height: '100%' }}
        cursor="pointer"
        onClick={(e) => {
          const f = e.features?.[0]
          if (!f) return
          const id = (f.properties?.id as string) ?? null
          const plot = plots.find((p) => p.id === id)
          if (plot) onSelectPlot({ id: plot.id, name: plot.code ?? plot.id.slice(0, 8) })
        }}
      >
        {hasGeom && (
          <Source id="ranch-plots" type="geojson" data={fc}>
            {/* Relleno base de todas las parcelas */}
            <Layer
              id="plots-fill"
              type="fill"
              paint={{
                'fill-color': '#22c55e',
                'fill-opacity': [
                  'case',
                  ['==', ['get', 'id'], selectedPlotId ?? ''],
                  0.45,
                  0.18,
                ] as unknown as number,
              }}
            />
            {/* Contorno; resalta la parcela seleccionada */}
            <Layer
              id="plots-line"
              type="line"
              paint={{
                'line-color': [
                  'case',
                  ['==', ['get', 'id'], selectedPlotId ?? ''],
                  '#15803d',
                  '#16a34a',
                ] as unknown as string,
                'line-width': [
                  'case',
                  ['==', ['get', 'id'], selectedPlotId ?? ''],
                  3,
                  1.5,
                ] as unknown as number,
              }}
            />
          </Source>
        )}

        {/* Pin del rancho: visible solo a nivel rancho (sin parcela seleccionada). */}
        {!selectedPlotId && ranchName && ranchCenter && (
          <Marker longitude={ranchCenter[0]} latitude={ranchCenter[1]} anchor="bottom">
            <div style={{ pointerEvents: 'none', textAlign: 'center' }}>
              <div className="rounded-md bg-emerald-800/90 px-2 py-1 text-[11px] font-semibold text-white shadow-md whitespace-nowrap">
                📍 {ranchName}
              </div>
              <div className="mx-auto h-2 w-0.5 bg-emerald-800/90" />
            </div>
          </Marker>
        )}

        {/* Etiqueta por parcela: solo su código.
            pointer-events: none → el clic atraviesa la etiqueta y llega al polígono. */}
        {labels.map(({ plot, center }) => {
          const selected = plot.id === selectedPlotId
          return (
            <Marker key={plot.id} longitude={center[0]} latitude={center[1]} anchor="center">
              <div
                className={`rounded px-1.5 py-0.5 text-center text-[10px] font-semibold leading-tight text-white shadow-sm ${
                  selected ? 'bg-emerald-700/85 ring-1 ring-white' : 'bg-black/55'
                }`}
                style={{ pointerEvents: 'none', whiteSpace: 'nowrap' }}
              >
                {plot.code ?? plot.id.slice(0, 8)}
              </div>
            </Marker>
          )
        })}
      </Map>

      {/* Tarjeta flotante de contexto (Productor · Rancho).
          - Productor: botón → vuelve a la vista del productor (pines de ranchos).
          - Rancho: botón solo si hay parcela seleccionada → vuelve a la vista del rancho. */}
      {(producerName || ranchName) && (
        <div className="absolute left-3 top-3 z-10 rounded-md bg-black/55 px-3 py-2 text-white shadow">
          {producerName && (
            onBackToProducer ? (
              <button
                type="button"
                onClick={onBackToProducer}
                className="flex items-center gap-1 text-[11px] opacity-80 hover:opacity-100 hover:underline"
              >
                <ArrowLeft className="h-3 w-3" /> {producerName}
              </button>
            ) : (
              <div className="text-[11px] opacity-80">{producerName}</div>
            )
          )}
          {ranchName && (
            selectedPlotId && onBackToRanch ? (
              <button
                type="button"
                onClick={onBackToRanch}
                className="flex items-center gap-1 text-sm font-semibold leading-tight hover:underline"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> {ranchName}
              </button>
            ) : (
              <div className="text-sm font-semibold leading-tight">{ranchName}</div>
            )
          )}
          <div className="mt-0.5 text-[10px] opacity-80">
            {selectedPlotId ? 'Clic en el rancho para ver todas las parcelas' : 'Clic en una parcela para ver sus sesiones'}
          </div>
        </div>
      )}

      <MapModeSelector active={mapMode} onChange={setMapMode} />
    </div>
  )
}
