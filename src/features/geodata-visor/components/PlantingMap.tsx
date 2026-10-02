import { useEffect, useId, useMemo, useRef, useState } from 'react'
import MapGL, { Layer, Popup, Source } from 'react-map-gl/maplibre'
import type { MapLayerMouseEvent, MapRef } from 'react-map-gl/maplibre'
import { ChevronDown, Sprout } from 'lucide-react'
import { usePlotGeometry } from '@/features/task-manager/hooks/usePlotGeometry'
import { usePlantingMapSessionDetail } from '@/features/planting-map/hooks/usePlantingMapSessionDetail'
import { usePlantingMapStats } from '@/features/planting-map/hooks/usePlantingMapStats'
import { usePlantingLayerValues } from '@/features/planting-map/hooks/usePlantingLayerValues'
import {
  PLANTING_LAYER_BY_KEY,
  PLANTING_MAP_LAYERS,
  bucketForValue,
  buildPlantingClasses,
  formatPlantingValue,
  type PlantingClass,
} from '@/features/planting-map/lib/plantingMapLayers'
import type { PlantingLayerKey } from '@/features/planting-map/types'
import { LoadingState } from '@/components/ui/loading-state'
import { ESRI_STYLE } from '../lib/aspersionMap.helpers'
import type { MapCameraSyncBinding } from '../lib/mapCameraSync'
import { useMapCameraSync } from '../lib/mapCameraSync'

interface Props {
  sessionId: string
  plotId: string | null
  toolbarStart?: React.ReactNode
  className?: string
  mapSync?: MapCameraSyncBinding
  comparisonMode?: boolean
}

function collectPositions(value: unknown, output: [number, number][]) {
  if (!Array.isArray(value)) return
  if (value.length >= 2 && typeof value[0] === 'number' && typeof value[1] === 'number') {
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
  let minLon = Infinity, minLat = Infinity, maxLon = -Infinity, maxLat = -Infinity
  for (const [lon, lat] of positions) {
    minLon = Math.min(minLon, lon); minLat = Math.min(minLat, lat)
    maxLon = Math.max(maxLon, lon); maxLat = Math.max(maxLat, lat)
  }
  return [[minLon, minLat], [maxLon, maxLat]]
}

function asFeature(geometry: unknown): GeoJSON.Feature | null {
  if (!geometry || typeof geometry !== 'object' || !('type' in geometry)) return null
  return { type: 'Feature', geometry: geometry as GeoJSON.Geometry, properties: {} }
}

function colorExpression(classes: PlantingClass[]): unknown[] {
  const expression: unknown[] = ['match', ['get', 'bucket']]
  for (const entry of classes) expression.push(entry.key, entry.color)
  expression.push('#94a3b8')
  return expression
}

type LayerSample = {
  longitude: number
  latitude: number
  value: number | string
  courseDeg: number | null
  swathWidthM: number | null
  distanceM: number | null
  sourceObjectId: number | null
}

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 1) return sorted[middle] ?? null
  const left = sorted[middle - 1]
  const right = sorted[middle]
  if (left == null || right == null) return null
  return (left + right) / 2
}

function metersBetween(a: LayerSample, b: LayerSample): number {
  const earthRadiusM = 6_378_137
  const lat1 = a.latitude * Math.PI / 180
  const lat2 = b.latitude * Math.PI / 180
  const dLat = (b.latitude - a.latitude) * Math.PI / 180
  const dLon = (b.longitude - a.longitude) * Math.PI / 180

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2

  return 2 * earthRadiusM * Math.asin(Math.min(1, Math.sqrt(h)))
}

function bearingDegrees(a: LayerSample, b: LayerSample): number {
  const lat1 = a.latitude * Math.PI / 180
  const lat2 = b.latitude * Math.PI / 180
  const dLon = (b.longitude - a.longitude) * Math.PI / 180
  const y = Math.sin(dLon) * Math.cos(lat2)
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon)
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360
}

