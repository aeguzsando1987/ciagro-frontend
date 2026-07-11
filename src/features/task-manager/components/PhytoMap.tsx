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
import Map, { Layer, Source, Popup } from 'react-map-gl/maplibre'
import type { MapLayerMouseEvent, MapRef } from 'react-map-gl/maplibre'
import { Info } from 'lucide-react'
import { ESRI_STYLE } from '@/features/geodata-visor/lib/aspersionMap.helpers'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { usePlotGeometry } from '../hooks/usePlotGeometry'
import { usePhytoCheckPoints, type PhytoCheckpointProps } from '../hooks/usePhytoCheckPoints'

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
  'match', ['get', 'presence_status'],
  'critical', 1,
  'warning', 0.7,
  0,
] as unknown[]

// Rampa intensa SIN halo blanquecino: se mantiene el mismo tono rojo en toda la
// rampa y solo varía la opacidad, de modo que el borde de baja densidad se desvanece
// en rojo translúcido (no en un rosa/blanco pálido).
const HEAT_COLOR = [
  'interpolate', ['linear'], ['heatmap-density'],
  0, 'rgba(220,38,38,0)',
  0.2, 'rgba(220,38,38,0.35)',
  0.5, 'rgba(220,38,38,0.7)',
  0.8, 'rgba(200,20,20,0.9)',
  1, 'rgba(153,27,27,1)',
] as unknown[]


// Color del marcador según presencia.
const CIRCLE_COLOR = [
  'match', ['get', 'presence_status'],
  'critical', PRESENCE_COLOR.critical,
  'warning', PRESENCE_COLOR.warning,
  'low', PRESENCE_COLOR.low,
  '#94a3b8',
] as unknown[]

// Prioridad de presencia para elegir la "peor" de un punto con varios hallazgos.
const PRESENCE_RANK: Record<string, number> = { low: 0, warning: 1, critical: 2 }

