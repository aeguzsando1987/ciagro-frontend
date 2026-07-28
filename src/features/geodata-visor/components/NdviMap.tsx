/**
 * Mapa de una sesión NDVI — enfoque simple de PUNTOS COLOREADOS por clase.
 *
 * En vez de interpolar/contornear en el backend (resultaba errático), se grafican los
 * propios puntos de muestreo coloreados según el valor del índice seleccionado, en 4
 * clases por cuartiles calculados EN CLIENTE. Emula visualmente el mapa de calor/kriging
 * sin artefactos de interpolación, y es fiel al dato real.
 *
 * Datos:
 *   GET /geo_assets/plots/<id>/                        (polígono de la parcela)
 *   GET /monitoring/ndvi/points/?session_header=<id>   (puntos con los 15 índices)
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import Map, { Layer, Source } from 'react-map-gl/maplibre'
import type { MapRef } from 'react-map-gl/maplibre'
import { usePlotGeometry } from '@/features/task-manager/hooks/usePlotGeometry'
import { ESRI_STYLE } from '../lib/aspersionMap.helpers'
import { useMapMode } from '../lib/mapModes'
import { MapModeSelector } from './MapModeSelector'
import { useNdviPoints, type NdviPoint } from '../hooks/useNdviPoints'

// Índices disponibles (columnas del punto) con su etiqueta legible.
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

// Paleta de 4 clases rojo -> azul (RdYlBu): rojo = valor bajo, azul = valor alto.
const PALETTE = ['#d7191c', '#fdae61', '#abd9e9', '#2c7bb6']

// Pintura de la capa de puntos. El radio crece con el zoom para que los puntos vecinos se
// traslapen y, con el blur, se fundan en un campo continuo (aspecto de heatmap/kriging) al
// acercarse — sin interpolar en el servidor. El color por clase se toma de cada feature.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CIRCLE_PAINT: any = {
  'circle-color': ['get', 'color'],
  'circle-radius': [
    'interpolate', ['exponential', 2], ['zoom'],
    12, 3,
    15, 8,
    17, 20,
    19, 48,
    21, 110,
  ],
  'circle-blur': 1,
  'circle-opacity': 0.5,
}

function bboxFromRing(ring: number[][]): [number, number, number, number] {
  const lngs = ring.map((c) => c[0] as number)
  const lats = ring.map((c) => c[1] as number)
  return [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)]
}

/** Cortes por cuartiles (Q1, Q2/mediana, Q3) sobre valores ordenados. */
function quartileCuts(values: number[]): [number, number, number] | null {
  if (values.length < 4) return null
  const s = [...values].sort((a, b) => a - b)
  const at = (q: number) => s[Math.floor(q * (s.length - 1))]!
  const c = [at(0.25), at(0.5), at(0.75)] as [number, number, number]
  // Si hay demasiados empates los cortes colapsan: no sirve clasificar.
  if (c[0] === c[2]) return null
  return c
}

function classOf(v: number, cuts: [number, number, number]): number {
  if (v < cuts[0]) return 0
  if (v < cuts[1]) return 1
  if (v < cuts[2]) return 2
  return 3
}

function fmt(v: number): string {
  return v.toFixed(3)
}

interface NdviMapProps {
  sessionId: string
  plotId: string | null | undefined
}

