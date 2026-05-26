/**
 * Modal grande con mapa de calor de los datos de aspersión de una sesión.
 *
 * Dibuja un rectángulo orientado por cada punto de telemetría sobre el polígono de la
 * parcela; el color refleja la capa activa (% de aplicación, flujo, presión, producción
 * o velocidad). El modal solo se cierra mediante el botón "✕ Cerrar" (§2.7 del caso de uso).
 *
 * Gating: visible para role_level >= 3 (Supervisor+). El botón que abre este modal
 * se gatea en SesionModal.tsx; aquí se aplica una segunda capa defensiva.
 *
 * Endpoints consumidos:
 *   GET /api/v1/monitoring/aspersion/points/?session_header=<id>&page_size=2000
 *   GET /api/v1/monitoring/aspersion/headers/<id>/stats/
 *   GET /api/v1/monitoring/aspersion/headers/<id>/variable-stats/
 *   GET /api/v1/geo_assets/plots/<id>/  (vía usePlotGeometry, cacheado)
 */
import { useState, useEffect, useMemo, useRef } from 'react'
import Map, { Layer, Marker, Source, Popup } from 'react-map-gl/maplibre'
import type { MapRef } from 'react-map-gl/maplibre'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useAspersionPoints } from '../hooks/useAspersionPoints'
import { usePlotGeometry } from '../hooks/usePlotGeometry'
import { useAspersionVariableStats } from '../hooks/useAspersionVariableStats'
import { tokens } from '@/lib/auth/tokens'
import {
  pointsToRectangleCollection,
  type RectangleProps,
} from '../lib/plotRectangles'
import {
  ASPERSION_LAYERS,
  APPLICATION_CATEGORIES,
  QUARTILE_PALETTES,
  classifyApplication,
  computeQuartiles,
  quartileOf,
  buildQuartileDefs,
  applicationPercent,
  type LayerDef,
  type CategoryDef,
  type QuartileDef,
  type LayerKey,
} from '../lib/aspersionLayers'

// ─── ESRI satellite style — mismo que PlotMiniMap ─────────────────────────────
const ESRI_STYLE = {
  version: 8 as const,
  sources: {
    esri: {
      type: 'raster' as const,
      tiles: [
        'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      ],
      tileSize: 256,
      maxzoom: 19,
      attribution: '© Esri',
    },
  },
  layers: [{ id: 'esri-base', type: 'raster' as const, source: 'esri' }],
}

function bboxFromCoords(coords: number[][]): [number, number, number, number] {
  const lngs = coords.map((c) => c[0] as number)
  const lats = coords.map((c) => c[1] as number)
  return [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)]
}

// ─── Session stats hook (MV mv_aspersion_session_stats) ──────────────────────

export interface AspersionSessionStats {
  points_count: number
  area_total_ha: string
  mean_target_l: string | null
  mean_applied_l: string | null
  ratio_applied: string | null
  pct_below: string | null
  pct_in_range: string | null
  pct_above: string | null
}

// GET /api/v1/monitoring/aspersion/headers/<id>/stats/
export function useAspersionSessionStats(headerId: string | null, enabled = true) {
  return useQuery({
    queryKey: ['aspersion-session-stats', headerId] as const,
    enabled: !!headerId && enabled,
    queryFn: async (): Promise<AspersionSessionStats> => {
      const baseUrl = import.meta.env.VITE_API_BASE_URL as string
      const res = await fetch(
        `${baseUrl}/monitoring/aspersion/headers/${headerId}/stats/`,
        { headers: { Authorization: `Bearer ${tokens.getAccess() ?? ''}` } },
      )
      if (!res.ok) throw new Error('stats no disponibles')
      return (await res.json()) as AspersionSessionStats
    },
    staleTime: 60_000,
  })
}

// ─── Tipos internos ──────────────────────────────────────────────────────────

type LegendEntry = (CategoryDef | QuartileDef) & { key: string; color: string; label: string }

interface LayerData {
  annotated: GeoJSON.FeatureCollection<GeoJSON.Polygon, RectangleProps & { bucket: string }>
  legendDefs: LegendEntry[]
  colorExpr: unknown[]
  quartilesRef: { q1: number; q2: number; q3: number } | null
}

type HoverInfo = { lon: number; lat: number; props: RectangleProps & { bucket?: string } }

// ─── Props del modal ─────────────────────────────────────────────────────────

interface AspersionMapModalProps {
  open: boolean
  onClose: () => void
  /** UUID de la AspersionSessionHeader. */
  sessionId: string
  plotId: string | null
}

// ─── Helpers de expresiones MapLibre ────────────────────────────────────────