function inferredHeading(
  sample: LayerSample,
  index: number,
  samples: LayerSample[],
): number {
  if (sample.courseDeg != null && Number.isFinite(sample.courseDeg)) {
    return sample.courseDeg
  }

  const previous = index > 0 ? samples[index - 1] : undefined
  const next = index + 1 < samples.length ? samples[index + 1] : undefined
  const candidates: Array<{ distance: number; heading: number }> = []

  if (previous) {
    const distance = metersBetween(previous, sample)
    if (distance <= 8) candidates.push({ distance, heading: bearingDegrees(previous, sample) })
  }
  if (next) {
    const distance = metersBetween(sample, next)
    if (distance <= 8) candidates.push({ distance, heading: bearingDegrees(sample, next) })
  }

  candidates.sort((a, b) => a.distance - b.distance)
  return candidates[0]?.heading ?? 0
}

function offsetMeters(
  longitude: number,
  latitude: number,
  eastM: number,
  northM: number,
): [number, number] {
  const earthRadiusM = 6_378_137
  const latitudeRad = latitude * Math.PI / 180
  const dLat = northM / earthRadiusM
  const cosLat = Math.max(0.000001, Math.abs(Math.cos(latitudeRad)))
  const dLon = eastM / (earthRadiusM * cosLat)

  return [
    longitude + dLon * 180 / Math.PI,
    latitude + dLat * 180 / Math.PI,
  ]
}

function rectangularCell(
  sample: LayerSample,
  index: number,
  samples: LayerSample[],
  fallbackSwathM: number,
  fallbackDistanceM: number,
): GeoJSON.Position[] {
  const headingDeg = inferredHeading(sample, index, samples)
  const heading = headingDeg * Math.PI / 180

  // La anchura y la distancia provienen del monitor. Se deja un hueco pequeno
  // para que las celdas sigan siendo distinguibles incluso con zoom cercano.
  const swathM =
    sample.swathWidthM != null && Number.isFinite(sample.swathWidthM) && sample.swathWidthM > 0
      ? sample.swathWidthM
      : fallbackSwathM
  const travelM =
    sample.distanceM != null && Number.isFinite(sample.distanceM) && sample.distanceM > 0
      ? sample.distanceM
      : fallbackDistanceM

  const halfWidth = Math.min(Math.max(swathM * 0.46, 0.2), 6)
  const halfLength = Math.min(Math.max(travelM * 0.46, 0.15), 3)

  // Curso: 0 deg = norte, 90 deg = este.
  const forwardEast = Math.sin(heading) * halfLength
  const forwardNorth = Math.cos(heading) * halfLength
  const rightEast = Math.cos(heading) * halfWidth
  const rightNorth = -Math.sin(heading) * halfWidth

  const corner1 = offsetMeters(
    sample.longitude,
    sample.latitude,
    forwardEast + rightEast,
    forwardNorth + rightNorth,
  )
  const corner2 = offsetMeters(
    sample.longitude,
    sample.latitude,
    forwardEast - rightEast,
    forwardNorth - rightNorth,
  )
  const corner3 = offsetMeters(
    sample.longitude,
    sample.latitude,
    -forwardEast - rightEast,
    -forwardNorth - rightNorth,
  )
  const corner4 = offsetMeters(
    sample.longitude,
    sample.latitude,
    -forwardEast + rightEast,
    -forwardNorth + rightNorth,
  )

  return [corner1, corner2, corner3, corner4, corner1]
}