export function NdviMap({ sessionId, plotId }: NdviMapProps) {
  const mapRef = useRef<MapRef>(null)
  const { mapMode, setMapMode } = useMapMode(mapRef)

  const { data: plot } = usePlotGeometry(plotId ?? null)
  const { data: points, isLoading } = useNdviPoints(sessionId)

  const [indexKey, setIndexKey] = useState<keyof NdviPoint>('ndvi')

  // FeatureCollection de puntos con su clase + color, según el índice activo.
  const { fc, legend } = useMemo(() => {
    const empty = { type: 'FeatureCollection', features: [] } as GeoJSON.FeatureCollection
    if (!points || points.length === 0) return { fc: empty, legend: [] as { color: string; label: string }[] }

    const values = points
      .map((p) => p[indexKey])
      .filter((v): v is number => typeof v === 'number')
    const cuts = quartileCuts(values)

    const features: GeoJSON.Feature[] = points
      .filter((p) => typeof p[indexKey] === 'number' && p.geom)
      .map((p) => {
        const v = p[indexKey] as number
        const cls = cuts ? classOf(v, cuts) : 0
        return {
          type: 'Feature' as const,
          geometry: p.geom,
          properties: { value: v, color: PALETTE[cls] },
        }
      })

    const legend = cuts
      ? [
          { color: PALETTE[0]!, label: `< ${fmt(cuts[0])}` },
          { color: PALETTE[1]!, label: `${fmt(cuts[0])} – ${fmt(cuts[1])}` },
          { color: PALETTE[2]!, label: `${fmt(cuts[1])} – ${fmt(cuts[2])}` },
          { color: PALETTE[3]!, label: `≥ ${fmt(cuts[2])}` },
        ]
      : values.length > 0
        ? [{ color: PALETTE[0]!, label: `${fmt(Math.min(...values))} – ${fmt(Math.max(...values))}` }]
        : []

    return { fc: { type: 'FeatureCollection', features } as GeoJSON.FeatureCollection, legend }
  }, [points, indexKey])

  const plotGeojson = useMemo(() => {
    if (!plot?.geometry) return null
    return { type: 'Feature' as const, geometry: plot.geometry, properties: {} }
  }, [plot])

  const mapBounds = useMemo<[number, number, number, number] | null>(() => {
    const ring = plot?.geometry?.coordinates?.[0]
    if (ring && ring.length > 0) return bboxFromRing(ring as number[][])
    // Fallback: bbox de los puntos.
    if (points && points.length > 0) {
      const lons = points.map((p) => p.geom.coordinates[0]!)
      const lats = points.map((p) => p.geom.coordinates[1]!)
      return [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)]
    }
    return null
  }, [plot, points])

  useEffect(() => {
    if (!mapRef.current || !mapBounds) return
    mapRef.current.fitBounds(mapBounds, { padding: 40, duration: 600, maxZoom: 18 })
  }, [mapBounds])

  return (
    <div className="relative h-full w-full">
      <Map
        ref={mapRef}
        initialViewState={
          mapBounds
            ? { bounds: mapBounds, fitBoundsOptions: { padding: 40, maxZoom: 18 } }
            : { longitude: -101, latitude: 20.5, zoom: 6 }
        }
        maxZoom={20}
        mapStyle={ESRI_STYLE}
        attributionControl={false}
        style={{ width: '100%', height: '100%' }}
      >
        {plotGeojson && (
          <Source id="ndvi-plot" type="geojson" data={plotGeojson}>
            <Layer id="ndvi-plot-outline" type="line" paint={{ 'line-color': '#16a34a', 'line-width': 2 }} />
          </Source>
        )}

        {fc.features.length > 0 && (
          <Source id="ndvi-points" type="geojson" data={fc}>
            <Layer id="ndvi-points-circle" type="circle" paint={CIRCLE_PAINT} />
          </Source>
        )}
      </Map>

      {/* Selector de modo de mapa */}
      <div className="absolute right-3 top-3 z-10">
        <MapModeSelector active={mapMode} onChange={setMapMode} />
      </div>

      {/* Selector de índice */}
      <div className="absolute left-3 top-3 z-10 rounded-md bg-white/90 p-2 shadow">
        <label className="mr-2 text-xs font-medium text-gray-600">Índice</label>
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

      {/* Leyenda / estado */}
      <div className="absolute bottom-3 left-3 z-10 max-w-xs rounded-md bg-white/90 p-3 shadow">
        {isLoading ? (
          <p className="text-sm text-gray-500">Cargando puntos…</p>
        ) : fc.features.length === 0 ? (
          <p className="text-sm text-gray-500">Sin datos para este índice.</p>
        ) : (
          <div>
            <p className="mb-2 text-xs font-semibold text-gray-700">
              {INDICES.find((i) => i.key === indexKey)?.label} · {fc.features.length} puntos
            </p>
            <ul className="space-y-1">
              {legend.map((b, i) => (
                <li key={i} className="flex items-center gap-2 text-xs">
                  <span
                    className="inline-block h-3 w-3 rounded-full border border-black/10"
                    style={{ backgroundColor: b.color }}
                  />
                  <span className="text-gray-700">{b.label}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
