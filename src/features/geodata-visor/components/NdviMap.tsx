/**
 * Mapa de una sesión NDVI — superficie interpolada (gradiente continuo).
 *
 * A partir de los puntos de muestreo se interpola una superficie (IDW en el cliente) sobre
 * el polígono de la parcela y se pinta como imagen ráster con remuestreo lineal, produciendo
 * un gradiente de color continuo tipo heatmap/kriging. La imagen se recorta a la parcela
 * (celdas fuera del polígono transparentes). Ver lib/ndviInterpolation.ts.
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
import { buildInterpolatedImage, type InterpPoint } from '../lib/ndviInterpolation'

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
const LEGEND_GRADIENT =
  'linear-gradient(to right, #d32f2f, #f57c00, #388e3c, #00acc1, #1565c0)'

function bboxFromRing(ring: number[][]): [number, number, number, number] {
  const lngs = ring.map((c) => c[0] as number)
  const lats = ring.map((c) => c[1] as number)
  return [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)]
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
    return buildInterpolatedImage(interp)
  }, [ring, points, indexKey])

  const plotGeojson = useMemo(() => {
    if (!plot?.geometry) return null
    return { type: 'Feature' as const, geometry: plot.geometry, properties: {} }
  }, [plot])

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
              paint={{ 'raster-opacity': 0.9, 'raster-resampling': 'linear', 'raster-fade-duration': 0 }}
            />
          </Source>
        )}

        {/* Contorno de la parcela por encima. */}
        {plotGeojson && (
          <Source id="ndvi-plot" type="geojson" data={plotGeojson}>
            <Layer id="ndvi-plot-outline" type="line" paint={{ 'line-color': '#16a34a', 'line-width': 2 }} />
          </Source>
        )}
      </Map>

      <div className="absolute right-3 top-3 z-10">
        <MapModeSelector active={mapMode} onChange={setMapMode} />
      </div>

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

      <div className="absolute bottom-3 left-3 z-10 w-56 rounded-md bg-white/90 p-3 shadow">
        {isLoading ? (
          <p className="text-sm text-gray-500">Cargando puntos…</p>
        ) : !surface ? (
          <p className="text-sm text-gray-500">
            {ring ? 'Sin datos para este índice.' : 'La parcela no tiene polígono para interpolar.'}
          </p>
        ) : (
          <div>
            <p className="mb-2 text-xs font-semibold text-gray-700">
              {INDICES.find((i) => i.key === indexKey)?.label} · {points?.length ?? 0} puntos
            </p>
            <div className="h-3 w-full rounded" style={{ background: LEGEND_GRADIENT }} />
            <div className="mt-1 flex justify-between text-[11px] tabular-nums text-gray-600">
              <span>{surface.min.toFixed(3)}</span>
              <span>{surface.max.toFixed(3)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