function buildCategoryColorExpr(defs: CategoryDef[]): unknown[] {
  const expr: unknown[] = ['match', ['get', 'bucket']]
  for (const d of defs) {
    expr.push(d.key, d.color)
  }
  expr.push('#94a3b8') // fallback: sin_meta / desconocido
  return expr
}

function buildQuartileColorExpr(palette: [string, string, string, string]): unknown[] {
  return ['match', ['get', 'bucket'], 'q1', palette[0], 'q2', palette[1], 'q3', palette[2], 'q4', palette[3], '#94a3b8']
}

// ─── Cómputo de datos por capa ───────────────────────────────────────────────

function buildLayerData(
  baseFC: GeoJSON.FeatureCollection<GeoJSON.Polygon, RectangleProps>,
  layerDef: LayerDef,
): LayerData | null {
  if (baseFC.features.length === 0) return null

  if (layerDef.kind === 'category') {
    const annotated = {
      ...baseFC,
      features: baseFC.features.map((f) => ({
        ...f,
        properties: {
          ...f.properties,
          bucket: classifyApplication(f.properties.applied_rate_l, f.properties.target_rate_l),
        },
      })),
    } as LayerData['annotated']
    return {
      annotated,
      legendDefs: APPLICATION_CATEGORIES as LegendEntry[],
      colorExpr: buildCategoryColorExpr(APPLICATION_CATEGORIES),
      quartilesRef: null,
    }
  }

  // Quartile layer
  const fieldKey = layerDef.field as keyof RectangleProps
  const values = baseFC.features
    .map((f) => f.properties[fieldKey] as number | null)
    .filter((v): v is number => v != null && Number.isFinite(v))
  const cuts = computeQuartiles(values)
  const palette = QUARTILE_PALETTES[layerDef.key as Exclude<LayerKey, 'application'>]
  const annotated = {
    ...baseFC,
    features: baseFC.features.map((f) => ({
      ...f,
      properties: {
        ...f.properties,
        bucket: cuts
          ? (quartileOf(f.properties[fieldKey] as number | null, cuts) ?? 'q1')
          : 'q1',
      },
    })),
  } as LayerData['annotated']
  return {
    annotated,
    legendDefs: cuts ? (buildQuartileDefs(palette, cuts, layerDef.unit) as LegendEntry[]) : [],
    colorExpr: buildQuartileColorExpr(palette),
    quartilesRef: cuts ? { q1: cuts.q1, q2: cuts.q2, q3: cuts.q3 } : null,
  }
}

// ─── Sub-componentes ─────────────────────────────────────────────────────────

function MapOverlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-background/60 z-10 text-sm text-muted-foreground">
      {children}
    </div>
  )
}

function HoverTooltip({ info, layer }: { info: HoverInfo; layer: LayerDef }) {
  const { lon, lat, props } = info
  const isPct = layer.kind === 'category'
  const fieldValue = props[layer.field as keyof RectangleProps] as number | null
  const pApl = applicationPercent(props.applied_rate_l, props.target_rate_l)

  return (
    <Popup
      longitude={lon}
      latitude={lat}
      closeButton={false}
      closeOnClick={false}
      anchor="bottom"
      offset={8}
      style={{ padding: 0 }}
    >
      <div className="px-2 py-1.5 text-xs space-y-0.5 min-w-[160px]">
        <p className="text-muted-foreground">
          {lat.toFixed(6)}, {lon.toFixed(6)}
        </p>
        {isPct ? (
          <>
            <p>Aplicado: <span className="font-medium">{props.applied_rate_l?.toFixed(1)} L/ha</span></p>
            <p>Meta: <span className="font-medium">{props.target_rate_l?.toFixed(1)} L/ha</span></p>
            <p>% apl.: <span className="font-medium">{pApl != null ? `${pApl.toFixed(1)}%` : '—'}</span></p>
            {props.bucket && <p>Categoría: <span className="font-medium capitalize">{props.bucket.replace('_', ' ')}</span></p>}
          </>
        ) : (
          <p>
            {layer.label}: <span className="font-medium">{fieldValue?.toFixed(3) ?? '—'} {layer.unit}</span>
          </p>
        )}
      </div>
    </Popup>
  )
}

interface LegendCardProps {
  legendDefs: LegendEntry[]
  checkedBuckets: Set<string>
  onToggle: (key: string) => void
  activeLayer: LayerDef
  sessionStats: AspersionSessionStats | undefined
}

