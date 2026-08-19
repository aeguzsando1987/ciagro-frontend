import { useEffect, useMemo, useRef, useState } from 'react'
import MapGL, { Layer, Popup, Source } from 'react-map-gl/maplibre'
import type { MapLayerMouseEvent, MapRef } from 'react-map-gl/maplibre'
import { usePlotGeometry } from '@/features/task-manager/hooks/usePlotGeometry'
import { useSoilMapPoints, type SoilMapPoint } from '@/features/task-manager/hooks/useSoilMapPoints'
import {
  SOIL_MAP_LAYERS,
  SOIL_MAP_LAYER_GROUPS,
  buildNumericScale,
  buildNumericScaleFromBreaks,
  categoryBucket,
  categoryColor,
  formatSoilValue,
  normalizeSoilCategory,
  numericBucket,
  type SoilMapCategoryLayerDef,
  type SoilMapLayerDef,
  type SoilMapLegendEntry,
} from '@/features/task-manager/lib/soilMapLayers'
import { analyzeSoilSurface } from '@/features/task-manager/lib/soilMapSurface'
import { ESRI_STYLE, formatHa } from '@/features/geodata-visor/lib/aspersionMap.helpers'
import {
  buildSoilBucketAreaStats,
  buildSoilRasterAreaStats,
  resolveSoilMapBoundary,
} from '@/features/geodata-visor/lib/soilMapArea'
import {
  useMapCameraSync,
  type MapCameraSyncBinding,
} from '@/features/geodata-visor/lib/mapCameraSync'
import { SoilMapStatsCard } from './SoilMapStatsCard'
import { LoadingState } from '@/components/ui/loading-state'

interface SoilMapProps {
  sessionId: string
  plotId: string | null
  enabled?: boolean
  toolbarStart?: React.ReactNode
  toolbarEnd?: React.ReactNode
  floatingToolbar?: boolean
  sessionsSlot?: React.ReactNode
  className?: string
  mapSync?: MapCameraSyncBinding
}

interface SoilMapSample {
  id: string
  lng: number
  lat: number
  value: number | string
}

interface AnnotatedSoilMapSample extends SoilMapSample {
  bucket: string
}

type PopupInfo = AnnotatedSoilMapSample

function bboxFromCoords(coords: number[][]): [number, number, number, number] {
  const longitudes = coords.map((coordinate) => coordinate[0]!)
  const latitudes = coords.map((coordinate) => coordinate[1]!)
  return [
    Math.min(...longitudes),
    Math.min(...latitudes),
    Math.max(...longitudes),
    Math.max(...latitudes),
  ]
}

function samplesForLayer(points: SoilMapPoint[] | undefined, layer: SoilMapLayerDef) {
  if (!points) return []
  const samples: SoilMapSample[] = []

  for (const point of points) {
    const coordinates = point.geom.coordinates
    if (
      !coordinates ||
      coordinates.length < 2 ||
      !Number.isFinite(coordinates[0]) ||
      !Number.isFinite(coordinates[1])
    ) {
      continue
    }

    const rawValue = point[layer.field]
    if (layer.kind === 'numeric') {
      if (typeof rawValue !== 'number' || !Number.isFinite(rawValue)) continue
      samples.push({
        id: point.id,
        lng: coordinates[0]!,
        lat: coordinates[1]!,
        value: rawValue,
      })
      continue
    }

    if (typeof rawValue !== 'string' || rawValue.trim() === '') continue
    samples.push({
      id: point.id,
      lng: coordinates[0]!,
      lat: coordinates[1]!,
      value: rawValue.trim(),
    })
  }

  return samples
}

