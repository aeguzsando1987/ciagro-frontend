/**
 * Mapa de monitoreo fitosanitario de una sesión.
 *
 * Modos de visualización:
 *  - Mapa de calor: superficie interpolada clasificada, recortada exactamente al
 *    polígono de la parcela y con puntos visibles al estilo QGIS.
 *  - Punto: marcadores P/E grandes con detalle inspeccionable por punto.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import Map, { Layer, Marker, Source } from 'react-map-gl/maplibre'
import type { MapRef, ViewStateChangeEvent } from 'react-map-gl/maplibre'
import { ChevronDown, ChevronUp, Info } from 'lucide-react'
import { ESRI_STYLE } from '@/features/geodata-visor/lib/aspersionMap.helpers'
import {
  useMapCameraSync,
  type MapCameraSyncBinding,
} from '@/features/geodata-visor/lib/mapCameraSync'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { LoadingState } from '@/components/ui/loading-state'
import { PhytoPointPanel } from './PhytoPointPanel'
import { usePlotGeometry } from '../hooks/usePlotGeometry'
import { usePhytoCheckPoints, type PhytoCheckpointProps } from '../hooks/usePhytoCheckPoints'
import {
  computeDiseaseIndex,
  computePestIndex,
  DISEASE_INDEX_LABEL,
  PEST_INDEX_LABEL,
  PHYTO_INDEX_COLOR,
  type PhytoIndexLevel,
} from '../lib/phytoIndices'
import { buildPhytoHeatSurface, type PhytoHeatPoint } from '../lib/phytoHeatSurface'

interface PhytoMapProps {
  /** UUID del PhytoMonitoringHeader. */
  sessionId: string
  plotId: string | null
  enabled?: boolean
  toolbarStart?: React.ReactNode
  toolbarEnd?: React.ReactNode
  /**
   * `false` (default): toolbar en una barra superior en flujo (modo modal).
   * `true`: toolbar flotante transparente sobre el mapa (visor de datos).
   */
  floatingToolbar?: boolean
  /** Columna derecha sobre el mapa (p. ej. panel de sesiones + tarjeta de stats). */
  sessionsSlot?: React.ReactNode
  /** En comparación A/B separa las leyendas P y E a lados opuestos. */
  comparisonMode?: boolean
  mapSync?: MapCameraSyncBinding
}

function bboxFromCoords(coords: number[][]): [number, number, number, number] {
  const lngs = coords.map((c) => c[0] as number)
  const lats = coords.map((c) => c[1] as number)
  return [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)]
}

const PRESENCE_COLOR: Record<string, string> = {
  low: '#10b981',
  warning: '#f59e0b',
  critical: '#dc2626',
}

const HEALTHY_GREEN = '#15803d'
const PRESENCE_LABEL: Record<string, string> = {
  low: 'Baja',
  warning: 'Advertencia',
  critical: 'Crítica',
}

const PRESENCE_HELP: { label: string; color: string; text: string }[] = [
  {
    label: 'Crítica',
    color: '#dc2626',
    text: 'Se hicieron hallazgos por arriba de la tolerancia permitida para una o más plagas/enfermedades.',
  },
  {
    label: 'Advertencia',
    color: '#f59e0b',
    text: 'Los hallazgos de plagas/enfermedades están cerca o por encima del umbral esperado.',
  },
  {
    label: 'Baja / Sin monitorear',
    color: HEALTHY_GREEN,
    text: 'No se hicieron hallazgos relevantes o no se monitoreó la zona. Se asume sanidad, pero se recomienda una segunda revisión.',
  },
]

const LEVEL_RANK: Record<PhytoIndexLevel, number> = {
  none: 0,
  low: 1,
  medium: 2,
  high: 3,
}

function worstIndexLevel(a: PhytoIndexLevel, b: PhytoIndexLevel): PhytoIndexLevel {
  return LEVEL_RANK[a] >= LEVEL_RANK[b] ? a : b
}

function indexLevelToPresence(level: PhytoIndexLevel): 'low' | 'warning' | 'critical' {
  if (level === 'high') return 'critical'
  if (level === 'medium') return 'warning'
  return 'low'
}