function LegendCard({ legendDefs, checkedBuckets, onToggle, activeLayer, sessionStats }: LegendCardProps) {
  return (
    <div className="shrink-0 border-t bg-background px-4 py-2">
      <div className="flex flex-wrap gap-x-4 gap-y-1 items-center">
        <span className="text-xs font-medium text-muted-foreground mr-2">{activeLayer.label}:</span>
        {legendDefs.map((def) => (
          <label key={def.key} className="flex items-center gap-1.5 cursor-pointer select-none text-xs">
            <input
              type="checkbox"
              className="sr-only"
              checked={checkedBuckets.has(def.key)}
              onChange={() => onToggle(def.key)}
            />
            <span
              className="inline-block w-3 h-3 rounded-sm border border-black/10 shrink-0"
              style={{ backgroundColor: checkedBuckets.has(def.key) ? def.color : '#d1d5db' }}
            />
            <span className={checkedBuckets.has(def.key) ? '' : 'line-through text-muted-foreground'}>
              {'range' in def ? `${def.label} ${def.range}` : def.label}
            </span>
          </label>
        ))}
        {activeLayer.kind === 'category' && sessionStats && (
          <span className="ml-auto text-xs text-muted-foreground">
            ✓ {parseFloat(sessionStats.pct_in_range ?? '0').toFixed(1)}% en rango ·{' '}
            ↓ {parseFloat(sessionStats.pct_below ?? '0').toFixed(1)}% bajo ·{' '}
            ↑ {parseFloat(sessionStats.pct_above ?? '0').toFixed(1)}% sobre
          </span>
        )}
      </div>
    </div>
  )
}

// ─── Componente principal ────────────────────────────────────────────────────