function buildCategoryEntries(
  layer: SoilMapCategoryLayerDef,
  samples: SoilMapSample[]
): SoilMapLegendEntry[] {
  const uniqueValues = new Map<string, string>()
  for (const sample of samples) {
    const value = String(sample.value)
    uniqueValues.set(normalizeSoilCategory(value), value)
  }

  return Array.from(uniqueValues.entries())
    .sort(([, left], [, right]) => left.localeCompare(right, 'es-MX'))
    .map(([normalized, label], index) => ({
      key: categoryBucket(normalized),
      color: categoryColor(layer, normalized, index),
      label,
    }))
}

function colorExpression(entries: SoilMapLegendEntry[]): unknown[] {
  const expression: unknown[] = ['match', ['get', 'bucket']]
  for (const entry of entries) {
    expression.push(entry.key, entry.color)
  }
  expression.push('#94A3B8')
  return expression
}

function LoadingOverlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 text-sm text-muted-foreground">
      {children}
    </div>
  )
}

export function SoilMap({
  sessionId,
  plotId,
  enabled = true,
  toolbarStart,
  toolbarEnd,
  floatingToolbar = false,
  sessionsSlot,
  className,
  mapSync,
}: SoilMapProps) {
  const [activeLayerIndex, setActiveLayerIndex] = useState(0)
  const [checkedBuckets, setCheckedBuckets] = useState<Set<string> | null>(null)
  const [hoveredSample, setHoveredSample] = useState<PopupInfo | null>(null)
  const mapRef = useRef<MapRef>(null)
  const handleCameraMove = useMapCameraSync(mapRef, mapSync)

  const { data: points, isLoading, error } = useSoilMapPoints(sessionId, enabled)
  const { data: plot } = usePlotGeometry(plotId)
  const activeLayer = SOIL_MAP_LAYERS[activeLayerIndex]!
  const plotGeometry = plot?.geometry
  const plotRing = plotGeometry?.coordinates?.[0] ?? null
  const boundary = useMemo(
    () => resolveSoilMapBoundary(plotRing, plot?.properties?.total_area),
    [plot?.properties?.total_area, plotRing]
  )
  const boundaryRing = boundary?.ring ?? null
  const displayBoundaryGeometry = useMemo<GeoJSON.Feature<GeoJSON.Polygon> | null>(
    () =>
      boundaryRing
        ? {
            type: 'Feature',
            geometry: { type: 'Polygon', coordinates: [boundaryRing] },
            properties: {},
          }
        : null,
    [boundaryRing]
  )

  const layerCounts = useMemo(
    () => SOIL_MAP_LAYERS.map((layer) => samplesForLayer(points, layer).length),
    [points]
  )

  useEffect(() => {
    if (!points || layerCounts[activeLayerIndex]! > 0) return
    const firstAvailable = layerCounts.findIndex((count) => count > 0)
    if (firstAvailable >= 0) setActiveLayerIndex(firstAvailable)
  }, [activeLayerIndex, layerCounts, points])

  useEffect(() => {
    setCheckedBuckets(null)
    setHoveredSample(null)
  }, [activeLayer])

  const samples = useMemo(() => samplesForLayer(points, activeLayer), [activeLayer, points])

  const surfaceAnalysis = useMemo(() => {
    if (activeLayer.kind !== 'numeric' || !boundaryRing || samples.length < 3) return null
    return analyzeSoilSurface({
      ring: boundaryRing,
      samples: samples.map((sample) => ({
        lng: sample.lng,
        lat: sample.lat,
        value: Number(sample.value),
      })),
      paletteSize: activeLayer.palette.length,
    })
  }, [activeLayer, boundaryRing, samples])

  const numericScale = useMemo(() => {
    if (activeLayer.kind !== 'numeric') return null
    if (surfaceAnalysis) {
      return buildNumericScaleFromBreaks(
        surfaceAnalysis.min,
        surfaceAnalysis.max,
        surfaceAnalysis.breaks,
        activeLayer.palette,
        activeLayer.unit
      )
    }
    return buildNumericScale(
      samples.map((sample) => Number(sample.value)),
      activeLayer.palette,
      activeLayer.unit
    )
  }, [activeLayer, samples, surfaceAnalysis])

  const legendEntries = useMemo(
    () =>
      activeLayer.kind === 'numeric'
        ? (numericScale?.entries ?? [])
        : buildCategoryEntries(activeLayer, samples),
    [activeLayer, numericScale, samples]
  )
  useEffect(() => {
    setCheckedBuckets(new Set(legendEntries.map((entry) => entry.key)))
  }, [legendEntries])

  const annotatedSamples = useMemo<AnnotatedSoilMapSample[]>(
    () =>
      samples.map((sample) => ({
        ...sample,
        bucket:
          activeLayer.kind === 'numeric' && numericScale
            ? numericBucket(Number(sample.value), numericScale.breaks, activeLayer.palette.length)
            : categoryBucket(String(sample.value)),
      })),
    [activeLayer, numericScale, samples]
  )

  const pointCollection = useMemo<GeoJSON.FeatureCollection<GeoJSON.Point>>(
    () => ({
      type: 'FeatureCollection',
      features: annotatedSamples.map((sample) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [sample.lng, sample.lat] },
        properties: {
          id: sample.id,
          value: sample.value,
          bucket: sample.bucket,
        },
      })),
    }),
    [annotatedSamples]
  )

  const allBucketKeys = useMemo(
    () => new Set(legendEntries.map((entry) => entry.key)),
    [legendEntries]
  )
  const visibleBuckets = checkedBuckets ?? allBucketKeys

  const filterExpression = useMemo(() => {
    if (legendEntries.length === 0 || checkedBuckets === null) return undefined
    if (checkedBuckets.size === legendEntries.length) return undefined
    if (checkedBuckets.size === 0) return ['boolean', false]
    return ['match', ['get', 'bucket'], Array.from(checkedBuckets), true, false]
  }, [checkedBuckets, legendEntries])

  const bucketStats = useMemo(() => {
    const bucketKeys = legendEntries.map((entry) => entry.key)
    const totalAreaHa = boundary?.totalAreaHa ?? null
    if (activeLayer.kind === 'numeric' && surfaceAnalysis?.bucketCellCounts) {
      return buildSoilRasterAreaStats(bucketKeys, surfaceAnalysis.bucketCellCounts, totalAreaHa)
    }
    return buildSoilBucketAreaStats(
      bucketKeys,
      annotatedSamples.map((sample) => sample.bucket),
      totalAreaHa
    )
  }, [activeLayer.kind, annotatedSamples, boundary?.totalAreaHa, legendEntries, surfaceAnalysis])

  const mapBounds = useMemo<[number, number, number, number] | null>(() => {
    if (boundaryRing && boundaryRing.length > 0) return bboxFromCoords(boundaryRing)
    if (samples.length > 0) {
      return bboxFromCoords(samples.map((sample) => [sample.lng, sample.lat]))
    }
    return null
  }, [boundaryRing, samples])

  useEffect(() => {
    if (!mapRef.current || !mapBounds) return
    mapRef.current.fitBounds(mapBounds, { padding: 56, duration: 600, maxZoom: 18 })
  }, [mapBounds])

  function toggleBucket(key: string) {
    setCheckedBuckets((previous) => {
      const next = new Set(previous ?? allBucketKeys)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
    setHoveredSample(null)
  }

  function popupFromEvent(event: MapLayerMouseEvent): PopupInfo | null {
    const feature = event.features?.[0]
    if (!feature || feature.geometry.type !== 'Point') return null
    const coordinates = feature.geometry.coordinates as number[]
    const properties = feature.properties as {
      id?: string
      value?: number | string
      bucket?: string
    }
    return {
      id: properties.id ?? '',
      lng: coordinates[0]!,
      lat: coordinates[1]!,
      value: properties.value ?? '',
      bucket: properties.bucket ?? '',
    }
  }

  function handleMapHover(event: MapLayerMouseEvent) {
    setHoveredSample(popupFromEvent(event))
  }

  const toolbar = (
    <>
      {toolbarStart}
      <label className="flex min-w-0 items-center gap-1.5 text-[10px] font-medium">
        Variable
        <select
          aria-label="Variable del mapa"
          className="h-7 max-w-[min(26rem,60vw)] rounded-md border border-input bg-background px-2 text-xs shadow-sm outline-none focus:ring-2 focus:ring-ring"
          value={activeLayer.key}
          onChange={(event) => {
            const nextIndex = SOIL_MAP_LAYERS.findIndex((layer) => layer.key === event.target.value)
            if (nextIndex >= 0) setActiveLayerIndex(nextIndex)
          }}
        >
          {SOIL_MAP_LAYER_GROUPS.map((group) =>
            SOIL_MAP_LAYERS.some(
              (layer, index) => layer.group === group && layerCounts[index]! > 0
            ) ? (
              <optgroup key={group} label={group}>
                {SOIL_MAP_LAYERS.map((layer, index) =>
                  layer.group === group && layerCounts[index]! > 0 ? (
                    <option key={layer.key} value={layer.key}>
                      {layer.label}
                    </option>
                  ) : null
                )}
              </optgroup>
            ) : null
          )}
        </select>
      </label>
      {toolbarEnd && <div className="ml-auto">{toolbarEnd}</div>}
    </>
  )

  const pointRadius = ['interpolate', ['linear'], ['zoom'], 8, 1.5, 14, 4, 20, 6]

  return (
    <div className={`flex h-full min-h-0 flex-col overflow-hidden ${className ?? ''}`}>
      {!floatingToolbar && (
        <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-b px-3 py-1.5">
          {toolbar}
        </div>
      )}

      <div className="relative min-h-0 flex-1">
        {floatingToolbar && (
          <div className="absolute left-2 top-2 z-20 flex flex-wrap items-center gap-1.5">
            {toolbar}
          </div>
        )}

        {sessionsSlot && (
          <div className="absolute bottom-2 right-2 top-2 z-10 flex w-56 flex-col gap-2">
            {sessionsSlot}
            {legendEntries.length > 0 && (
              <SoilMapStatsCard
                layerLabel={activeLayer.label}
                legendEntries={legendEntries}
                bucketStats={bucketStats}
                totalAreaHa={boundary?.totalAreaHa ?? null}
                checkedBuckets={visibleBuckets}
                onToggle={toggleBucket}
              />
            )}
          </div>
        )}

        {isLoading && (
          <LoadingOverlay>
            <LoadingState
              compact
              label="Cargando muestras de suelo…"
              className="rounded-xl border border-default bg-white/95 shadow-sm"
            />
          </LoadingOverlay>
        )}
        {!isLoading && error && (
          <LoadingOverlay>No se pudieron cargar las muestras de suelo.</LoadingOverlay>
        )}
        {!isLoading && !error && samples.length === 0 && (
          <LoadingOverlay>Esta variable no tiene valores en la sesión.</LoadingOverlay>
        )}

        <MapGL
          ref={mapRef}
          onMove={mapSync ? handleCameraMove : undefined}
          initialViewState={
            mapBounds
              ? { bounds: mapBounds, fitBoundsOptions: { padding: 56, maxZoom: 18 } }
              : { longitude: -101, latitude: 20.5, zoom: 6 }
          }
          maxZoom={20}
          mapStyle={ESRI_STYLE}
          cooperativeGestures
          attributionControl={false}
          interactiveLayerIds={samples.length > 0 ? ['soil-sample-points'] : []}
          onMouseMove={handleMapHover}
          onMouseLeave={() => setHoveredSample(null)}
          style={{ width: '100%', height: '100%' }}
        >
          {displayBoundaryGeometry && (
            <Source id="soil-plot-fill-source" type="geojson" data={displayBoundaryGeometry}>
              <Layer
                id="soil-plot-fill"
                type="fill"
                paint={{
                  'fill-color': '#22C55E',
                  'fill-opacity': 0.12,
                }}
              />
            </Source>
          )}

          {pointCollection.features.length > 0 && (
            <Source id="soil-sample-source" type="geojson" data={pointCollection}>
              <Layer
                id="soil-sample-points"
                type="circle"
                paint={{
                  'circle-radius': pointRadius as never,
                  'circle-color': colorExpression(legendEntries) as never,
                  'circle-opacity': 1,
                  'circle-stroke-width': 0,
                }}
                {...(filterExpression ? { filter: filterExpression as never } : {})}
              />
            </Source>
          )}

          {hoveredSample && (
            <Popup
              longitude={hoveredSample.lng}
              latitude={hoveredSample.lat}
              anchor="bottom"
              closeOnClick={false}
              closeButton={false}
              offset={12}
              style={{ pointerEvents: 'none' }}
            >
              <div className="min-w-36 space-y-1 text-xs">
                <p className="font-semibold">{activeLayer.label}</p>
                <p>
                  {typeof hoveredSample.value === 'number'
                    ? formatSoilValue(hoveredSample.value, activeLayer.unit)
                    : hoveredSample.value}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {hoveredSample.lat.toFixed(6)}, {hoveredSample.lng.toFixed(6)}
                </p>
              </div>
            </Popup>
          )}
        </MapGL>
      </div>

      <div className="shrink-0 space-y-1 border-t bg-background px-4 py-2 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">{activeLayer.label}</span>
          <span className="text-muted-foreground">· {samples.length} muestras válidas</span>
          <span className="font-medium">
            · Área total: {boundary ? formatHa(boundary.totalAreaHa) : '—'} ha
          </span>
          <span className="text-[10px] italic text-muted-foreground">
            clic en cada rango para mostrar u ocultar
          </span>
        </div>

        {activeLayer.kind === 'numeric' &&
          boundaryRing &&
          samples.length < 3 &&
          samples.length > 0 && (
            <p className="rounded bg-amber-50 px-2 py-1 text-[11px] text-amber-800">
              Se requieren al menos 3 muestras para interpolar; se muestran puntos exactos.
            </p>
          )}

        {activeLayer.kind === 'category' && samples.length > 0 && (
          <p className="text-[11px] text-muted-foreground">
            Esta variable es categórica y se representa con muestras exactas.
          </p>
        )}

        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {legendEntries.map((entry) => {
            const checked = visibleBuckets.has(entry.key)
            return (
              <label
                key={entry.key}
                className="group flex cursor-pointer select-none items-center gap-1.5 text-xs"
              >
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={checked}
                  aria-label={`Mostrar ${entry.label}`}
                  onChange={() => toggleBucket(entry.key)}
                />
                <span
                  className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border-2 transition-colors duration-150"
                  style={{
                    borderColor: entry.color,
                    backgroundColor: checked ? entry.color : 'transparent',
                  }}
                >
                  {checked && (
                    <span className="leading-none text-white" style={{ fontSize: 10 }}>
                      ✓
                    </span>
                  )}
                </span>
                <span
                  className="inline-block h-3 w-3 shrink-0 rounded-sm"
                  style={{ backgroundColor: checked ? entry.color : '#D1D5DB' }}
                />
                <span className={checked ? '' : 'text-muted-foreground line-through'}>
                  {entry.label}
                  <span className="ml-1 text-muted-foreground">
                    · {(bucketStats[entry.key]?.percentage ?? 0).toFixed(1)}% ·{' '}
                    {bucketStats[entry.key]?.areaHa != null
                      ? formatHa(bucketStats[entry.key]!.areaHa)
                      : '—'}{' '}
                    ha
                  </span>
                </span>
              </label>
            )
          })}
        </div>
      </div>
    </div>
  )
}
