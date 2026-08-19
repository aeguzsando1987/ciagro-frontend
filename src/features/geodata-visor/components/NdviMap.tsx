/**
 * Mapa de una sesión NDVI — superficie interpolada (gradiente continuo).
 *
 * A partir de los puntos de muestreo se interpola una superficie (IDW en el cliente) sobre
 * el polígono de la parcela y se pinta como imagen ráster con remuestreo lineal, produciendo
 * un gradiente de color continuo tipo heatmap/kriging. La imagen se recorta a la parcela
 * (celdas fuera del polígono transparentes). Ver lib/ndviInterpolation.ts.
 *
 * Los puntos de muestreo se dibujan encima, muy tenues, y al hacer clic en uno se abre un
 * tooltip con el valor del índice activo y el resto de índices del punto.
 *
 * Datos:
 *   GET /geo_assets/plots/<id>/                        (polígono de la parcela)
 *   GET /monitoring/ndvi/points/?session_header=<id>   (puntos con los 15 índices)
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import Map, { Layer, Source, Popup } from 'react-map-gl/maplibre'
import type { MapRef } from 'react-map-gl/maplibre'
import { usePlotGeometry } from '@/features/task-manager/hooks/usePlotGeometry'
import { ESRI_STYLE } from '../lib/aspersionMap.helpers'
import { useMapMode } from '../lib/mapModes'
import { useMapCameraSync, type MapCameraSyncBinding } from '../lib/mapCameraSync'
import { MapModeSelector } from './MapModeSelector'
import { useNdviPoints, type NdviPoint } from '../hooks/useNdviPoints'
import {
  buildInterpolatedImage,
  quantileBreaks,
  ABSOLUTE_BANDS_SMOOTHING_FACTOR,
  DEFAULT_SMOOTHING_FACTOR,
  type InterpPoint,
  type ColorBand,
} from '../lib/ndviInterpolation'
import {
  useNdviSessionVariableConfig,
  readVariableConfig,
  resolveQuartileColors,
} from '../hooks/useNdviVariableConfig'
import { useNdviVariableStats } from '@/features/task-manager/hooks/useNdviVariableStats'
import { buildNdviClassAreas, type ClassBand } from '../lib/ndviClassArea'
import { NdviClassAreaCard } from './NdviClassAreaCard'
import { GpaLoader } from '@/components/ui/gpa-loader'

const INDICES: { key: keyof NdviPoint; label: string }[] = [
  { key: 'ndvi', label: 'NDVI' },
  { key: 'nir_vigor', label: 'Vigor NIR' },
  { key: 'osavi', label: 'OSAVI' },
  { key: 'vari', label: 'VARI' },
  { key: 'bare_soil_index', label: 'Suelo desnudo' },
  { key: 'red_edge', label: 'Límite rojo' },
  { key: 'swir', label: 'SWIR' },
  { key: 'ndre', label: 'NDRE' },
  { key: 'msavi2', label: 'MSAVI2' },
  { key: 'gndvi', label: 'GNDVI' },
  { key: 'ndmi', label: 'NDMI' },
  { key: 'psri', label: 'PSRI' },
]

// Rampa de la leyenda (misma que ndviInterpolation): bajo -> alto.
const LEGEND_GRADIENT = 'linear-gradient(to right, #d32f2f, #f57c00, #388e3c, #00acc1, #1565c0)'

/** Tres decimales: los indices se mueven en rangos estrechos y dos los igualarian. */
function fmtStat(v: number | null | undefined): string {
  return v == null
    ? '—'
    : v.toLocaleString('es-MX', { minimumFractionDigits: 3, maximumFractionDigits: 3 })
}

function bboxFromRing(ring: number[][]): [number, number, number, number] {
  const lngs = ring.map((c) => c[0] as number)
  const lats = ring.map((c) => c[1] as number)
  return [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)]
}

