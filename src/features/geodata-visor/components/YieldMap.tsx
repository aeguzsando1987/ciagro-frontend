import { useEffect, useId, useMemo, useRef, useState } from 'react'
import MapGL, { Layer, Popup, Source } from 'react-map-gl/maplibre'
import type { MapLayerMouseEvent, MapRef } from 'react-map-gl/maplibre'
import { ChevronDown, Gauge, Mountain, Wheat, Waves, Zap } from 'lucide-react'
import { usePlotGeometry } from '@/features/task-manager/hooks/usePlotGeometry'
import { useYieldMapPoints } from '@/features/yield-map/hooks/useYieldMapPoints'
import { useYieldMapStats } from '@/features/yield-map/hooks/useYieldMapStats'
import type { YieldLayerKey, YieldMapPoint } from '@/features/yield-map/types'
import {
  YIELD_LAYERS,
  buildYieldClasses,
  formatYieldValue,
  type YieldClass,
} from '@/features/yield-map/lib/yieldMapLayers'
import { yieldPointsToPointFeatures, yieldPointsToRectangles } from '@/features/yield-map/lib/yieldMapGeometry'
import { ESRI_STYLE } from '../lib/aspersionMap.helpers'
import { LoadingState } from '@/components/ui/loading-state'
import type { MapCameraSyncBinding } from '../lib/mapCameraSync'
import { useMapCameraSync } from '../lib/mapCameraSync'

interface YieldMapProps {
  sessionId: string
  plotId: string | null
  toolbarStart?: React.ReactNode
  toolbarEnd?: React.ReactNode
  className?: string
  mapSync?: MapCameraSyncBinding
  /** En comparación A/B el resumen inicia contraído para no tapar el mapa. */
  comparisonMode?: boolean
}

const LAYER_ICONS: Record<YieldLayerKey, React.ReactNode> = {
  yield_t_ha: <Wheat className="h-4 w-4" />,
  moisture_pct: <Waves className="h-4 w-4" />,
  speed_kmh: <Gauge className="h-4 w-4" />,
  grain_flow_t_h: <Zap className="h-4 w-4" />,
  elevation_m: <Mountain className="h-4 w-4" />,
}

function colorExpression(classes: YieldClass[]): unknown[] {
  const expression: unknown[] = ['match', ['get', 'bucket']]
  for (const entry of classes) expression.push(entry.key, entry.color)
  expression.push('#94a3b8')
  return expression
}

function collectPositions(value: unknown, output: [number, number][]) {
  if (!Array.isArray(value)) return
  if (
    value.length >= 2 &&
    typeof value[0] === 'number' &&
    typeof value[1] === 'number'
  ) {
    output.push([value[0], value[1]])
    return
  }
  for (const child of value) collectPositions(child, output)
}

function boundsOfGeometry(geometry: unknown): [[number, number], [number, number]] | null {
  if (!geometry || typeof geometry !== 'object' || !('coordinates' in geometry)) return null
  const positions: [number, number][] = []
  collectPositions((geometry as { coordinates?: unknown }).coordinates, positions)
  if (positions.length === 0) return null
  let minLon = Infinity
  let minLat = Infinity
  let maxLon = -Infinity
  let maxLat = -Infinity
  for (const [lon, lat] of positions) {
    minLon = Math.min(minLon, lon)
    minLat = Math.min(minLat, lat)
    maxLon = Math.max(maxLon, lon)
    maxLat = Math.max(maxLat, lat)
  }
  return [[minLon, minLat], [maxLon, maxLat]]
}

function asFeature(geometry: unknown): GeoJSON.Feature | null {
  if (!geometry || typeof geometry !== 'object' || !('type' in geometry)) return null
  return { type: 'Feature', geometry: geometry as GeoJSON.Geometry, properties: {} }
}