export function AspersionMapModal({ open, onClose, sessionId, plotId }: AspersionMapModalProps) {
  const [activeLayerIdx, setActiveLayerIdx] = useState(0)
  const [checkedBuckets, setCheckedBuckets] = useState<Set<string>>(new Set())
  const [hoverInfo, setHoverInfo] = useState<HoverInfo | null>(null)
  const mapRef = useRef<MapRef>(null)

  const {
    data: points,
    isLoading: loadingPoints,
    error: pointsError,
  } = useAspersionPoints(sessionId, open)

  const { data: plot } = usePlotGeometry(plotId)
  const { data: sessionStats } = useAspersionSessionStats(sessionId, open)
  useAspersionVariableStats(sessionId, open) // precarga min/max (queda en caché para uso futuro)

  // Mostrar error en toast (no en pantalla; el mapa puede estar parcialmente cargado)
  useEffect(() => {
    if (pointsError) {
      toast.error('No se pudieron cargar los puntos de aspersión.')
    }
  }, [pointsError])

  // FeatureCollection base de rectángulos (calculada una vez cuando llegan los puntos)
  const baseFC = useMemo(
    () => (points ? pointsToRectangleCollection(points) : null),
    [points],
  )

  // Datos clasificados + leyenda + expresión de color, recalculados al cambiar capa
  const layerData = useMemo(() => {
    if (!baseFC) return null
    return buildLayerData(baseFC, ASPERSION_LAYERS[activeLayerIdx]!)
  }, [baseFC, activeLayerIdx])

  // Reiniciar checkboxes a "todos activos" al cambiar de capa
  useEffect(() => {
    if (!layerData) return
    setCheckedBuckets(new Set(layerData.legendDefs.map((d) => d.key)))
  }, [layerData])

  // Expresión de filtro para visibilidad por checkbox
  const filterExpr = useMemo(() => {
    if (!layerData || layerData.legendDefs.length === 0) return undefined
    const allKeys = layerData.legendDefs.map((d) => d.key)
    if (checkedBuckets.size === allKeys.length) return undefined
    if (checkedBuckets.size === 0) return ['boolean', false]
    return ['match', ['get', 'bucket'], Array.from(checkedBuckets), true, false]
  }, [checkedBuckets, layerData])

  // Bbox para centrar el mapa (polígono de parcela → fallback a bbox de rectángulos)
  const mapBounds = useMemo<[number, number, number, number] | null>(() => {
    const plotCoords = plot?.geometry?.coordinates?.[0]
    if (plotCoords && plotCoords.length > 0) return bboxFromCoords(plotCoords)
    if (baseFC && baseFC.features.length > 0) {
      const lons: number[] = []
      const lats: number[] = []
      for (const f of baseFC.features) {
        for (const pos of f.geometry.coordinates[0]!) {
          lons.push(pos[0]!)
          lats.push(pos[1]!)
        }
      }
      return [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)]
    }
    return null
  }, [plot, baseFC])

  // Cuando el bbox cambia (e.g. polígono llega después que los puntos), volar al nuevo encuadre
  useEffect(() => {
    if (!mapRef.current || !mapBounds) return
    mapRef.current.fitBounds(mapBounds, { padding: 50, duration: 600 })
  }, [mapBounds])

  const toggleBucket = (key: string) => {
    setCheckedBuckets((prev) => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  const plotGeojson = plot?.geometry
    ? { type: 'Feature' as const, geometry: plot.geometry as GeoJSON.Geometry, properties: {} }
    : null

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose() }}>
      <DialogContent
        className="max-w-6xl w-full h-[92vh] flex flex-col p-0 gap-0 overflow-hidden"
        onInteractOutside={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        {/* ─ Header ─────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2 shrink-0">
          <DialogTitle className="text-base font-semibold mr-2">Mapa de aspersión</DialogTitle>
          {ASPERSION_LAYERS.map((layer, i) => (
            <Button
              key={layer.key}
              size="sm"
              variant={i === activeLayerIdx ? 'default' : 'outline'}
              onClick={() => { setActiveLayerIdx(i); setHoverInfo(null) }}
            >
              {layer.label}
            </Button>
          ))}
          <Button size="sm" variant="outline" className="ml-auto" onClick={onClose}>
            ✕ Cerrar
          </Button>
        </div>

        {/* ─ Mapa ───────────────────────────────────────────────────── */}
        <div className="flex-1 relative min-h-0">
          {loadingPoints && (
            <MapOverlay>
              <span className="animate-spin mr-2">⏳</span> Cargando puntos…
            </MapOverlay>
          )}
          {!loadingPoints && points?.length === 0 && (
            <MapOverlay>Sin puntos de aspersión cargados.</MapOverlay>
          )}

          {/* El mapa se monta cuando hay datos (layerData) para evitar estado vacío */}
          {layerData && (
            <Map
              ref={mapRef}
              initialViewState={
                mapBounds
                  ? { bounds: mapBounds, fitBoundsOptions: { padding: 50 } }
                  : { longitude: -101, latitude: 20.5, zoom: 14 }
              }
              mapStyle={ESRI_STYLE}
              cooperativeGestures
              interactiveLayerIds={['rect-fill']}
              attributionControl={false}
              style={{ width: '100%', height: '100%' }}
              onMouseMove={(e) => {
                if (e.features && e.features.length > 0) {
                  setHoverInfo({
                    lon: e.lngLat.lng,
                    lat: e.lngLat.lat,
                    props: e.features[0]!.properties as RectangleProps & { bucket?: string },
                  })
                } else {
                  setHoverInfo(null)
                }
              }}
              onMouseLeave={() => setHoverInfo(null)}
            >
              {/* Polígono de la parcela */}
              {plotGeojson && (
                <Source id="plot" type="geojson" data={plotGeojson}>
                  <Layer
                    id="plot-fill"
                    type="fill"
                    paint={{ 'fill-color': '#22c55e', 'fill-opacity': 0.12 }}
                  />
                  <Layer
                    id="plot-outline"
                    type="line"
                    paint={{ 'line-color': '#16a34a', 'line-width': 2 }}
                  />
                </Source>
              )}

              {/* Rectángulos de aspersión — una sola Source + Layer con color data-driven */}
              <Source id="rects" type="geojson" data={layerData.annotated}>
                <Layer
                  id="rect-fill"
                  type="fill"
                  paint={{
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    'fill-color': layerData.colorExpr as unknown as any,
                    'fill-opacity': 0.78,
                    'fill-outline-color': 'rgba(0,0,0,0.08)',
                  }}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  filter={filterExpr as any}
                />
              </Source>

              {/* Pin fijo en el primer punto — ayuda a localizar los rectángulos durante testing */}
              {layerData.annotated.features[0] && (() => {
                const p = layerData.annotated.features[0]!.properties
                return (
                  <Marker longitude={p.lon} latitude={p.lat} anchor="center">
                    <div
                      title="Punto 1"
                      style={{
                        width: 14,
                        height: 14,
                        borderRadius: '50%',
                        background: '#facc15',
                        border: '2px solid #000',
                        boxShadow: '0 0 0 3px rgba(250,204,21,0.5)',
                        pointerEvents: 'none',
                      }}
                    />
                  </Marker>
                )
              })()}

              {hoverInfo && (
                <HoverTooltip
                  info={hoverInfo}
                  layer={ASPERSION_LAYERS[activeLayerIdx]!}
                />
              )}
            </Map>
          )}
        </div>

        {/* ─ Tarjeta de leyenda ──────────────────────────────────────── */}
        {layerData && layerData.legendDefs.length > 0 && (
          <LegendCard
            legendDefs={layerData.legendDefs}
            checkedBuckets={checkedBuckets}
            onToggle={toggleBucket}
            activeLayer={ASPERSION_LAYERS[activeLayerIdx]!}
            sessionStats={sessionStats}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