interface NdviMapProps {
  sessionId: string
  plotId: string | null | undefined
  /**
   * Organización (DataCentralMain) cuyos umbrales/colores se aplican. La manda el visor,
   * que navega por organización y conoce el id directamente (`VisorSelection.org`).
   */
  tenantId?: string
  /**
   * CIAgro hija (DataCentral) del workspace; el backend deriva su organización. La manda
   * el task-manager, que vive en `w/$dc/...` y no tiene el id del tenant a la mano.
   *
   * Se acepta uno u otro porque los dos puntos de render tienen ámbitos distintos: el
   * visor está FUERA de `/w/$dc` (arranca en nivel Organización) y el modal del
   * task-manager está dentro. Sin ninguno, el backend cae a la asignación más antigua.
   */
  dcId?: string
  mapSync?: MapCameraSyncBinding
}

/** Propiedades que viajan en cada feature de punto (obj_id + índices). */
type PointProps = { obj_id: number | null; [k: string]: number | null }

interface PointSelection {
  lon: number
  lat: number
  props: PointProps
}

const POINTS_LAYER_ID = 'ndvi-points'

export function NdviMap({ sessionId, plotId, tenantId, dcId, mapSync }: NdviMapProps) {
  const mapRef = useRef<MapRef>(null)
  const { mapMode, setMapMode } = useMapMode(mapRef)
  const handleCameraMove = useMapCameraSync(mapRef, mapSync)

  const { data: plot } = usePlotGeometry(plotId ?? null)
  const { data: points, isLoading } = useNdviPoints(sessionId)
  // Config de umbrales de la organización desde la que se consulta (resuelta en el
  // servidor). Un mismo productor puede estar asignado a CIAgros de organizaciones
  // distintas, así que sin ámbito el backend caería a la asignación más antigua y ambas
  // verían la misma config. Si no hay alcance/config, el visor usa el gradiente.
  const { data: varConfig } = useNdviSessionVariableConfig(sessionId, { tenantId, dcId })
  // Mismo endpoint que la tabla de resumen de la sesion en el task-manager.
  const { data: varStats } = useNdviVariableStats(sessionId)

  const [indexKey, setIndexKey] = useState<keyof NdviPoint>('ndvi')
  // El tooltip se abre al hacer clic en un punto (no al pasar el cursor): con la
  // superficie de color debajo, un tooltip que sigue al mouse estorba la lectura.
  const [selected, setSelected] = useState<PointSelection | null>(null)
  // Solo para el cursor "pointer" sobre un punto clicable.
  const [hoveringPoint, setHoveringPoint] = useState(false)
  const [areaCardOpen, setAreaCardOpen] = useState(true)

  const activeStat = useMemo(
    () => varStats?.variables.find((v) => v.key === (indexKey as string)) ?? null,
    [varStats, indexKey]
  )

  // Bandas manuales de la variable activa, si el manager las configuro.
  const manualBands = useMemo<ColorBand[] | null>(() => {
    const cfg = readVariableConfig(varConfig, indexKey as string)
    if (cfg.strategy !== 'manual' || !cfg.bands || cfg.bands.length === 0) return null
    return cfg.bands
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((b) => ({ min: b.min, max: b.max, color: b.color }))
  }, [varConfig, indexKey])

  const manualLegend = useMemo(() => {
    const cfg = readVariableConfig(varConfig, indexKey as string)
    if (cfg.strategy !== 'manual' || !cfg.bands) return null
    return cfg.bands.slice().sort((a, b) => a.order - b.order)
  }, [varConfig, indexKey])

  // Colores por cuantil (modo Automático), solo si el tenant los configuró
  // explícitamente. Sin config de colores se mantiene el gradiente continuo.
  const quartileColors = useMemo<string[] | null>(() => {
    if (manualBands) return null
    const cfg = readVariableConfig(varConfig, indexKey as string)
    if (cfg.strategy !== 'quartile' || !cfg.colors || cfg.colors.length === 0) return null
    return resolveQuartileColors(cfg, cfg.n_bands ?? cfg.colors.length)
  }, [varConfig, indexKey, manualBands])

  // Leyenda de cuantiles: rangos [breaks[i], breaks[i+1]) calculados de los datos.
  const quartileLegend = useMemo(() => {
    if (!quartileColors || !points) return null
    const vals: number[] = []
    for (const p of points) {
      const v = p[indexKey]
      if (typeof v === 'number') vals.push(v)
    }
    if (vals.length < 2) return null
    const breaks = quantileBreaks(vals, quartileColors.length)
    if (breaks.length < quartileColors.length + 1) return null
    return quartileColors.map((color, i) => ({ color, min: breaks[i]!, max: breaks[i + 1]! }))
  }, [quartileColors, points, indexKey])

  const ring = useMemo<number[][] | null>(() => {
    const r = plot?.geometry?.coordinates?.[0]
    return r && r.length >= 3 ? (r as number[][]) : null
  }, [plot])

  // Superficie interpolada del índice activo, recortada a la parcela.
  const surface = useMemo(() => {
    if (!ring || !points || points.length === 0) return null
    const interp: InterpPoint[] = []
    for (const p of points) {
      const v = p[indexKey]
      if (typeof v === 'number' && p.geom) {
        interp.push({ lon: p.geom.coordinates[0]!, lat: p.geom.coordinates[1]!, value: v })
      }
    }
    if (interp.length < 3) return null
    // Con bandas manuales los cortes son ABSOLUTOS: suavizar desplazaria el valor de cada
    // celda y la pintaria de otra clase. En cuartiles los cortes se recalculan desde la
    // propia superficie, asi que ahi el suavizado no falsea nada y se conserva.
    const smoothing = manualBands ? ABSOLUTE_BANDS_SMOOTHING_FACTOR : DEFAULT_SMOOTHING_FACTOR
    return buildInterpolatedImage(interp, 'kriging', manualBands, quartileColors, 260, smoothing)
  }, [ring, points, indexKey, manualBands, quartileColors])

  // Bandas con las que se mide la superficie: las manuales del tenant, o los tramos por
  // cuantiles ya calculados para la leyenda. El modulo de area no distingue estrategias.
  const areaBands = useMemo<ClassBand[] | null>(() => {
    if (manualLegend) {
      return manualLegend.map((b) => ({ min: b.min, max: b.max, color: b.color, label: b.label }))
    }
    if (quartileLegend) {
      return quartileLegend.map((b, i) => ({
        min: b.min,
        max: i === quartileLegend.length - 1 ? null : b.max,
        color: b.color,
        label: `Q${i + 1}`,
      }))
    }
    return null
  }, [manualLegend, quartileLegend])

  // Reparto de superficie por clase. Mide la MISMA malla que se pinto (surface.field), no
  // una recalculada: interpolar es la parte cara y dos mallas podrian no coincidir.
  const classAreas = useMemo(() => {
    if (!surface || !areaBands) return null
    const values = points?.map((p) => p[indexKey] as number | null | undefined) ?? []
    return buildNdviClassAreas(surface.field, areaBands, values)
  }, [surface, areaBands, points, indexKey])

  // Area de la parcela como contraste: la superficie medida se recorta al casco convexo
  // de los puntos, asi que casi siempre es menor que la parcela completa.
  const plotAreaHa = useMemo(() => {
    const raw = (plot as { properties?: { total_area?: string | number | null } } | undefined)
      ?.properties?.total_area
    const n = typeof raw === 'number' ? raw : Number.parseFloat(raw ?? '')
    return Number.isFinite(n) && n > 0 ? n : null
  }, [plot])

  const plotGeojson = useMemo(() => {
    if (!plot?.geometry) return null
    return { type: 'Feature' as const, geometry: plot.geometry, properties: {} }
  }, [plot])

  // Puntos de muestreo como GeoJSON, para dibujarlos y consultarlos (tooltip).
  // Cada feature lleva obj_id + los 15 índices en properties (MapLibre solo admite
  // primitivos), así el tooltip muestra el valor del índice activo y los demás.
  const pointsGeojson = useMemo<GeoJSON.FeatureCollection<GeoJSON.Point, PointProps> | null>(() => {
    if (!points || points.length === 0) return null
    return {
      type: 'FeatureCollection',
      features: points
        .filter((p) => p.geom)
        .map((p) => {
          const props: PointProps = { obj_id: p.obj_id }
          for (const it of INDICES) props[it.key as string] = p[it.key] as number | null
          return { type: 'Feature' as const, geometry: p.geom, properties: props }
        }),
    }
  }, [points])

  const mapBounds = useMemo<[number, number, number, number] | null>(() => {
    if (ring) return bboxFromRing(ring)
    if (points && points.length > 0) {
      const lons = points.map((p) => p.geom.coordinates[0]!)
      const lats = points.map((p) => p.geom.coordinates[1]!)
      return [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)]
    }
    return null
  }, [ring, points])

  useEffect(() => {
    if (!mapRef.current || !mapBounds) return
    mapRef.current.fitBounds(mapBounds, { padding: 40, duration: 600, maxZoom: 18 })
  }, [mapBounds])

  return (
    <div className="relative h-full w-full">
      <Map
        ref={mapRef}
        onMove={mapSync ? handleCameraMove : undefined}
        initialViewState={
          mapBounds
            ? { bounds: mapBounds, fitBoundsOptions: { padding: 40, maxZoom: 18 } }
            : { longitude: -101, latitude: 20.5, zoom: 6 }
        }
        maxZoom={20}
        mapStyle={ESRI_STYLE}
        attributionControl={false}
        style={{ width: '100%', height: '100%' }}
        cursor={hoveringPoint ? 'pointer' : ''}
        interactiveLayerIds={pointsGeojson ? [POINTS_LAYER_ID] : []}
        onMouseMove={(e) => setHoveringPoint(!!e.features?.length)}
        onMouseLeave={() => setHoveringPoint(false)}
        onClick={(e) => {
          // Clic sobre un punto: abre su tooltip. Clic en cualquier otro lado: lo cierra.
          const f = e.features?.[0]
          if (f) {
            const [lon, lat] = (f.geometry as GeoJSON.Point).coordinates as [number, number]
            setSelected({ lon, lat, props: f.properties as PointProps })
          } else {
            setSelected(null)
          }
        }}
      >
        {/* Superficie interpolada (gradiente continuo) recortada a la parcela. */}
        {surface && (
          <Source
            id="ndvi-surface"
            type="image"
            url={surface.dataUrl}
            coordinates={surface.coordinates}
          >
            <Layer
              id="ndvi-surface-raster"
              type="raster"
              paint={{
                'raster-opacity': 0.9,
                'raster-resampling': 'linear',
                'raster-fade-duration': 0,
              }}
            />
          </Source>
        )}

        {/* Contorno de la parcela por encima. */}
        {plotGeojson && (
          <Source id="ndvi-plot" type="geojson" data={plotGeojson}>
            <Layer
              id="ndvi-plot-outline"
              type="line"
              paint={{ 'line-color': '#16a34a', 'line-width': 2 }}
            />
          </Source>
        )}

        {/* Puntos de muestreo: capa casi transparente, solo para consultar (tooltip). */}
        {pointsGeojson && (
          <Source id="ndvi-points" type="geojson" data={pointsGeojson}>
            <Layer
              id={POINTS_LAYER_ID}
              type="circle"
              paint={{
                // Puntos pequeños y muy tenues: casi no se notan sobre la superficie de
                // color, pero siguen siendo clicables (MapLibre consulta el círculo
                // completo aunque su relleno sea casi transparente).
                'circle-radius': ['interpolate', ['linear'], ['zoom'], 12, 3, 18, 5],
                'circle-color': '#000000',
                'circle-opacity': 0.02,
                'circle-stroke-color': '#ffffff',
                'circle-stroke-width': 1,
                'circle-stroke-opacity': 0.06,
              }}
            />
          </Source>
        )}

        {/* Tooltip del punto seleccionado con clic. */}
        {selected && (
          <Popup
            longitude={selected.lon}
            latitude={selected.lat}
            closeButton
            // El cierre por clic en el mapa ya lo maneja onClick del Map; dejarlo
            // activo aquí también cerraría el popup antes de seleccionar otro punto.
            closeOnClick={false}
            onClose={() => setSelected(null)}
            anchor="bottom"
            offset={10}
            style={{ padding: 0 }}
          >
            <div className="min-w-[150px] space-y-0.5 px-2 py-1.5 text-xs">
              <p className="font-semibold text-gray-700">Punto {selected.props.obj_id ?? '—'}</p>
              <p>
                {INDICES.find((i) => i.key === indexKey)?.label}:{' '}
                <span className="font-medium tabular-nums">
                  {typeof selected.props[indexKey as string] === 'number'
                    ? (selected.props[indexKey as string] as number).toFixed(3)
                    : '—'}
                </span>
              </p>
              <div className="mt-1 grid grid-cols-2 gap-x-2 gap-y-0.5 border-t pt-1 text-[10px] text-gray-500">
                {INDICES.filter(
                  (it) =>
                    it.key !== indexKey && typeof selected.props[it.key as string] === 'number'
                ).map((it) => (
                  <span key={it.key as string} className="flex justify-between gap-1">
                    <span>{it.label}</span>
                    <span className="tabular-nums">
                      {(selected.props[it.key as string] as number).toFixed(3)}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          </Popup>
        )}
      </Map>

      <div className="absolute right-3 top-3 z-10">
        <MapModeSelector active={mapMode} onChange={setMapMode} />
      </div>

      {/* Superficie por clase. Va abajo a la derecha: arriba a la derecha esta el selector
          de modo y abajo a la izquierda la leyenda, asi que es la unica esquina libre. */}
      {classAreas && (
        <div className="absolute bottom-3 right-3 z-10">
          <NdviClassAreaCard
            summary={classAreas}
            indexLabel={INDICES.find((i) => i.key === indexKey)?.label ?? ''}
            open={areaCardOpen}
            onToggle={() => setAreaCardOpen((v) => !v)}
            plotAreaHa={plotAreaHa}
            equalAreaByConstruction={!manualLegend}
          />
        </div>
      )}

      <div className="absolute left-3 top-3 z-10 rounded-md bg-white/90 p-2 shadow">
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-gray-600">Índice</label>
          <select
            className="rounded border px-2 py-1 text-sm"
            value={indexKey as string}
            onChange={(e) => setIndexKey(e.target.value as keyof NdviPoint)}
          >
            {INDICES.map((it) => (
              <option key={it.key as string} value={it.key as string}>
                {it.label}
              </option>
            ))}
          </select>
        </div>
        <p className="mt-1 text-[10px] italic text-gray-400">Deslice para ver datos puntual</p>
      </div>

      <div className="absolute bottom-3 left-3 z-10 w-56 rounded-md bg-white/90 p-3 shadow">
        {isLoading ? (
          <div role="status" className="flex items-center gap-2 text-sm font-medium text-secondary">
            <GpaLoader size="sm" />
            <span>Cargando puntos NDVI…</span>
          </div>
        ) : !surface ? (
          <p className="text-sm text-gray-500">
            {ring ? 'Sin datos para este índice.' : 'La parcela no tiene polígono para interpolar.'}
          </p>
        ) : (
          <div>
            <p className="mb-2 text-xs font-semibold text-gray-700">
              {INDICES.find((i) => i.key === indexKey)?.label} · {points?.length ?? 0} puntos
            </p>

            {/* Estadisticas del indice activo, del mismo endpoint que alimenta la tabla
                de la sesion: asi el visor y el task-manager nunca muestran numeros
                distintos para la misma sesion. */}
            {activeStat && (
              <dl className="mb-2 grid grid-cols-2 gap-x-2 gap-y-0.5 rounded bg-gray-100/70 px-2 py-1 text-[10px] text-gray-600">
                <div className="flex justify-between gap-1">
                  <dt>Media</dt>
                  <dd className="font-medium tabular-nums text-gray-800">
                    {fmtStat(activeStat.mean)}
                  </dd>
                </div>
                <div className="flex justify-between gap-1">
                  <dt>Desv.</dt>
                  <dd className="tabular-nums">{fmtStat(activeStat.stddev)}</dd>
                </div>
                <div className="flex justify-between gap-1">
                  <dt>Mín</dt>
                  <dd className="tabular-nums">{fmtStat(activeStat.min)}</dd>
                </div>
                <div className="flex justify-between gap-1">
                  <dt>Máx</dt>
                  <dd className="tabular-nums">{fmtStat(activeStat.max)}</dd>
                </div>
              </dl>
            )}

            {manualLegend ? (
              /* Modo manual: clases de la config del tenant. */
              <>
                <ul className="space-y-1">
                  {manualLegend.map((b, i) => (
                    <li key={i} className="flex items-center gap-2 text-xs">
                      <span
                        className="inline-block h-3 w-4 rounded-sm border border-black/10"
                        style={{ backgroundColor: b.color }}
                      />
                      <span className="text-gray-700">{b.label}</span>
                      <span className="ml-auto tabular-nums text-gray-500">
                        {b.min ?? '−∞'} – {b.max ?? '+∞'}
                      </span>
                    </li>
                  ))}
                </ul>
                {/* Sin este aviso, unos umbrales que no cubren el rango del indice dejan
                    la superficie transparente y el mapa parece roto sin decir por que.
                    Pasa facil: las clases manuales nacen en 0..1 y varios indices se
                    salen de ahi (VARI y suelo desnudo dan negativos, MSAVI2 pasa de 1). */}
                {surface.outsideBands > 0.01 && (
                  <p className="mt-2 rounded border border-amber-300 bg-amber-50 px-2 py-1 text-[10px] leading-snug text-amber-800">
                    {(surface.outsideBands * 100).toFixed(0)}% del área queda sin pintar: esos
                    valores no caen en ninguna clase configurada. El índice va de{' '}
                    <span className="tabular-nums">{surface.min.toFixed(3)}</span> a{' '}
                    <span className="tabular-nums">{surface.max.toFixed(3)}</span>; ajusta los
                    umbrales en Configuración de variables de análisis.
                  </p>
                )}
              </>
            ) : quartileLegend ? (
              /* Modo automático: escala de color por cuantiles (bajo -> alto) con
                 líneas en los valores de corte. Segmentos de igual ancho (cada cuantil
                 agrupa el mismo número de puntos); las etiquetas dan el valor real. */
              (() => {
                const ticks = [quartileLegend[0]!.min, ...quartileLegend.map((b) => b.max)]
                const n = quartileLegend.length
                return (
                  <div>
                    <div className="flex h-3 w-full overflow-hidden rounded border border-black/10">
                      {quartileLegend.map((b, i) => (
                        <div
                          key={i}
                          className="h-full flex-1"
                          style={{ backgroundColor: b.color }}
                          title={`Q${i + 1}: ${b.min.toFixed(3)} – ${b.max.toFixed(3)}`}
                        />
                      ))}
                    </div>
                    <div className="relative mt-1 h-6">
                      {ticks.map((v, i) => (
                        <div
                          key={i}
                          className="absolute top-0 flex flex-col items-center"
                          style={{
                            left: `${(i / n) * 100}%`,
                            transform:
                              i === 0
                                ? 'translateX(0)'
                                : i === n
                                  ? 'translateX(-100%)'
                                  : 'translateX(-50%)',
                          }}
                        >
                          <span className="h-1.5 w-px bg-gray-500" />
                          <span className="mt-0.5 text-[10px] tabular-nums text-gray-600">
                            {v.toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })()
            ) : (
              /* Modo automático: gradiente continuo ecualizado. */
              <>
                <div className="h-3 w-full rounded" style={{ background: LEGEND_GRADIENT }} />
                <div className="mt-1 flex justify-between text-[11px] tabular-nums text-gray-600">
                  <span>{surface.min.toFixed(3)}</span>
                  <span>{surface.max.toFixed(3)}</span>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