export function YieldMap({
  sessionId,
  plotId,
  toolbarStart,
  toolbarEnd,
  className,
  mapSync,
  comparisonMode = false,
}: YieldMapProps) {
  const instanceId = useId().replace(/:/g, '')
  const plotSourceId = `yield-plot-${instanceId}`
  const plotLayerId = `yield-plot-outline-${instanceId}`
  const rectanglesSourceId = `yield-rectangles-${instanceId}`
  const rectanglesLayerId = `yield-rectangles-fill-${instanceId}`
  const pointsSourceId = `yield-points-${instanceId}`
  const pointsLayerId = `yield-points-fallback-${instanceId}`

  const [activeKey, setActiveKey] = useState<YieldLayerKey>('yield_t_ha')
  const [layerMenuOpen, setLayerMenuOpen] = useState(false)
  const [visibleBuckets, setVisibleBuckets] = useState<Set<string>>(new Set())
  const [popup, setPopup] = useState<{ lng: number; lat: number; point: YieldMapPoint } | null>(null)
  const [summaryCollapsed, setSummaryCollapsed] = useState(comparisonMode)
  const mapRef = useRef<MapRef>(null)
  const handleCameraMove = useMapCameraSync(mapRef, mapSync)

  const pointsQuery = useYieldMapPoints(sessionId)
  const statsQuery = useYieldMapStats(sessionId)
  const plotQuery = usePlotGeometry(plotId)
  const points = pointsQuery.data ?? []
  const activeLayer = YIELD_LAYERS.find((layer) => layer.key === activeKey) ?? YIELD_LAYERS[0]!

  const values = useMemo(
    () => points.map((point) => point[activeKey] as number | null),
    [activeKey, points]
  )
  const classes = useMemo(() => buildYieldClasses(values, activeLayer), [activeLayer, values])

  useEffect(() => {
    setVisibleBuckets(new Set(classes.map((entry) => entry.key)))
    setPopup(null)
  }, [classes])

  // Una sola pantalla conserva el resumen abierto. En A/B inicia cerrado y el usuario
  // puede desplegarlo solo cuando lo necesite, dejando libre el ancho del mapa.
  useEffect(() => {
    setSummaryCollapsed(comparisonMode)
  }, [comparisonMode])

  const rectangles = useMemo(
    () => yieldPointsToRectangles(points, (point) => point[activeKey] as number | null, classes),
    [activeKey, classes, points]
  )
  const pointFeatures = useMemo(
    () => yieldPointsToPointFeatures(points, (point) => point[activeKey] as number | null, classes),
    [activeKey, classes, points]
  )
  const usePointFallback = rectangles.features.length === 0 && pointFeatures.features.length > 0

  const pointsById = useMemo(() => new Map(points.map((point) => [point.id, point])), [points])

  // Siempre mandamos un filtro explícito a MapLibre. En comparación A/B dos mapas
  // montan al mismo tiempo; pasar de `false` a `undefined` podía dejar una de las
  // capas con el filtro anterior y por eso una mitad mostraba estadísticas/leyenda
  // pero no los rectángulos.
  const fillFilter = useMemo(() => {
    if (classes.length === 0 || visibleBuckets.size === 0) {
      return ['boolean', false] as unknown[]
    }
    return ['match', ['get', 'bucket'], Array.from(visibleBuckets), true, false] as unknown[]
  }, [classes.length, visibleBuckets])

  const plotGeometry = plotQuery.data?.geometry as unknown
  const plotFeature = useMemo(() => asFeature(plotGeometry), [plotGeometry])
  const plotBounds = useMemo(() => boundsOfGeometry(plotGeometry), [plotGeometry])

  useEffect(() => {
    if (!plotBounds || !mapRef.current) return
    mapRef.current.fitBounds(plotBounds, { padding: 50, duration: 500, maxZoom: 18 })
  }, [plotBounds])

  function handlePointer(event: MapLayerMouseEvent) {
    const feature = event.features?.[0]
    const id = feature?.properties?.id as string | undefined
    if (!id) {
      setPopup(null)
      return
    }
    const point = pointsById.get(id)
    if (!point || !point.geom?.coordinates) return
    setPopup({ lng: point.geom.coordinates[0], lat: point.geom.coordinates[1], point })
  }

  const stats = statsQuery.data
  const activeValueCount = values.filter((value) => typeof value === 'number' && Number.isFinite(value)).length
  const activeLayerHasData = activeValueCount > 0
  const isLoading = pointsQuery.isLoading || plotQuery.isLoading

  return (
    <div className={`relative h-full min-h-[430px] w-full overflow-hidden bg-muted ${className ?? ''}`}>
      <MapGL
        ref={mapRef}
        mapStyle={ESRI_STYLE}
        initialViewState={{ longitude: -101, latitude: 20.7, zoom: 6 }}
        maxZoom={20}
        interactiveLayerIds={usePointFallback ? [pointsLayerId] : [rectanglesLayerId]}
        onMouseMove={handlePointer}
        onClick={handlePointer}
        onMove={handleCameraMove}
        cursor={popup ? 'pointer' : 'grab'}
        onLoad={() => {
          if (plotBounds) mapRef.current?.fitBounds(plotBounds, { padding: 50, duration: 0, maxZoom: 18 })
        }}
      >
        {plotFeature && (
          <Source id={plotSourceId} type="geojson" data={plotFeature}>
            <Layer
              id={plotLayerId}
              type="line"
              paint={{ 'line-color': '#ffffff', 'line-width': 3, 'line-opacity': 0.95 }}
            />
          </Source>
        )}

        {!usePointFallback && (
          <Source id={rectanglesSourceId} type="geojson" data={rectangles}>
            <Layer
              id={rectanglesLayerId}
              type="fill"
              filter={fillFilter as never}
              paint={{
                'fill-color': colorExpression(classes) as never,
                'fill-opacity': 0.86,
                'fill-outline-color': 'rgba(255,255,255,0.18)',
              }}
            />
          </Source>
        )}

        {usePointFallback && (
          <Source id={pointsSourceId} type="geojson" data={pointFeatures}>
            <Layer
              id={pointsLayerId}
              type="circle"
              filter={fillFilter as never}
              paint={{
                'circle-color': colorExpression(classes) as never,
                'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 2, 16, 5, 20, 8] as never,
                'circle-opacity': 0.88,
                'circle-stroke-color': 'rgba(255,255,255,0.35)',
                'circle-stroke-width': 0.5,
              }}
            />
          </Source>
        )}

        {popup && (
          <Popup
            longitude={popup.lng}
            latitude={popup.lat}
            closeButton={false}
            closeOnClick={false}
            offset={12}
            anchor="bottom"
          >
            <div className="min-w-48 space-y-1 text-xs text-slate-900">
              <p className="font-semibold">Lectura de cosecha</p>
              <PopupRow
                label={activeLayer.shortLabel}
                value={`${formatYieldValue(popup.point[activeKey] as number | null)} ${activeLayer.unit}`}
              />
            </div>
          </Popup>
        )}
      </MapGL>

      {/* Índice de vistas rápidas DENTRO del mapa. */}
      <div className="absolute left-3 top-3 z-20 flex items-start gap-2">
        {toolbarStart}
        <div className="relative w-64 rounded-xl border border-white/30 bg-white/95 shadow-lg backdrop-blur-sm dark:bg-slate-950/95">
          <button
            type="button"
            onClick={() => setLayerMenuOpen((open) => !open)}
            className="flex min-h-11 w-full items-center gap-2 px-3 text-left"
            aria-expanded={layerMenuOpen}
          >
            <span className="text-emerald-700">{LAYER_ICONS[activeLayer.key]}</span>
            <span className="min-w-0 flex-1">
              <span className="block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Vista rápida</span>
              <span className="block truncate text-sm font-semibold">{activeLayer.label}</span>
            </span>
            <ChevronDown className={`h-4 w-4 transition-transform ${layerMenuOpen ? 'rotate-180' : ''}`} />
          </button>
          {layerMenuOpen && (
            <div className="border-t p-1.5">
              {YIELD_LAYERS.map((layer, index) => (
                <button
                  key={layer.key}
                  type="button"
                  onClick={() => { setActiveKey(layer.key); setLayerMenuOpen(false) }}
                  className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-muted ${
                    layer.key === activeKey ? 'bg-emerald-50 font-semibold text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100' : ''
                  }`}
                >
                  <span>{LAYER_ICONS[layer.key]}</span>
                  <span className="flex-1">{index + 1}. {layer.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        {toolbarEnd}
      </div>

      <div
        className={`absolute bottom-3 left-3 z-20 rounded-xl border border-white/30 bg-white/95 shadow-lg backdrop-blur-sm dark:bg-slate-950/95 ${
          comparisonMode ? 'w-48 p-2' : 'w-64 p-3'
        }`}
      >
        <div className={comparisonMode ? 'mb-1.5' : 'mb-2'}>
          <p className={comparisonMode ? 'text-xs font-semibold' : 'text-sm font-semibold'}>{activeLayer.shortLabel}</p>
          <p
            className={
              comparisonMode
                ? 'text-[9px] leading-tight text-muted-foreground'
                : 'text-[11px] text-muted-foreground'
            }
          >
            {activeLayer.description}
          </p>
          {usePointFallback && (
            <p
              className={`${
                comparisonMode ? 'mt-0.5 text-[9px] leading-tight' : 'mt-1 text-[10px]'
              } font-medium text-amber-700 dark:text-amber-300`}
            >
              Vista por puntos: el CSV no trae ancho/distancia suficientes para formar pasadas.
            </p>
          )}
        </div>
        <div className={comparisonMode ? 'space-y-0.5' : 'space-y-1.5'}>
          {classes.map((entry) => {
            const checked = visibleBuckets.has(entry.key)
            return (
              <button
                key={entry.key}
                type="button"
                onClick={() => setVisibleBuckets((current) => {
                  const next = new Set(current)
                  if (next.has(entry.key)) next.delete(entry.key)
                  else next.add(entry.key)
                  return next
                })}
                className={`flex w-full items-center rounded text-left hover:bg-muted ${
                  comparisonMode
                    ? 'gap-1.5 px-0.5 py-0 text-[9px] leading-4'
                    : 'gap-2 px-1 py-0.5 text-[11px]'
                }`}
              >
                <span
                  className={`flex shrink-0 items-center justify-center rounded border ${
                    comparisonMode ? 'h-3.5 w-3.5 text-[8px]' : 'h-4 w-4 text-[9px]'
                  } ${
                    checked
                      ? 'border-emerald-600 bg-emerald-600 text-white'
                      : 'border-slate-300'
                  }`}
                >
                  {checked ? '✓' : ''}
                </span>
                <span
                  className={`shrink-0 rounded-sm ${
                    comparisonMode ? 'h-3 w-3' : 'h-3.5 w-3.5'
                  }`}
                  style={{ backgroundColor: entry.color }}
                />
                <span className="truncate">{entry.label}</span>
              </button>
            )
          })}
          {classes.length === 0 && (
            <p
              className={
                comparisonMode
                  ? 'text-[9px] text-muted-foreground'
                  : 'text-xs text-muted-foreground'
              }
            >
              Esta variable no tiene datos.
            </p>
          )}
        </div>
      </div>

      {stats && (
        <div
          className={`absolute right-3 top-3 z-20 hidden rounded-xl border border-white/30 bg-white/95 text-xs shadow-lg backdrop-blur-sm xl:block dark:bg-slate-950/95 ${
            summaryCollapsed ? 'w-52' : 'w-56'
          }`}
        >
          <button
            type="button"
            onClick={() => setSummaryCollapsed((value) => !value)}
            className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left"
            aria-expanded={!summaryCollapsed}
          >
            <span className="font-semibold">Resumen del rendimiento</span>
            <ChevronDown
              className={`h-4 w-4 shrink-0 transition-transform ${summaryCollapsed ? '' : 'rotate-180'}`}
            />
          </button>

          {!summaryCollapsed && (
            <div className="space-y-2 border-t px-3 pb-3 pt-2">
              <SummaryRow label="Promedio" value={`${formatYieldValue(stats.yield_avg)} t/ha`} />
              <SummaryRow label="Máximo" value={`${formatYieldValue(stats.yield_max)} t/ha`} />
              <SummaryRow label="Mínimo" value={`${formatYieldValue(stats.yield_min)} t/ha`} />
              <SummaryRow label="Producción" value={`${formatYieldValue(stats.production_total_t)} t`} />
              <SummaryRow label="Superficie" value={`${formatYieldValue(stats.surface_total_ha)} ha`} />
            </div>
          )}
        </div>
      )}

      {isLoading && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-background/55">
          <LoadingState label="Preparando mapa de rendimiento…" />
        </div>
      )}
      {pointsQuery.isError && (
        <div className="absolute inset-x-3 bottom-3 z-30 rounded-lg border border-destructive/30 bg-background p-3 text-sm text-destructive shadow">
          No se pudieron cargar los puntos del mapa de rendimiento.
        </div>
      )}
      {!isLoading && points.length > 0 && !activeLayerHasData && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-black/20">
          <div className="rounded-xl bg-background/95 px-5 py-4 text-center shadow-lg">
            <p className="font-semibold">Sin datos de {activeLayer.shortLabel.toLowerCase()}</p>
            <p className="mt-1 text-xs text-muted-foreground">Esta sesión sí tiene lecturas, pero el CSV no contiene valores para esta vista.</p>
          </div>
        </div>
      )}
      {!isLoading && points.length === 0 && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/25">
          <div className="rounded-xl bg-background/95 px-5 py-4 text-center shadow-lg">
            <p className="font-semibold">Sin datos de rendimiento</p>
            <p className="mt-1 text-xs text-muted-foreground">Carga el CSV desde Task Manager para pintar esta sesión.</p>
          </div>
        </div>
      )}
    </div>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between gap-2 border-t pt-1.5"><span className="text-muted-foreground">{label}</span><strong>{value}</strong></div>
}

function PopupRow({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between gap-4"><span className="text-slate-500">{label}</span><strong>{value}</strong></div>
}