// ── Modos de pintado de las manchas ────────────────────────────────────────────
// 'heat' (Opción A): capa heatmap con radio en píxeles PERO dependiente del zoom, de
//   modo que la mancha crece/encoge al hacer zoom (≈ tamaño geográfico constante).
//   El radio se duplica ~por nivel de zoom (base exponencial 2), como lo geográfico.
// 'disc' (Opción B): polígonos circulares REALES (en metros) alrededor de cada punto;
//   escalan idénticamente al polígono de la parcela. Sin efecto difuminado.
const HEAT_RADIUS = [
  'interpolate', ['exponential', 2], ['zoom'],
  10, 3,
  14, 12,
  16, 24,
  18, 48,
  20, 120,
  22, 320,
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
    const x1 = (ring[i]![0] ?? 0) * mLng, y1 = (ring[i]![1] ?? 0) * mLat
    const x2 = (ring[i + 1]![0] ?? 0) * mLng, y2 = (ring[i + 1]![1] ?? 0) * mLat
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

type HoverInfo = { lon: number; lat: number; items: PhytoCheckpointProps[] }

export function PhytoMap({ sessionId, plotId, enabled = true, toolbarStart, toolbarEnd, floatingToolbar = false, sessionsSlot }: PhytoMapProps) {
  const { data: fc, isLoading } = usePhytoCheckPoints(sessionId, enabled)
  const { data: plot } = usePlotGeometry(plotId)
  const mapRef = useRef<MapRef>(null)
  const [popup, setPopup] = useState<HoverInfo | null>(null)
  const [photoModal, setPhotoModal] = useState<string | null>(null)
  const [noteModal, setNoteModal] = useState<string | null>(null)
  // Modo de pintado de las manchas: 'heat' (difuminado) vs 'disc' (círculos geográficos).
  const [renderMode, setRenderMode] = useState<'heat' | 'disc'>('heat')
  // Panel de ayuda (icono (i) de la leyenda) con la interpretación de cada color.
  const [showInfo, setShowInfo] = useState(false)

  const plotGeojson = plot?.geometry

  // Agrupa los checkpoints por coordenada: en un mismo punto puede haber varias
  // plagas/enfermedades. `pointsFC` tiene un marcador por punto CON peligro (peor
  // presencia del grupo); `groups` guarda todos los hallazgos por punto para el popup.
  // (Objeto plano, no `Map`, porque `Map` está sombreado por react-map-gl.)
  const { groups, pointsFC } = useMemo(() => {
    const g: Record<string, PhytoCheckpointProps[]> = {}
    if (fc) {
      for (const f of fc.features) {
        const key = f.geometry.coordinates.join(',')
        ;(g[key] ??= []).push(f.properties)
      }
    }
    const features = Object.entries(g)
      .map(([key, items]) => ({
        key,
        items,
        worst: Math.max(...items.map((i) => PRESENCE_RANK[i.presence_status] ?? 0)),
      }))
      .filter((x) => x.worst >= 1) // solo puntos con peligro
      .map((x) => {
        const parts = x.key.split(',').map(Number)
        return {
          type: 'Feature' as const,
          geometry: { type: 'Point' as const, coordinates: [parts[0] ?? 0, parts[1] ?? 0] },
          properties: {
            key: x.key,
            presence_status: x.worst >= 2 ? 'critical' : 'warning',
            count: x.items.length,
          },
        }
      })
    return { groups: g, pointsFC: { type: 'FeatureCollection' as const, features } }
  }, [fc])

  // Opción B: un polígono circular geográfico por punto con peligro (escala con el zoom
  // como la parcela). Deriva de pointsFC; solo se usa en renderMode 'disc'.
  const discsFC = useMemo(() => ({
    type: 'FeatureCollection' as const,
    features: pointsFC.features.map((f) => {
      const [lng, lat] = f.geometry.coordinates as [number, number]
      return {
        type: 'Feature' as const,
        geometry: { type: 'Polygon' as const, coordinates: [circlePolygon(lng, lat, PROBLEM_RADIUS_M)] },
        properties: { presence_status: f.properties.presence_status },
      }
    }),
  }), [pointsFC])

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
    mapRef.current.fitBounds(mapBounds, { padding: 56, duration: 600, maxZoom: 18 })
  }, [mapBounds])

  const isEmpty = !isLoading && fc && fc.features.length === 0

  function handleClick(e: MapLayerMouseEvent) {
    const feat = e.features?.[0]
    if (feat) {
      const key = (feat.properties as { key?: string }).key
      const items = key ? (groups[key] ?? []) : []
      const coords = (feat.geometry as GeoJSON.Point).coordinates
      setPopup({ lon: coords[0] as number, lat: coords[1] as number, items })
    } else {
      setPopup(null)
    }
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
          <div className="absolute right-2 top-2 bottom-2 z-10 flex w-56 flex-col gap-2">
            {sessionsSlot}
          </div>
        )}

        {isLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 text-sm text-muted-foreground">
            <span className="mr-2 animate-spin">⏳</span> Cargando puntos…
          </div>
        )}
        {isEmpty && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 text-sm text-muted-foreground">
            Esta sesión aún no tiene puntos capturados.
          </div>
        )}

        {/* Leyenda — abajo-izquierda cuando hay columna de sesiones para no solaparla. */}
        <div className={`absolute z-10 rounded border bg-background/90 px-3 py-2 text-xs shadow-sm ${
          sessionsSlot ? 'left-2 bottom-2' : 'right-2 top-2'
        }`}>
          <div className="mb-1 flex items-center gap-1">
            <p className="font-medium">Presencia</p>
            <button
              type="button"
              aria-label="Cómo interpretar cada color"
              aria-expanded={showInfo}
              onClick={() => setShowInfo((s) => !s)}
              className={`flex h-4 w-4 items-center justify-center rounded-full transition hover:bg-accent ${
                showInfo ? 'text-primary' : 'text-muted-foreground'
              }`}
            >
              <Info className="h-3.5 w-3.5" />
            </button>
          </div>
          {showInfo && (
            <div className="mb-1.5 w-52 space-y-1.5 rounded border bg-background/95 p-2">
              {PRESENCE_HELP.map((h) => (
                <div key={h.label} className="flex gap-1.5">
                  <span className="mt-0.5 inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: h.color }} />
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
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: PRESENCE_COLOR[k] }} />
              <span className="text-muted-foreground">{PRESENCE_LABEL[k]}</span>
            </div>
          ))}
          {/* Estado base (verde): puntos de baja presencia + objetivos sin muestrear.
              No se marcan individualmente; corresponden al relleno verde de la parcela. */}
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: HEALTHY_GREEN }} />
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
                  <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: PRESENCE_COLOR.critical }} />
                  Con problemas
                </span>
                <span className="tabular-nums font-medium">
                  {fmtHa(surface.problem)} ({pctOf(surface.problem, surface.parcela)})
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: HEALTHY_GREEN }} />
                  Baja / sin monitoreo
                </span>
                <span className="tabular-nums font-medium">
                  {fmtHa(surface.healthy)} ({pctOf(surface.healthy, surface.parcela)})
                </span>
              </div>
            </div>
          )}

          {/* Toggle de comparación: mancha difuminada (heatmap) vs disco geográfico. */}
          <div className="mt-2 border-t pt-1.5">
            <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Visualización</p>
            <div className="flex overflow-hidden rounded border">
              {([['heat', 'Mapa de calor'], ['disc', 'Discos']] as const).map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setRenderMode(mode)}
                  className={`flex-1 px-2 py-0.5 text-[11px] transition ${
                    renderMode === mode ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-accent'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <Map
          ref={mapRef}
          initialViewState={
            mapBounds
              ? { bounds: mapBounds, fitBoundsOptions: { padding: 56, maxZoom: 18 } }
              : { longitude: -101, latitude: 20.5, zoom: 6 }
          }
          maxZoom={20}
          mapStyle={ESRI_STYLE}
          attributionControl={false}
          interactiveLayerIds={['cp-circles']}
          onClick={handleClick}
          style={{ width: '100%', height: '100%' }}
        >
          {/* Parcela — relleno verde base */}
          {plotGeojson && (
            <Source id="plot" type="geojson" data={plotGeojson}>
              <Layer id="plot-fill" type="fill" paint={{ 'fill-color': HEALTHY_GREEN, 'fill-opacity': 0.95 }} />
              <Layer id="plot-line" type="line" paint={{ 'line-color': '#14532d', 'line-width': 1.5 }} />
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
                paint={{ 'fill-color': CIRCLE_COLOR as never, 'fill-opacity': 0.55 }}
              />
              <Layer
                id="cp-disc-line"
                type="line"
                paint={{ 'line-color': CIRCLE_COLOR as never, 'line-width': 1.2, 'line-opacity': 0.9 }}
              />
            </Source>
          )}

          {/* Un marcador por PUNTO con peligro (agrupado por coordenada); clic → popup
              con todos los hallazgos del punto. */}
          {pointsFC.features.length > 0 && (
            <Source id="cp-points-src" type="geojson" data={pointsFC}>
              <Layer
                id="cp-circles"
                type="circle"
                paint={{
                  'circle-radius': 6,
                  'circle-color': CIRCLE_COLOR as never,
                  'circle-stroke-color': '#ffffff',
                  'circle-stroke-width': 1.5,
                  'circle-opacity': 0.95,
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

          {popup && popup.items.length > 0 && (
            <Popup
              longitude={popup.lon}
              latitude={popup.lat}
              closeButton
              closeOnClick={false}
              onClose={() => setPopup(null)}
              anchor="bottom"
              offset={12}
              maxWidth="420px"
              style={{ padding: 0 }}
            >
              <div className="px-2 py-1.5 text-xs">
                <p className="mb-1 font-medium">
                  {popup.items.length} {popup.items.length === 1 ? 'hallazgo' : 'hallazgos'} en este punto
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="text-left text-muted-foreground">
                      <tr>
                        <th className="py-0.5 pr-2 font-medium">Problema</th>
                        <th className="py-0.5 px-1.5 font-medium">Tipo</th>
                        <th className="py-0.5 px-1.5 font-medium">Etapa</th>
                        <th className="py-0.5 px-1.5 text-right font-medium">Cant.</th>
                        <th className="py-0.5 px-1.5 font-medium">Presencia</th>
                        <th className="py-0.5 px-1.5 font-medium">Foto</th>
                        <th className="py-0.5 pl-1.5 font-medium">Nota</th>
                      </tr>
                    </thead>
                    <tbody>
                      {popup.items
                        .slice()
                        .sort((a, b) => (PRESENCE_RANK[b.presence_status] ?? 0) - (PRESENCE_RANK[a.presence_status] ?? 0))
                        .map((it) => (
                          <tr key={it.id} className="border-t">
                            <td className="py-0.5 pr-2 font-medium">{it.issue ?? 'Sin problema'}</td>
                            <td className="py-0.5 px-1.5 text-muted-foreground">{it.issue_type ?? '—'}</td>
                            <td className="py-0.5 px-1.5">{it.stage_display ?? '—'}</td>
                            <td className="py-0.5 px-1.5 text-right">{it.qty ?? '—'}</td>
                            <td className="py-0.5 px-1.5">
                              <span className="inline-flex items-center gap-1 whitespace-nowrap font-medium" style={{ color: PRESENCE_COLOR[it.presence_status] }}>
                                <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: PRESENCE_COLOR[it.presence_status] }} />
                                {PRESENCE_LABEL[it.presence_status] ?? it.presence_status}
                              </span>
                            </td>
                            <td className="py-0.5 pl-1.5">
                              {it.photo ? (
                                <button
                                  type="button"
                                  onClick={() => setPhotoModal(it.photo)}
                                  className="block h-8 w-8 overflow-hidden rounded border transition hover:ring-2 hover:ring-primary"
                                  title="Ver foto completa"
                                >
                                  <img src={it.photo} alt="Foto del hallazgo" className="h-full w-full object-cover" />
                                </button>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                            <td className="py-0.5 pl-1.5">
                              {it.notes ? (
                                <button
                                  type="button"
                                  onClick={() => setNoteModal(it.notes)}
                                  className="whitespace-nowrap text-primary underline underline-offset-2 hover:opacity-80"
                                >
                                  Ver
                                </button>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </Popup>
          )}
        </Map>
      </div>

      {/* Modal de foto completa */}
      <Dialog open={!!photoModal} onOpenChange={(o) => { if (!o) setPhotoModal(null) }}>
        <DialogContent className="max-w-3xl p-2">
          <DialogTitle className="sr-only">Foto del hallazgo</DialogTitle>
          {photoModal && (
            <img src={photoModal} alt="Foto del hallazgo" className="max-h-[80vh] w-full rounded object-contain" />
          )}
        </DialogContent>
      </Dialog>

      {/* Modal de nota */}
      <Dialog open={!!noteModal} onOpenChange={(o) => { if (!o) setNoteModal(null) }}>
        <DialogContent className="max-w-md">
          <DialogTitle>Nota del hallazgo</DialogTitle>
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">{noteModal}</p>
        </DialogContent>
      </Dialog>
    </div>
  )
}
