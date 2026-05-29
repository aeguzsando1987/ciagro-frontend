/**
 * Mapa de calor de los datos de aspersión de una sesión — componente presentacional
 * auto-contenido, embebible tanto en un modal (task-manager) como en el dashboard del
 * Visor de Datos Agrícolas.
 *
 * Dibuja un rectángulo orientado por cada punto de telemetría sobre el polígono de la
 * parcela; el color refleja la capa activa (% de aplicación, flujo, presión, producción
 * o velocidad). Es de solo lectura.
 *
 * Recibe `sessionId` + `plotId` y se encarga de cargar sus propios datos. La toolbar
 * superior admite slots (`toolbarStart`/`toolbarEnd`) para que el contenedor inyecte su
 * propio chrome (p.ej. el título y el botón "✕ Cerrar" del modal).
 *
 * Endpoints consumidos (vía hooks reutilizados de la Fase 6):
 *   GET /api/v1/monitoring/aspersion/points/?session_header=<id>&page_size=2000
 *   GET /api/v1/monitoring/aspersion/headers/<id>/stats/
 *   GET /api/v1/monitoring/aspersion/headers/<id>/variable-stats/
 *   GET /api/v1/geo_assets/plots/<id>/  (vía usePlotGeometry, cacheado)
 */
import { useState, useEffect, useMemo, useRef } from 'react'
import Map, { Layer, Marker, Source, Popup } from 'react-map-gl/maplibre'
import type { MapRef } from 'react-map-gl/maplibre'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useAspersionPoints } from '@/features/task-manager/hooks/useAspersionPoints'
import { usePlotGeometry } from '@/features/task-manager/hooks/usePlotGeometry'
import { useAspersionVariableStats } from '@/features/task-manager/hooks/useAspersionVariableStats'
import {
  useAspersionSessionStats,
  type AspersionSessionStats,
} from '@/features/task-manager/hooks/useAspersionSessionStats'
import {
  pointsToRectangleCollection,
  type RectangleProps,
} from '@/features/task-manager/lib/plotRectangles'
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
} from '@/features/task-manager/lib/aspersionLayers'