function markerScaleForZoom(zoom: number): number {
  if (zoom <= 10) return 0.34
  if (zoom <= 12) return 0.42
  if (zoom <= 14) return 0.55
  if (zoom <= 16) return 0.72
  if (zoom <= 18) return 0.9
  return 1
}

const CIRCLE_COLOR = [
  'match',
  ['get', 'presence_status'],
  'critical',
  PRESENCE_COLOR.critical,
  'warning',
  PRESENCE_COLOR.warning,
  'low',
  PRESENCE_COLOR.low,
  '#94a3b8',
] as unknown[]

const PROBLEM_RADIUS_M = 7.5
const PROBLEM_AREA_M2 = Math.PI * PROBLEM_RADIUS_M ** 2
const PHYTO_HEAT_INDEX_STORAGE_KEY = 'ciagro:phyto:heat-index'

function initialHeatIndex(): 'pest' | 'disease' {
  if (typeof window === 'undefined') return 'pest'
  try {
    return window.sessionStorage.getItem(PHYTO_HEAT_INDEX_STORAGE_KEY) === 'disease'
      ? 'disease'
      : 'pest'
  } catch {
    return 'pest'
  }
}

function fmtHa(m2: number): string {
  return `${(m2 / 10000).toLocaleString('es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ha`
}

function pctOf(part: number, total: number): string {
  if (!total) return '0%'
  return `${Math.round((part / total) * 100)}%`
}

function polygonAreaM2(ring: number[][]): number {
  if (ring.length < 3) return 0
  const lat0 = ring.reduce((sum, point) => sum + (point[1] ?? 0), 0) / ring.length
  const metersLat = 111320
  const metersLng = 111320 * Math.cos((lat0 * Math.PI) / 180)
  let area = 0
  for (let i = 0; i < ring.length - 1; i++) {
    const x1 = (ring[i]![0] ?? 0) * metersLng
    const y1 = (ring[i]![1] ?? 0) * metersLat
    const x2 = (ring[i + 1]![0] ?? 0) * metersLng
    const y2 = (ring[i + 1]![1] ?? 0) * metersLat
    area += x1 * y2 - x2 * y1
  }
  return Math.abs(area) / 2
}

