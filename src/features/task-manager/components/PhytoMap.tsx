/**
 * Mapa de monitoreo fitosanitario de una sesión — símil del mapa de aspersión.
 *
 * Sobre la imagen satelital ESRI pinta:
 *  - El polígono de la parcela relleno en VERDE (área sana base).
 *  - Un mapa de calor ROJO sobre los checkpoints con problema (presence_status
 *    'warning' + 'critical', ponderado: crítica pesa más; 'low' no aporta calor).
 *  - Un marcador por checkpoint (color por presencia) inspeccionable con popup.
 *
 * Carga sus propios datos a partir de `sessionId` (header) + `plotId`.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import Map, { Layer, Source, Marker } from 'react-map-gl/maplibre'
import type { MapRef } from 'react-map-gl/maplibre'
import { Info } from 'lucide-react'
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
// Verde del área sana / no muestreada de la parcela. En sesiones fitosanitarias el
// relleno se pinta con este verde intenso (baja tenuidad) porque es el estado base del
// mapa (los puntos con peligro se pintan encima en rojo/ámbar).
const HEALTHY_GREEN = '#15803d'
const PRESENCE_LABEL: Record<string, string> = {
  low: 'Baja',
  warning: 'Advertencia',
  critical: 'Crítica',
}

// Guía de interpretación de cada color (panel del icono (i) en la leyenda).
const PRESENCE_HELP: { label: string; color: string; text: string }[] = [
  {
    label: 'Crítica',
    color: '#dc2626',
    text: 'Se hicieron hallazgos por arriba de la tolerancia permitida para una o más plagas/enfermedades.',
  },
  {
    label: 'Advertencia',
    color: '#f59e0b',
    text: 'Los hallazgos de plagas/enfermedades están peligrosamente cerca del umbral de tolerancia.',
  },
  {
    label: 'Baja / Sin monitorear',
    color: HEALTHY_GREEN,
    text: 'No se hicieron hallazgos relevantes o no se monitoreó la zona. Se asume sanidad, pero se recomienda hacer una segunda revisión.',
  },
]

// Capa de calor: solo advertencia/crítica aportan (crítica pesa más).
const HEAT_WEIGHT = [
  'match',
  ['get', 'presence_status'],
  'critical',
  1,
  'warning',
  0.7,
  0,
] as unknown[]

// Rampa intensa SIN halo blanquecino: se mantiene el mismo tono rojo en toda la
// rampa y solo varía la opacidad, de modo que el borde de baja densidad se desvanece
// en rojo translúcido (no en un rosa/blanco pálido).
const HEAT_COLOR = [
  'interpolate',
  ['linear'],
  ['heatmap-density'],
  0,
  'rgba(220,38,38,0)',
  0.2,
  'rgba(220,38,38,0.35)',
  0.5,
  'rgba(220,38,38,0.7)',
  0.8,
  'rgba(200,20,20,0.9)',
  1,
  'rgba(153,27,27,1)',
] as unknown[]

// Color del marcador según presencia.
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

// Prioridad de presencia para elegir la "peor" de un punto con varios hallazgos.
const PRESENCE_RANK: Record<string, number> = {
  low: 0,
  warning: 1,
  critical: 2,
}

// ── Modos de pintado de las manchas ────────────────────────────────────────────
// 'heat' (Opción A): capa heatmap con radio en píxeles PERO dependiente del zoom, de
//   modo que la mancha crece/encoge al hacer zoom (≈ tamaño geográfico constante).
//   El radio se duplica ~por nivel de zoom (base exponencial 2), como lo geográfico.
// 'disc' (Opción B): polígonos circulares REALES (en metros) alrededor de cada punto;
//   escalan idénticamente al polígono de la parcela. Sin efecto difuminado.
const HEAT_RADIUS = [
  'interpolate',
  ['exponential', 2],
  ['zoom'],
  10,
  3,
  14,
  12,
  16,
  24,
  18,
  48,
  20,
  120,
  22,
  320,
] as unknown[]

// Radio geográfico FIJO (metros) de la mancha/disco de cada punto con peligro. Fijo (no
// variable por conteo) para poder traducir el nº de puntos a superficie de forma inequívoca.
const PROBLEM_RADIUS_M = 7.5
// Superficie (m²) que cubre una mancha de radio fijo.
const PROBLEM_AREA_M2 = Math.PI * PROBLEM_RADIUS_M ** 2

// Formato de superficie: siempre en hectáreas (2 decimales).
function fmtHa(m2: number): string {
  return `${(m2 / 10000).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ha`
}
function pctOf(part: number, total: number): string {
  if (!total) return '0%'
  return `${Math.round((part / total) * 100)}%`
}

// Área (m²) de un anillo poligonal [lng,lat] por proyección planar local (equirectangular
// alrededor de la latitud media). Suficientemente preciso para parcelas pequeñas.
function polygonAreaM2(ring: number[][]): number {
  if (ring.length < 3) return 0
  const lat0 = ring.reduce((s, p) => s + (p[1] ?? 0), 0) / ring.length
  const mLat = 111320
  const mLng = 111320 * Math.cos((lat0 * Math.PI) / 180)
  let area = 0
  for (let i = 0; i < ring.length - 1; i++) {
    const x1 = (ring[i]![0] ?? 0) * mLng,
      y1 = (ring[i]![1] ?? 0) * mLat
    const x2 = (ring[i + 1]![0] ?? 0) * mLng,
      y2 = (ring[i + 1]![1] ?? 0) * mLat
    area += x1 * y2 - x2 * y1
  }
  return Math.abs(area) / 2
}

// Polígono ~circular (24 vértices) de `radiusM` metros alrededor de [lng, lat].
// Conversión metros→grados: lat constante; lng corregido por el coseno de la latitud.
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
  mapSync,
}: PhytoMapProps) {
  const { data: fc, isLoading } = usePhytoCheckPoints(sessionId, enabled)
  const { data: plot } = usePlotGeometry(plotId)
  const mapRef = useRef<MapRef>(null)
  const handleCameraMove = useMapCameraSync(mapRef, mapSync)
  const [popup, setPopup] = useState<HoverInfo | null>(null)
  const [photoModal, setPhotoModal] = useState<string | null>(null)
  const [noteModal, setNoteModal] = useState<string | null>(null)
  // Modo de pintado de las manchas: 'heat' (difuminado) vs 'disc' (círculos geográficos).
  const [renderMode, setRenderMode] = useState<'heat' | 'disc'>('heat')
  // Panel de ayuda (icono (i) de la leyenda) con la interpretación de cada color.
  const [showInfo, setShowInfo] = useState(false)

  const plotGeojson = plot?.geometry

  // Agrupa por pcp_oid cuando existe (es el identificador del punto de la app móvil)
  // y cae a coordenada para capturas antiguas. Así varias plagas/enfermedades del mismo
  // punto comparten un único marcador P/E, sin perder la lógica original de Presencia.
  const { groups, pointsFC, indexMarkers } = useMemo(() => {
    type GroupData = {
      items: PhytoCheckpointProps[]
      coords: [number, number]
      pcpOid: number | null
    }

    const grouped: Record<string, GroupData> = {}
    if (fc) {
      for (const f of fc.features) {
        const pcpOid = f.properties.pcp_oid ?? null
        const coords = f.geometry.coordinates
        const key = pcpOid != null ? `oid:${pcpOid}` : `coord:${coords.join(',')}`
        const group = (grouped[key] ??= { items: [], coords, pcpOid })
        group.items.push(f.properties)
      }
    }

    const pestTolerance = fc?.pest_tolerance ?? 1
    const entries = Object.entries(grouped)

    // Esta colección conserva EXACTAMENTE la semántica anterior del mapa: únicamente
    // warning/critical alimentan discos, superficie con problemas y la leyenda Presencia.
    const problemFeatures = entries
      .map(([key, group]) => ({
        key,
        group,
        worst: Math.max(...group.items.map((i) => PRESENCE_RANK[i.presence_status] ?? 0)),
      }))
      .filter((x) => x.worst >= 1)
      .map((x) => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: x.group.coords },
        properties: {
          key: x.key,
          presence_status: x.worst >= 2 ? 'critical' : 'warning',
          count: x.group.items.length,
        },
      }))

    const rawMarkers = entries.map(([key, group]) => {
      const pest = computePestIndex(group.items, pestTolerance)
      const diseaseLevel = computeDiseaseIndex(group.items)
      return {
        key,
        coords: group.coords,
        items: group.items,
        pointNumber: group.pcpOid,
        pestQty: pest.qty,
        pestLevel: pest.level,
        diseaseLevel,
      }
    })

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

  // Opción B: un polígono circular geográfico por punto con peligro (escala con el zoom
  // como la parcela). Deriva de pointsFC; solo se usa en renderMode 'disc'.
  const discsFC = useMemo(
    () => ({
      type: 'FeatureCollection' as const,
      features: pointsFC.features.map((f) => {
        const [lng, lat] = f.geometry.coordinates as [number, number]
        return {
          type: 'Feature' as const,
          geometry: {
            type: 'Polygon' as const,
            coordinates: [circlePolygon(lng, lat, PROBLEM_RADIUS_M)],
          },
          properties: { presence_status: f.properties.presence_status },
        }
      }),
    }),
    [pointsFC]
  )

  // Superficie (m²) traducida desde el nº de puntos con peligro (mancha fija de 7.5 m):
  // problemas = nº puntos × área de mancha (aprox., sin descontar solapes), acotado al
  // área de la parcela; el resto es "baja / sin monitoreo". Da % sobre superficie, no
  // sobre conteo (menos ambiguo).
  const surface = useMemo(() => {
    const ring = plot?.geometry?.coordinates?.[0] as number[][] | undefined
    const parcela = ring ? polygonAreaM2(ring) : 0
    const problemRaw = pointsFC.features.length * PROBLEM_AREA_M2
    const problem = parcela > 0 ? Math.min(problemRaw, parcela) : problemRaw
    const healthy = Math.max(parcela - problem, 0)
    return { parcela, problem, healthy }
  }, [plot, pointsFC])

  const mapBounds = useMemo<[number, number, number, number] | null>(() => {
    const plotCoords = plot?.geometry?.coordinates?.[0]
    if (plotCoords && plotCoords.length > 0) return bboxFromCoords(plotCoords as number[][])
    if (fc && fc.features.length > 0) {
      return bboxFromCoords(fc.features.map((f) => f.geometry.coordinates))
    }
    return null
  }, [plot, fc])

  // Cuando el bbox cambia (e.g. el polígono de la parcela llega después de montar el
  // mapa), volar al nuevo encuadre. `initialViewState` solo aplica al montar, por eso sin
  // este efecto el mapa quedaría en la vista por defecto (muy alejada) si la parcela carga tarde.
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

  return (
    <div className="flex h-full flex-col">
      {!floatingToolbar && (toolbarStart || toolbarEnd) && (
        <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
          <div className="flex items-center gap-2">{toolbarStart}</div>
          <div className="flex items-center gap-2">{toolbarEnd}</div>
        </div>
      )}

      <div className="relative flex-1">
        {/* Toolbar flotante sobre el mapa (modo visor) */}
        {floatingToolbar && (toolbarStart || toolbarEnd) && (
          <div className="absolute left-2 top-2 z-20 flex flex-wrap items-center gap-2">
            {toolbarStart}
            {toolbarEnd}
          </div>
        )}

        {/* Columna derecha (panel de sesiones + tarjeta de stats) */}
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

        {/* Leyenda — abajo-izquierda cuando hay columna de sesiones para no solaparla. */}
        <div
          className={`absolute z-10 rounded border bg-background/90 px-3 py-2 text-xs shadow-sm ${
            sessionsSlot ? 'bottom-2 left-2' : 'right-2 top-2'
          }`}
        >
          <div className="mb-1 flex items-center gap-1">
            <p className="font-medium">Presencia</p>
            <button
              type="button"
              aria-label="Cómo interpretar cada color"
              aria-expanded={showInfo}
              onClick={() => setShowInfo((s) => !s)}
              className={`flex h-10 w-10 items-center justify-center rounded-md transition-colors duration-150 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 ${
                showInfo ? 'text-brand' : 'text-muted-foreground'
              }`}
            >
              <Info className="h-3.5 w-3.5" />
            </button>
          </div>
          {showInfo && (
            <div className="mb-1.5 w-52 space-y-1.5 rounded border bg-background/95 p-2">
              {PRESENCE_HELP.map((h) => (
                <div key={h.label} className="flex gap-1.5">
                  <span
                    className="mt-0.5 inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: h.color }}
                  />
                  <p className="text-[11px] leading-snug">
                    <span className="font-medium">{h.label}:</span>{' '}
                    <span className="text-muted-foreground">{h.text}</span>
                  </p>
                </div>
              ))}
            </div>
          )}
          {(['critical', 'warning'] as const).map((k) => (
            <div key={k} className="flex items-center gap-1.5">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: PRESENCE_COLOR[k] }}
              />
              <span className="text-muted-foreground">{PRESENCE_LABEL[k]}</span>
            </div>
          ))}
          {/* Estado base (verde): puntos de baja presencia + objetivos sin muestrear.
              No se marcan individualmente; corresponden al relleno verde de la parcela. */}
          <div className="flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: HEALTHY_GREEN }}
            />
            <span className="text-muted-foreground">Baja / Sin monitorear</span>
          </div>

          {/* Superficie estimada (mancha fija de 7.5 m por punto): problemas vs baja/sin
              monitoreo, sobre el área de la parcela. */}
          {surface.parcela > 0 && (
            <div className="mt-2 space-y-0.5 border-t pt-1.5">
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Superficie (manchas de {PROBLEM_RADIUS_M} m)
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

          {/* Toggle de comparación: mancha difuminada (heatmap) vs disco geográfico. */}
          <div className="mt-2 border-t pt-1.5">
            <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Visualización
            </p>
            <div className="flex overflow-hidden rounded border">
              {(
                [
                  ['heat', 'Mapa de calor'],
                  ['disc', 'Discos'],
                ] as const
              ).map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setRenderMode(mode)}
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
        </div>

        {/* Leyendas P/E separadas, al estilo de la app móvil. */}
        <div
          className={`absolute bottom-2 z-10 hidden gap-2 lg:flex ${
            sessionsSlot ? 'left-1/2 -translate-x-[42%]' : 'left-1/2 -translate-x-1/2'
          }`}
        >
          <div className="w-52 rounded-xl border bg-background/95 p-3 text-xs shadow-md backdrop-blur-sm">
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
          <div className="w-52 rounded-xl border bg-background/95 p-3 text-xs shadow-md backdrop-blur-sm">
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

        <Map
          ref={mapRef}
          onMove={mapSync ? handleCameraMove : undefined}
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
          {/* Parcela — relleno verde base */}
          {plotGeojson && (
            <Source id="plot" type="geojson" data={plotGeojson}>
              <Layer
                id="plot-fill"
                type="fill"
                paint={{ 'fill-color': HEALTHY_GREEN, 'fill-opacity': 0.32 }}
              />
              {/* Doble contorno: blanco exterior + verde interior. Hace visible el lote
                  sobre imágenes satelitales claras u oscuras sin tapar el cultivo. */}
              <Layer
                id="plot-line-halo"
                type="line"
                paint={{ 'line-color': 'rgba(255,255,255,0.92)', 'line-width': 5 }}
              />
              <Layer
                id="plot-line"
                type="line"
                paint={{ 'line-color': '#166534', 'line-width': 3 }}
              />
            </Source>
          )}

          {/* Opción B — Discos geográficos (metros) por punto con peligro; escalan con el
              zoom idéntico a la parcela. Color por peor presencia del punto. Se declaran
              ANTES de los marcadores para quedar por debajo de ellos. */}
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

          {/* Opción A — Heatmap rojo sobre TODOS los checkpoints con problema (la densidad
              sube donde coinciden varios en un punto). Radio dependiente del zoom → la
              mancha crece/encoge con el zoom, como la parcela. Se declara DESPUÉS de los
              marcadores para que las manchas queden superpuestas a los puntos de datos
              (el clic sigue funcionando: cp-circles es la capa interactiva). */}
          {renderMode === 'heat' && fc && fc.features.length > 0 && (
            <Source id="cp-heat-src" type="geojson" data={fc}>
              <Layer
                id="cp-heat"
                type="heatmap"
                paint={{
                  'heatmap-weight': HEAT_WEIGHT as never,
                  'heatmap-color': HEAT_COLOR as never,
                  'heatmap-radius': HEAT_RADIUS as never,
                  'heatmap-intensity': 1.4,
                  'heatmap-opacity': 1,
                }}
              />
            </Source>
          )}

          {/* Índices P/E estilo app móvil. No reemplazan Presencia ni el heatmap:
              son una lectura adicional por punto. P usa la tolerancia de plagas de la
              sesión; E usa la severidad de enfermedad ya calculada por el backend. */}
          {indexMarkers.map((marker) => (
            <Marker
              key={marker.key}
              longitude={marker.coords[0]}
              latitude={marker.coords[1]}
              anchor="center"
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

      {/* Modal de foto completa */}
      <Dialog
        open={!!photoModal}
        onOpenChange={(o) => {
          if (!o) setPhotoModal(null)
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

      {/* Modal de nota */}
      <Dialog
        open={!!noteModal}
        onOpenChange={(o) => {
          if (!o) setNoteModal(null)
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