export function PlantingMap({
  sessionId, plotId, toolbarStart, className, mapSync, comparisonMode = false,
}: Props) {
  const instanceId = useId().replace(/:/g, '')
  const plotSourceId = `planting-plot-${instanceId}`
  const plotLayerId = `planting-plot-outline-${instanceId}`
  const dataSourceId = `planting-data-${instanceId}`
  const dataLayerId = `planting-cells-${instanceId}`

  const detailQuery = usePlantingMapSessionDetail(sessionId)
  const statsQuery = usePlantingMapStats(sessionId)
  const plotQuery = usePlotGeometry(plotId)
  const detail = detailQuery.data
  const stats = statsQuery.data

  const availableLayers = useMemo<PlantingLayerKey[]>(() => {
    const source = detail?.available_layers?.length
      ? detail.available_layers
      : stats?.available_layers ?? []
    const allowed = new Set(source)
    return PLANTING_MAP_LAYERS.map((layer) => layer.key).filter((key) => allowed.has(key))
  }, [detail?.available_layers, stats?.available_layers])

  const [activeKey, setActiveKey] = useState<PlantingLayerKey>('density')
  const [menuOpen, setMenuOpen] = useState(false)
  const [visibleBuckets, setVisibleBuckets] = useState<Set<string>>(new Set())
  const [popup, setPopup] = useState<{ lng: number; lat: number; value: number | string } | null>(null)

  useEffect(() => {
    if (availableLayers.length > 0 && !availableLayers.includes(activeKey)) {
      setActiveKey(availableLayers[0]!)
    }
  }, [activeKey, availableLayers])

  const activeLayer = PLANTING_LAYER_BY_KEY[activeKey]
  const valuesQuery = usePlantingLayerValues(sessionId, activeKey, availableLayers.includes(activeKey))

  const samples = useMemo<LayerSample[]>(() => {
    const detailed = valuesQuery.data?.samples
    if (detailed?.length) {
      return detailed.map((row) => ({
        longitude: row[0],
        latitude: row[1],
        value: row[2],
        courseDeg: row[3],
        swathWidthM: row[4],
        distanceM: row[5],
        sourceObjectId: row[6],
      }))
    }

    // Compatibilidad temporal con una API anterior al footprint rectangular.
    return (valuesQuery.data?.points ?? []).map((row) => ({
      longitude: row[0],
      latitude: row[1],
      value: row[2],
      courseDeg: null,
      swathWidthM: null,
      distanceM: null,
      sourceObjectId: null,
    }))
  }, [valuesQuery.data?.points, valuesQuery.data?.samples])

  const classes = useMemo(
    () => buildPlantingClasses(samples.map((sample) => sample.value), activeLayer),
    [activeLayer, samples],
  )

  useEffect(() => {
    setVisibleBuckets(new Set(classes.map((entry) => entry.key)))
    setPopup(null)
  }, [classes])

  const fallbackSwathM = useMemo(
    () =>
      median(
        samples
          .map((sample) => sample.swathWidthM)
          .filter((value): value is number => value != null && Number.isFinite(value) && value > 0),
      ) ?? 1,
    [samples],
  )

  const fallbackDistanceM = useMemo(
    () =>
      median(
        samples
          .map((sample) => sample.distanceM)
          .filter((value): value is number => value != null && Number.isFinite(value) && value > 0),
      ) ?? 1,
    [samples],
  )

  const geojson = useMemo<GeoJSON.FeatureCollection<GeoJSON.Polygon>>(() => ({
    type: 'FeatureCollection',
    features: samples.flatMap((sample, index) => {
      const bucket = bucketForValue(sample.value, classes, activeLayer.kind)
      if (
        !bucket ||
        !Number.isFinite(sample.longitude) ||
        !Number.isFinite(sample.latitude)
      ) {
        return []
      }

      return [{
        type: 'Feature' as const,
        id: sample.sourceObjectId ?? index,
        geometry: {
          type: 'Polygon' as const,
          coordinates: [rectangularCell(sample, index, samples, fallbackSwathM, fallbackDistanceM)],
        },
        properties: {
          bucket,
          value: sample.value,
          longitude: sample.longitude,
          latitude: sample.latitude,
          courseDeg: sample.courseDeg,
          swathWidthM: sample.swathWidthM,
          distanceM: sample.distanceM,
        },
      }]
    }),
  }), [activeLayer.kind, classes, fallbackDistanceM, fallbackSwathM, samples])

  const fillFilter = useMemo(() => {
    if (classes.length === 0 || visibleBuckets.size === 0) return ['boolean', false] as unknown[]
    return ['match', ['get', 'bucket'], Array.from(visibleBuckets), true, false] as unknown[]
  }, [classes.length, visibleBuckets])

  const mapRef = useRef<MapRef>(null)
  const handleCameraMove = useMapCameraSync(mapRef, mapSync)
  const plotGeometry = plotQuery.data?.geometry as unknown
  const plotFeature = useMemo(() => asFeature(plotGeometry), [plotGeometry])
  const plotBounds = useMemo(() => boundsOfGeometry(plotGeometry), [plotGeometry])

  useEffect(() => {
    if (!plotBounds || !mapRef.current) return
    mapRef.current.fitBounds(plotBounds, {
      padding: 55,
      duration: 450,
      maxZoom: 19,
    })
  }, [comparisonMode, plotBounds])

  function handlePointer(event: MapLayerMouseEvent) {
    const feature = event.features?.[0]
    const value = feature?.properties?.value as number | string | undefined
    const longitude = Number(feature?.properties?.longitude)
    const latitude = Number(feature?.properties?.latitude)

    if (
      value == null ||
      !Number.isFinite(longitude) ||
      !Number.isFinite(latitude)
    ) {
      setPopup(null)
      return
    }

    setPopup({ lng: longitude, lat: latitude, value })
  }

  const isLoading = detailQuery.isLoading || plotQuery.isLoading || statsQuery.isLoading || valuesQuery.isLoading
  const numericStats = stats?.numeric?.[activeKey]

  return (
    <div className={`relative h-full min-h-[430px] w-full overflow-hidden bg-muted ${className ?? ''}`}>
      <MapGL
        ref={mapRef}
        mapStyle={ESRI_STYLE}
        initialViewState={{ longitude: -101, latitude: 20.7, zoom: 6 }}
        maxZoom={21}
        interactiveLayerIds={[dataLayerId]}
        onMouseMove={handlePointer}
        onClick={handlePointer}
        onMove={handleCameraMove}
        cursor={popup ? 'pointer' : 'grab'}
        onLoad={() => {
          if (plotBounds) {
            mapRef.current?.fitBounds(plotBounds, {
              padding: 55,
              duration: 0,
              maxZoom: 19,
            })
          }
        }}
      >
        {plotFeature && (
          <Source id={plotSourceId} type="geojson" data={plotFeature}>
            <Layer id={plotLayerId} type="line"
              paint={{ 'line-color': '#ffffff', 'line-width': 3, 'line-opacity': 0.95 }} />
          </Source>
        )}

        <Source id={dataSourceId} type="geojson" data={geojson}>
          <Layer
            id={dataLayerId}
            type="fill"
            filter={fillFilter as never}
            paint={{
              'fill-color': colorExpression(classes) as never,
              'fill-opacity': 0.94,
              'fill-outline-color': 'rgba(20, 32, 22, 0.52)',
            }}
          />
        </Source>

        {popup && (
          <Popup longitude={popup.lng} latitude={popup.lat} closeButton={false}
            closeOnClick={false} anchor="bottom" offset={10}>
            <div className="min-w-44 text-xs text-slate-900">
              <p className="font-semibold">Lectura de siembra</p>
              <div className="mt-1 flex items-center justify-between gap-4">
                <span className="text-slate-500">{activeLayer.label}</span>
                <strong>
                  {formatPlantingValue(popup.value)}
                  {activeLayer.unit ? ` ${activeLayer.unit}` : ''}
                </strong>
              </div>
            </div>
          </Popup>
        )}
      </MapGL>

      <div className="absolute left-3 top-3 z-20 flex items-start gap-2">
        {toolbarStart}
        <div className="relative w-64 rounded-xl border border-white/30 bg-white/95 shadow-lg backdrop-blur-sm dark:bg-slate-950/95">
          <button type="button" onClick={() => setMenuOpen((open) => !open)}
            className="flex min-h-11 w-full items-center gap-2 px-3 text-left" aria-expanded={menuOpen}>
            <Sprout className="h-4 w-4 text-emerald-700" />
            <span className="min-w-0 flex-1">
              <span className="block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Variable de siembra
              </span>
              <span className="block truncate text-sm font-semibold">{activeLayer.label}</span>
            </span>
            <ChevronDown className={`h-4 w-4 transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
          </button>
          {menuOpen && (
            <div className="max-h-[60vh] overflow-y-auto border-t p-1.5">
              {availableLayers.map((key) => {
                const layer = PLANTING_LAYER_BY_KEY[key]
                return (
                  <button key={key} type="button"
                    onClick={() => { setActiveKey(key); setMenuOpen(false) }}
                    className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-muted ${
                      key === activeKey ? 'bg-emerald-50 font-semibold text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100' : ''
                    }`}>
                    <span className="flex-1">{layer.label}</span>
                    <span className="text-[10px] text-muted-foreground">{layer.unit}</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <div className={`absolute bottom-3 left-3 z-20 rounded-xl border border-white/30 bg-white/95 shadow-lg backdrop-blur-sm dark:bg-slate-950/95 ${
        comparisonMode ? 'w-48 p-2' : 'w-64 p-3'
      }`}>
        <div className="mb-2">
          <p className="text-sm font-semibold">{activeLayer.label}</p>
          <p className="text-[11px] text-muted-foreground">
            {samples.length.toLocaleString('es-MX')} lecturas con valor
          </p>
        </div>
        <div className="space-y-1">
          {classes.map((entry) => {
            const checked = visibleBuckets.has(entry.key)
            return (
              <button key={entry.key} type="button"
                onClick={() => setVisibleBuckets((current) => {
                  const next = new Set(current)
                  if (next.has(entry.key)) next.delete(entry.key)
                  else next.add(entry.key)
                  return next
                })}
                className="flex w-full items-center gap-2 rounded px-1 py-0.5 text-left text-[11px] hover:bg-muted">
                <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[9px] ${
                  checked ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-300'
                }`}>{checked ? '✓' : ''}</span>
                <span className="h-3.5 w-3.5 shrink-0 rounded-sm" style={{ backgroundColor: entry.color }} />
                <span className="truncate">{entry.label}</span>
              </button>
            )
          })}
          {classes.length === 0 && <p className="text-xs text-muted-foreground">Esta variable no tiene datos.</p>}
        </div>
      </div>

      {!comparisonMode && detail && (
        <div className="absolute right-3 top-3 z-20 w-60 rounded-xl border border-white/30 bg-white/95 p-3 text-xs shadow-lg backdrop-blur-sm dark:bg-slate-950/95">
          <p className="font-semibold">Resumen de la siembra</p>
          <div className="mt-2 space-y-1.5">
            <SummaryRow label="Fecha" value={detail.planting_date ?? '—'} />
            <SummaryRow label="Producto" value={detail.source_product ?? '—'} />
            <SummaryRow label="Lote" value={detail.source_lot ?? '—'} />
            <SummaryRow label="Puntos" value={Number(detail.points_count ?? 0).toLocaleString('es-MX')} />
            {numericStats && (
              <SummaryRow label="Promedio"
                value={`${formatPlantingValue(numericStats.average)}${activeLayer.unit ? ` ${activeLayer.unit}` : ''}`} />
            )}
          </div>
        </div>
      )}

      {isLoading && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-background/55">
          <LoadingState label="Preparando mapa de siembra…" />
        </div>
      )}

      {!isLoading && (detailQuery.isError || statsQuery.isError || valuesQuery.isError) && (
        <div className="absolute inset-x-3 bottom-3 z-30 rounded-lg border border-destructive/30 bg-background p-3 text-sm text-destructive shadow">
          No se pudieron cargar los datos de esta sesión de siembra.
        </div>
      )}

      {!isLoading && availableLayers.length === 0 && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/25">
          <div className="rounded-xl bg-background/95 px-5 py-4 text-center shadow-lg">
            <p className="font-semibold">Sin datos de siembra</p>
            <p className="mt-1 text-xs text-muted-foreground">
              La sesión existe, pero todavía no tiene variables importadas.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-t pt-1.5 first:border-t-0 first:pt-0">
      <span className="text-muted-foreground">{label}</span>
      <strong className="max-w-36 text-right">{value}</strong>
    </div>
  )
}