function circlePolygon(lng: number, lat: number, radiusM: number, steps = 24): number[][] {
  const dLat = radiusM / 111320
  const dLng = radiusM / (111320 * Math.cos((lat * Math.PI) / 180))
  const ring: number[][] = []
  for (let i = 0; i <= steps; i++) {
    const theta = (i / steps) * 2 * Math.PI
    ring.push([lng + dLng * Math.cos(theta), lat + dLat * Math.sin(theta)])
  }
  return ring
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function pestHeatValue(qty: number, tolerance: number, level: PhytoIndexLevel): number {
  if (level === 'none' || qty <= 0) return 0.08

  const normalizedTolerance = Math.max(1, Math.trunc(tolerance || 1))
  const ratio = qty / normalizedTolerance
  let value = 0

  if (ratio <= 1) value = 0.16 + ratio * 0.20
  else if (ratio <= 2) value = 0.36 + (ratio - 1) * 0.30
  else value = 0.66 + Math.min(ratio - 2, 2) * 0.16

  const floorByLevel: Record<PhytoIndexLevel, number> = {
    none: 0.08,
    low: 0.28,
    medium: 0.62,
    high: 0.88,
  }

  return clamp01(Math.max(value, floorByLevel[level]))
}

function diseaseHeatValue(level: PhytoIndexLevel): number {
  const valueByLevel: Record<PhytoIndexLevel, number> = {
    none: 0.08,
    low: 0.38,
    medium: 0.66,
    high: 0.92,
  }
  return valueByLevel[level]
}


type HoverInfo = {
  lon: number
  lat: number
  items: PhytoCheckpointProps[]
  pointNumber: number
  pestQty: number
  pestTolerance: number
  pestLevel: PhytoIndexLevel
  diseaseLevel: PhytoIndexLevel
}

export function PhytoMap({
  sessionId,
  plotId,
  enabled = true,
  toolbarStart,
  toolbarEnd,
  floatingToolbar = false,
  sessionsSlot,
  comparisonMode = false,
  mapSync,
}: PhytoMapProps) {
  const { data: fc, isLoading } = usePhytoCheckPoints(sessionId, enabled)
  const { data: plot } = usePlotGeometry(plotId)
  const mapRef = useRef<MapRef>(null)
  const handleCameraMove = useMapCameraSync(mapRef, mapSync)
  const [popup, setPopup] = useState<HoverInfo | null>(null)
  const [photoModal, setPhotoModal] = useState<string | null>(null)
  const [noteModal, setNoteModal] = useState<string | null>(null)
  const [renderMode, setRenderMode] = useState<'heat' | 'disc'>('disc')
  const [heatIndex, setHeatIndex] = useState<'pest' | 'disease'>(initialHeatIndex)
  const [showInfo, setShowInfo] = useState(false)
  const [legendCollapsed, setLegendCollapsed] = useState(false)
  const [mapZoom, setMapZoom] = useState(18)

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      window.sessionStorage.setItem(PHYTO_HEAT_INDEX_STORAGE_KEY, heatIndex)
    } catch {
      // El visor sigue funcionando aunque el navegador bloquee storage.
    }
  }, [heatIndex])


  const plotGeojson = plot?.geometry
  const plotRing = plot?.geometry?.coordinates?.[0] as number[][] | undefined

  const { groups, pointsFC, indexMarkers } = useMemo(() => {
    type GroupData = {
      items: PhytoCheckpointProps[]
      coords: [number, number]
      pcpOid: number | null
    }

    const grouped: Record<string, GroupData> = {}
    if (fc) {
      for (const feature of fc.features) {
        const pcpOid = feature.properties.pcp_oid ?? null
        const coords = feature.geometry.coordinates
        const key = pcpOid != null ? `oid:${pcpOid}` : `coord:${coords.join(',')}`
        const group = (grouped[key] ??= { items: [], coords, pcpOid })
        group.items.push(feature.properties)
      }
    }

    const pestTolerance = fc?.pest_tolerance ?? 1
    const entries = Object.entries(grouped)

    const rawMarkers = entries.map(([key, group]) => {
      const pest = computePestIndex(group.items, pestTolerance)
      const diseaseLevel = computeDiseaseIndex(group.items)
      const worstLevel = worstIndexLevel(pest.level, diseaseLevel)
      return {
        key,
        coords: group.coords,
        items: group.items,
        pointNumber: group.pcpOid,
        pestQty: pest.qty,
        pestLevel: pest.level,
        diseaseLevel,
        worstLevel,
        pestHeatValue: pestHeatValue(pest.qty, pestTolerance, pest.level),
        diseaseHeatValue: diseaseHeatValue(diseaseLevel),
      }
    })

    const problemFeatures = rawMarkers
      .filter((marker) => marker.worstLevel === 'medium' || marker.worstLevel === 'high')
      .map((marker) => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: marker.coords },
        properties: {
          key: marker.key,
          presence_status: indexLevelToPresence(marker.worstLevel),
          count: marker.items.length,
        },
      }))

    rawMarkers.sort((a, b) => {
      if (a.pointNumber == null && b.pointNumber == null) return a.key.localeCompare(b.key)
      if (a.pointNumber == null) return 1
      if (b.pointNumber == null) return -1
      return a.pointNumber - b.pointNumber
    })

    const markers = rawMarkers.map((marker, index) => ({
      ...marker,
      displayNumber: marker.pointNumber ?? index + 1,
    }))

    const simpleGroups = Object.fromEntries(
      entries.map(([key, group]) => [key, group.items])
    ) as Record<string, PhytoCheckpointProps[]>

    return {
      groups: simpleGroups,
      pointsFC: {
        type: 'FeatureCollection' as const,
        features: problemFeatures,
      },
      indexMarkers: markers,
    }
  }, [fc])

  const heatSourcePoints = useMemo<PhytoHeatPoint[]>(() => {
    return indexMarkers.map((marker) => ({
      lon: marker.coords[0],
      lat: marker.coords[1],
      value: heatIndex === 'pest' ? marker.pestHeatValue : marker.diseaseHeatValue,
    }))
  }, [indexMarkers, heatIndex])

  const heatSurface = useMemo(() => {
    if (!plotRing || heatSourcePoints.length === 0) return null
    return buildPhytoHeatSurface(heatSourcePoints, plotRing)
  }, [heatSourcePoints, plotRing])

  const discsFC = useMemo(
    () => ({
      type: 'FeatureCollection' as const,
      features: pointsFC.features.map((feature) => {
        const [lng, lat] = feature.geometry.coordinates as [number, number]
        return {
          type: 'Feature' as const,
          geometry: {
            type: 'Polygon' as const,
            coordinates: [circlePolygon(lng, lat, PROBLEM_RADIUS_M)],
          },
          properties: { presence_status: feature.properties.presence_status },
        }
      }),
    }),
    [pointsFC]
  )

  const surface = useMemo(() => {
    const parcelArea = plotRing ? polygonAreaM2(plotRing) : 0
    if (parcelArea <= 0) return { parcela: 0, problem: 0, healthy: 0 }

    if (heatSurface) {
      const problem = parcelArea * heatSurface.problemFraction
      const healthy = Math.max(parcelArea - problem, 0)
      return { parcela: parcelArea, problem, healthy }
    }

    const problemRaw = pointsFC.features.length * PROBLEM_AREA_M2
    const problem = Math.min(problemRaw, parcelArea)
    const healthy = Math.max(parcelArea - problem, 0)
    return { parcela: parcelArea, problem, healthy }
  }, [plotRing, heatSurface, pointsFC])

  const mapBounds = useMemo<[number, number, number, number] | null>(() => {
    const plotCoords = plot?.geometry?.coordinates?.[0]
    if (plotCoords && plotCoords.length > 0) return bboxFromCoords(plotCoords as number[][])
    if (fc && fc.features.length > 0) {
      return bboxFromCoords(fc.features.map((feature) => feature.geometry.coordinates))
    }
    return null
  }, [plot, fc])

  useEffect(() => {
    if (!mapRef.current || !mapBounds) return
    mapRef.current.fitBounds(mapBounds, {
      padding: 56,
      duration: 600,
      maxZoom: 18,
    })
  }, [mapBounds])

  const isEmpty = !isLoading && fc && fc.features.length === 0

  function openPointPopup(marker: (typeof indexMarkers)[number]) {
    setPopup({
      lon: marker.coords[0],
      lat: marker.coords[1],
      items: groups[marker.key] ?? marker.items,
      pointNumber: marker.displayNumber,
      pestQty: marker.pestQty,
      pestTolerance: fc?.pest_tolerance ?? 1,
      pestLevel: marker.pestLevel,
      diseaseLevel: marker.diseaseLevel,
    })
  }

  function handleRenderModeChange(mode: 'heat' | 'disc') {
    setRenderMode(mode)
    setPopup(null)
  }

  function handleMapMove(event: ViewStateChangeEvent) {
    const nextZoom = event.viewState.zoom
    setMapZoom((current) => (Math.abs(current - nextZoom) >= 0.02 ? nextZoom : current))
    if (mapSync) handleCameraMove(event)
  }

  const markerScale = markerScaleForZoom(mapZoom)

  return (
    <div className="flex h-full flex-col">
      {!floatingToolbar && (toolbarStart || toolbarEnd) && (
        <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
          <div className="flex items-center gap-2">{toolbarStart}</div>
          <div className="flex items-center gap-2">{toolbarEnd}</div>
        </div>
      )}

      <div className="relative flex-1">
        {floatingToolbar && (toolbarStart || toolbarEnd) && (
          <div className="absolute left-2 top-2 z-20 flex flex-wrap items-center gap-2">
            {toolbarStart}
            {toolbarEnd}
          </div>
        )}

        {sessionsSlot && (
          <div className="absolute bottom-2 right-2 top-2 z-10 flex w-56 flex-col gap-2">
            {sessionsSlot}
          </div>
        )}

        {isLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 text-sm text-muted-foreground">
            <LoadingState
              compact
              label="Cargando puntos fitosanitarios…"
              className="rounded-xl border border-default bg-white/95 shadow-sm"
            />
          </div>
        )}
        {isEmpty && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 text-sm text-muted-foreground">
            Esta sesión aún no tiene puntos capturados.
          </div>
        )}

        <div
          className={`absolute z-10 rounded-xl border border-white/80 bg-white/90 text-xs shadow-lg backdrop-blur-md transition-all ${
            sessionsSlot ? 'bottom-2 left-2' : 'right-2 top-2'
          } ${legendCollapsed ? 'px-2 py-1.5' : 'px-3 py-2'}`}
        >
          <div
            className={`flex items-center justify-between gap-2 ${legendCollapsed ? '' : 'mb-1'}`}
          >
            <div className="flex items-center gap-1.5">
              <p className="font-medium">Presencia</p>
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground">
                {renderMode === 'heat'
                  ? heatIndex === 'pest'
                    ? 'Calor · Plagas'
                    : 'Calor · Enfermedades'
                  : 'Punto'}
              </span>
              {!legendCollapsed && (
                <button
                  type="button"
                  aria-label="Cómo interpretar cada color"
                  aria-expanded={showInfo}
                  onClick={() => setShowInfo((state) => !state)}
                  className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors duration-150 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 ${
                    showInfo ? 'text-brand' : 'text-muted-foreground'
                  }`}
                >
                  <Info className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <button
              type="button"
              aria-label={
                legendCollapsed ? 'Expandir panel de presencia' : 'Contraer panel de presencia'
              }
              aria-expanded={!legendCollapsed}
              onClick={() => {
                setLegendCollapsed((value) => !value)
                setShowInfo(false)
              }}
              className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
            >
              {legendCollapsed ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          </div>

          {!legendCollapsed && (
            <>
              {showInfo && (
                <div className="mb-1.5 w-52 space-y-1.5 rounded border bg-background/95 p-2">
                  {PRESENCE_HELP.map((help) => (
                    <div key={help.label} className="flex gap-1.5">
                      <span
                        className="mt-0.5 inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: help.color }}
                      />
                      <p className="text-[11px] leading-snug">
                        <span className="font-medium">{help.label}:</span>{' '}
                        <span className="text-muted-foreground">{help.text}</span>
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {(['critical', 'warning'] as const).map((key) => (
                <div key={key} className="flex items-center gap-1.5">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: PRESENCE_COLOR[key] }}
                  />
                  <span className="text-muted-foreground">{PRESENCE_LABEL[key]}</span>
                </div>
              ))}
              <div className="flex items-center gap-1.5">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: HEALTHY_GREEN }}
                />
                <span className="text-muted-foreground">Baja / Sin monitorear</span>
              </div>

              {surface.parcela > 0 && (
                <div className="mt-2 space-y-0.5 border-t pt-1.5">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Superficie estimada
                  </p>
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-1.5">
                      <span
                        className="inline-block h-2 w-2 rounded-full"
                        style={{ backgroundColor: PRESENCE_COLOR.critical }}
                      />
                      Con problemas
                    </span>
                    <span className="font-medium tabular-nums">
                      {fmtHa(surface.problem)} ({pctOf(surface.problem, surface.parcela)})
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-1.5">
                      <span
                        className="inline-block h-2 w-2 rounded-full"
                        style={{ backgroundColor: HEALTHY_GREEN }}
                      />
                      Baja / sin monitoreo
                    </span>
                    <span className="font-medium tabular-nums">
                      {fmtHa(surface.healthy)} ({pctOf(surface.healthy, surface.parcela)})
                    </span>
                  </div>
                </div>
              )}

              <div className="mt-2 border-t pt-1.5">
                <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Visualización
                </p>
                <div className="flex overflow-hidden rounded border">
                  {(
                    [
                      ['heat', 'Mapa de calor'],
                      ['disc', 'Punto'],
                    ] as const
                  ).map(([mode, label]) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => handleRenderModeChange(mode)}
                      className={`flex-1 px-2 py-0.5 text-[11px] transition-colors duration-150 ${
                        renderMode === mode
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-background hover:bg-accent'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {renderMode === 'heat' && (
                <div className="mt-2 border-t pt-1.5">
                  <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Índice de calor
                  </p>
                  <div className="flex overflow-hidden rounded border">
                    <button
                      type="button"
                      onClick={() => setHeatIndex('pest')}
                      className={`flex-1 px-2 py-0.5 text-[11px] transition-colors duration-150 ${
                        heatIndex === 'pest'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-background hover:bg-accent'
                      }`}
                    >
                      Plagas
                    </button>
                    <button
                      type="button"
                      onClick={() => setHeatIndex('disease')}
                      className={`flex-1 px-2 py-0.5 text-[11px] transition-colors duration-150 ${
                        heatIndex === 'disease'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-background hover:bg-accent'
                      }`}
                    >
                      Enfermedades
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {renderMode === 'disc' &&
          !popup &&
          (comparisonMode ? (
            <>
              <div className="absolute bottom-2 left-2 z-10 hidden w-44 rounded-xl border bg-background/95 p-3 text-xs shadow-md backdrop-blur-sm lg:block">
                <p className="mb-2 font-bold text-foreground">Índice P · Plagas</p>
                {(['none', 'low', 'medium', 'high'] as const).map((level) => (
                  <div key={`legend-p-${level}`} className="flex items-center gap-2 py-0.5">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: PHYTO_INDEX_COLOR[level] }}
                    />
                    <span className="text-muted-foreground">{PEST_INDEX_LABEL[level]}</span>
                  </div>
                ))}
              </div>

              <div className="absolute bottom-2 right-2 z-10 hidden w-44 rounded-xl border bg-background/95 p-3 text-xs shadow-md backdrop-blur-sm lg:block">
                <p className="mb-2 font-bold text-foreground">Índice E · Enfermedades</p>
                {(['none', 'low', 'medium', 'high'] as const).map((level) => (
                  <div key={`legend-e-${level}`} className="flex items-center gap-2 py-0.5">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: PHYTO_INDEX_COLOR[level] }}
                    />
                    <span className="text-muted-foreground">{DISEASE_INDEX_LABEL[level]}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="absolute bottom-2 right-2 z-10 hidden w-52 flex-col gap-2 lg:flex">
              <div className="rounded-xl border bg-background/95 p-3 text-xs shadow-md backdrop-blur-sm">
                <p className="mb-2 font-bold text-foreground">Índice P · Plagas</p>
                {(['none', 'low', 'medium', 'high'] as const).map((level) => (
                  <div key={`legend-p-${level}`} className="flex items-center gap-2 py-0.5">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: PHYTO_INDEX_COLOR[level] }}
                    />
                    <span className="text-muted-foreground">{PEST_INDEX_LABEL[level]}</span>
                  </div>
                ))}
              </div>
              <div className="rounded-xl border bg-background/95 p-3 text-xs shadow-md backdrop-blur-sm">
                <p className="mb-2 font-bold text-foreground">Índice E · Enfermedades</p>
                {(['none', 'low', 'medium', 'high'] as const).map((level) => (
                  <div key={`legend-e-${level}`} className="flex items-center gap-2 py-0.5">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: PHYTO_INDEX_COLOR[level] }}
                    />
                    <span className="text-muted-foreground">{DISEASE_INDEX_LABEL[level]}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}

        <Map
          ref={mapRef}
          onMove={handleMapMove}
          initialViewState={
            mapBounds
              ? {
                  bounds: mapBounds,
                  fitBoundsOptions: { padding: 56, maxZoom: 18 },
                }
              : { longitude: -101, latitude: 20.5, zoom: 6 }
          }
          maxZoom={20}
          mapStyle={ESRI_STYLE}
          attributionControl={false}
          onClick={() => setPopup(null)}
          style={{ width: '100%', height: '100%' }}
        >
          {renderMode === 'heat' && heatSurface && (
            <Source
              id="phyto-heat-surface"
              type="image"
              url={heatSurface.dataUrl}
              coordinates={heatSurface.coordinates}
            >
              <Layer
                id="phyto-heat-surface-raster"
                type="raster"
                paint={{
                  'raster-opacity': 0.88,
                  'raster-resampling': 'nearest',
                  'raster-fade-duration': 0,
                }}
              />
            </Source>
          )}

          {plotGeojson && (
            <Source id="plot" type="geojson" data={plotGeojson}>
              <Layer
                id="plot-fill"
                type="fill"
                paint={{
                  'fill-color': HEALTHY_GREEN,
                  'fill-opacity': renderMode === 'heat' ? 0.02 : 0.32,
                }}
              />
              <Layer
                id="plot-line-halo"
                type="line"
                paint={{ 'line-color': 'rgba(255,255,255,0.94)', 'line-width': 5 }}
              />
              <Layer
                id="plot-line"
                type="line"
                paint={{ 'line-color': '#166534', 'line-width': 3 }}
              />
            </Source>
          )}

          {renderMode === 'disc' && discsFC.features.length > 0 && (
            <Source id="cp-disc-src" type="geojson" data={discsFC}>
              <Layer
                id="cp-disc-fill"
                type="fill"
                paint={{
                  'fill-color': CIRCLE_COLOR as never,
                  'fill-opacity': 0.55,
                }}
              />
              <Layer
                id="cp-disc-line"
                type="line"
                paint={{
                  'line-color': CIRCLE_COLOR as never,
                  'line-width': 1.2,
                  'line-opacity': 0.9,
                }}
              />
            </Source>
          )}

          {renderMode === 'disc' &&
            indexMarkers.map((marker) => (
              <Marker
                key={marker.key}
                longitude={marker.coords[0]}
                latitude={marker.coords[1]}
                anchor="center"
              >
                <div
                  className="transition-transform duration-150"
                  style={{ transform: `scale(${markerScale})`, transformOrigin: 'center' }}
                >
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation()
                      openPointPopup(marker)
                    }}
                    aria-label={`Punto ${marker.displayNumber}. P: ${PEST_INDEX_LABEL[marker.pestLevel]}. E: ${DISEASE_INDEX_LABEL[marker.diseaseLevel]}.`}
                    title={`P ${PEST_INDEX_LABEL[marker.pestLevel]} · E ${DISEASE_INDEX_LABEL[marker.diseaseLevel]}`}
                    className={`group relative h-10 w-10 rounded-full transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 ${
                      popup?.pointNumber === marker.displayNumber ? 'scale-110' : ''
                    }`}
                  >
                    <span className="pointer-events-none absolute -top-4 left-1/2 flex -translate-x-1/2 gap-2 rounded bg-white/90 px-1 text-[9px] font-bold leading-3 text-slate-800 shadow-sm">
                      <span>P</span>
                      <span>E</span>
                    </span>
                    <span
                      className={`pointer-events-none absolute inset-0 overflow-hidden rounded-full border-[3px] shadow-lg transition-transform group-hover:scale-110 ${
                        popup?.pointNumber === marker.displayNumber
                          ? 'border-white ring-2 ring-brand/70 ring-offset-1'
                          : 'border-white'
                      }`}
                      style={{
                        background: `linear-gradient(90deg, ${PHYTO_INDEX_COLOR[marker.pestLevel]} 0 50%, ${PHYTO_INDEX_COLOR[marker.diseaseLevel]} 50% 100%)`,
                      }}
                    >
                      <span className="absolute bottom-0 left-1/2 top-0 w-px -translate-x-1/2 bg-white/80" />
                    </span>
                    <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-[11px] font-bold text-white drop-shadow-md">
                      {marker.displayNumber}
                    </span>
                  </button>
                </div>
              </Marker>
            ))}
        </Map>

        {popup && popup.items.length > 0 && (
          <PhytoPointPanel
            pointNumber={popup.pointNumber}
            items={popup.items}
            pestQty={popup.pestQty}
            pestTolerance={popup.pestTolerance}
            pestLevel={popup.pestLevel}
            diseaseLevel={popup.diseaseLevel}
            lon={popup.lon}
            lat={popup.lat}
            hasSessionsSlot={Boolean(sessionsSlot)}
            onClose={() => setPopup(null)}
            onOpenPhoto={setPhotoModal}
            onOpenNote={setNoteModal}
          />
        )}
      </div>

      <Dialog
        open={!!photoModal}
        onOpenChange={(open) => {
          if (!open) setPhotoModal(null)
        }}
      >
        <DialogContent className="max-w-3xl p-2">
          <DialogTitle className="sr-only">Foto del hallazgo</DialogTitle>
          {photoModal && (
            <img
              src={photoModal}
              alt="Foto del hallazgo"
              className="max-h-[80vh] w-full rounded object-contain"
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!noteModal}
        onOpenChange={(open) => {
          if (!open) setNoteModal(null)
        }}
      >
        <DialogContent className="max-w-md">
          <DialogTitle>Nota del hallazgo</DialogTitle>
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">{noteModal}</p>
        </DialogContent>
      </Dialog>
    </div>
  )
}