// ─── ESRI satellite style — mismo que PlotMiniMap ─────────────────────────────
export const ESRI_STYLE = {
  version: 8 as const,
  sources: {
    esri: {
      type: 'raster' as const,
      tiles: [
        'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      ],
      tileSize: 256,
      // maxzoom = último nivel con teselas REALES que pedimos a ESRI. ESRI World Imagery
      // tiene cobertura aérea casi universal hasta z18; pedir z19 en zonas rurales devuelve
      // 404 → mapa en blanco. Con 18, MapLibre hace overzoom (estira la última foto) más
      // allá de 18, así la imagen SIEMPRE está disponible aunque se vea menos nítida.
      maxzoom: 18,
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

// ─── Tipos internos ──────────────────────────────────────────────────────────

type LegendEntry = (CategoryDef | QuartileDef) & { key: string; color: string; label: string }

interface LayerData {
  annotated: GeoJSON.FeatureCollection<GeoJSON.Polygon, RectangleProps & { bucket: string }>
  legendDefs: LegendEntry[]
  colorExpr: unknown[]
  quartilesRef: { q1: number; q2: number; q3: number } | null
  /** Hectáreas acumuladas por bucket (para el desglose de área en la leyenda). */
  areaByBucket: Record<string, number>
}

/** Suma `area_ha` por bucket sobre los rectángulos ya clasificados. Función pura (testeable). */
export function sumAreaByBucket(
  fc: GeoJSON.FeatureCollection<GeoJSON.Polygon, RectangleProps & { bucket: string }>,
): Record<string, number> {
  const acc: Record<string, number> = {}
  for (const f of fc.features) {
    const area = f.properties.area_ha
    if (area == null || !Number.isFinite(area)) continue
    const b = f.properties.bucket
    acc[b] = (acc[b] ?? 0) + area
  }
  return acc
}

type HoverInfo = { lon: number; lat: number; props: RectangleProps & { bucket?: string } }

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
      areaByBucket: sumAreaByBucket(annotated),
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
    areaByBucket: sumAreaByBucket(annotated),
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

/** Formatea hectáreas a string es-MX con 2 decimales (null/NaN → '—'). */
function formatHa(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return value.toLocaleString('es-MX', { maximumFractionDigits: 2 })
}

interface LegendCardProps {
  legendDefs: LegendEntry[]
  checkedBuckets: Set<string>
  onToggle: (key: string) => void
  activeLayer: LayerDef
  sessionStats: AspersionSessionStats | undefined
  areaByBucket: Record<string, number>
}

function LegendCard({ legendDefs, checkedBuckets, onToggle, activeLayer, sessionStats, areaByBucket }: LegendCardProps) {
  const isCategory = activeLayer.kind === 'category'
  const totalHa = sessionStats ? parseFloat(sessionStats.area_total_ha) : null
  return (
    <div className="shrink-0 border-t bg-background px-4 py-2 space-y-1">
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold">{activeLayer.label}</span>
        {totalHa != null && Number.isFinite(totalHa) && (
          <span className="text-xs font-medium text-foreground">· Área total: {formatHa(totalHa)} ha</span>
        )}
        <span className="text-xs text-muted-foreground italic">— clic en cada categoría para mostrar u ocultar</span>
        {isCategory && sessionStats && (
          <span className="ml-auto text-xs text-muted-foreground">
            ✓ {parseFloat(sessionStats.pct_in_range ?? '0').toFixed(1)}% en rango ·{' '}
            ↓ {parseFloat(sessionStats.pct_below ?? '0').toFixed(1)}% bajo ·{' '}
            ↑ {parseFloat(sessionStats.pct_above ?? '0').toFixed(1)}% sobre
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {legendDefs.map((def) => {
          const checked = checkedBuckets.has(def.key)
          return (
            <label key={def.key} className="flex items-center gap-1.5 cursor-pointer select-none text-xs group">
              <input
                type="checkbox"
                className="sr-only"
                checked={checked}
                onChange={() => onToggle(def.key)}
              />
              {/* Checkbox visual con ✓ interno */}
              <span
                className="inline-flex items-center justify-center w-4 h-4 rounded-sm border-2 shrink-0 transition-colors"
                style={{
                  borderColor: def.color,
                  backgroundColor: checked ? def.color : 'transparent',
                }}
              >
                {checked && <span className="text-white leading-none" style={{ fontSize: 10 }}>✓</span>}
              </span>
              {/* Pastilla de color */}
              <span
                className="inline-block w-3 h-3 rounded-sm shrink-0"
                style={{ backgroundColor: checked ? def.color : '#d1d5db' }}
              />
              <span className={checked ? '' : 'line-through text-muted-foreground'}>
                {'range' in def ? `${def.label} ${def.range}` : def.label}
                {/* Área por categoría: solo en la capa 1 (% aplicación) */}
                {isCategory && (
                  <span className="ml-1 text-muted-foreground">· {formatHa(areaByBucket[def.key])} ha</span>
                )}
              </span>
            </label>
          )
        })}
      </div>
    </div>
  )
}

// ─── Props ───────────────────────────────────────────────────────────────────

interface AspersionMapProps {
  /** UUID de la AspersionSessionHeader. */
  sessionId: string
  plotId: string | null
  /** Si los datos deben cargarse. El modal pasa `open`; embebido por defecto true. */
  enabled?: boolean
  /** Slot al inicio de la toolbar (p.ej. el título del modal / DialogTitle). */
  toolbarStart?: React.ReactNode
  /** Slot alineado a la derecha de la toolbar (p.ej. el botón "✕ Cerrar" del modal). */
  toolbarEnd?: React.ReactNode
  /** Clases extra para el contenedor raíz. */
  className?: string
}

// ─── Componente principal ────────────────────────────────────────────────────

export function AspersionMap({
  sessionId,
  plotId,
  enabled = true,
  toolbarStart,
  toolbarEnd,
  className,
}: AspersionMapProps) {
  const [activeLayerIdx, setActiveLayerIdx] = useState(0)
  // null = sin inicializar (tratar como "todos activos"); Set vacío = usuario desmarcó todo
  const [checkedBuckets, setCheckedBuckets] = useState<Set<string> | null>(null)
  const [hoverInfo, setHoverInfo] = useState<HoverInfo | null>(null)
  const mapRef = useRef<MapRef>(null)

  const {
    data: points,
    isLoading: loadingPoints,
    error: pointsError,
  } = useAspersionPoints(sessionId, enabled)

  const { data: plot } = usePlotGeometry(plotId)
  const { data: sessionStats } = useAspersionSessionStats(sessionId, enabled)
  useAspersionVariableStats(sessionId, enabled) // precarga min/max (queda en caché para uso futuro)

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

  // Reiniciar checkboxes a "todos activos" al cambiar de capa.
  useEffect(() => {
    if (!layerData) return
    setCheckedBuckets(new Set(layerData.legendDefs.map((d) => d.key)))
  }, [layerData])

  // Expresión de filtro para visibilidad por checkbox.
  // checkedBuckets===null significa "todos activos" (estado inicial antes de que lleguen datos).
  const filterExpr = useMemo(() => {
    if (!layerData || layerData.legendDefs.length === 0 || checkedBuckets === null) return undefined
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

  // Cuando el bbox cambia (e.g. el polígono llega después que los puntos), volar al nuevo encuadre.
  useEffect(() => {
    if (!mapRef.current || !mapBounds) return
    mapRef.current.fitBounds(mapBounds, { padding: 50, duration: 600, maxZoom: 18 })
  }, [mapBounds])

  const toggleBucket = (key: string) => {
    setCheckedBuckets((prev) => {
      // Si null (aún sin inicializar), tratar como todos activos
      const base = prev ?? new Set(layerData?.legendDefs.map((d) => d.key) ?? [])
      const next = new Set(base)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  const plotGeojson = plot?.geometry
    ? { type: 'Feature' as const, geometry: plot.geometry as GeoJSON.Geometry, properties: {} }
    : null

  return (
    <div className={`flex flex-col h-full min-h-0 overflow-hidden ${className ?? ''}`}>
      {/* ─ Toolbar de capas ─────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2 shrink-0">
        {toolbarStart}
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
        {toolbarEnd && <div className="ml-auto">{toolbarEnd}</div>}
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

        {/* El mapa se monta cuando hay datos (layerData), con el encuadre inicial ya en
            los bounds de la parcela/puntos. */}
        {layerData && (
        <Map
          ref={mapRef}
          initialViewState={
            mapBounds
              ? { bounds: mapBounds, fitBoundsOptions: { padding: 50, maxZoom: 18 } }
              : { longitude: -101, latitude: 20.5, zoom: 6 }
          }
          maxZoom={20}
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
          {layerData && (
            <>
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
                  // MapLibre rechaza el addLayer entero si se pasa filter={undefined}
                  // (exige un array cuando la prop está presente). Solo se pasa si hay filtro.
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  {...(filterExpr ? { filter: filterExpr as any } : {})}
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
            </>
          )}

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
          checkedBuckets={checkedBuckets ?? new Set(layerData.legendDefs.map((d) => d.key))}
          onToggle={toggleBucket}
          activeLayer={ASPERSION_LAYERS[activeLayerIdx]!}
          sessionStats={sessionStats}
          areaByBucket={layerData.areaByBucket}
        />
      )}
    </div>
  )
}
