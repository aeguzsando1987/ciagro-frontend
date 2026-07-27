/**
 * Mapa de contornos NDVI (coropleta) de una sesión — componente presentacional
 * auto-contenido, embebible en el dashboard del Visor de Datos Agrícolas.
 *
 * A diferencia de AspersionMap, aquí NO se clasifica en cliente: el backend ya entrega el
 * FeatureCollection con una banda por clase y su `color` (#hex) en las properties. El mapa
 * solo lo pinta (`fill-color = ['get','color']`) y arma la leyenda con `label` + rango.
 *
 * Recibe `sessionId` + `plotId` y carga sus propios datos:
 *   GET /monitoring/ndvi/headers/<id>/contours/indices/   (índices disponibles + estado)
 *   GET /monitoring/ndvi/headers/<id>/contours/?index=<k> (bandas del índice, GeoJSON)
 *   GET /geo_assets/plots/<id>/                            (polígono de la parcela)
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import Map, { Layer, Source } from 'react-map-gl/maplibre'
import type { MapRef } from 'react-map-gl/maplibre'
import { usePlotGeometry } from '@/features/task-manager/hooks/usePlotGeometry'
import { ESRI_STYLE } from '../lib/aspersionMap.helpers'
import { useMapMode } from '../lib/mapModes'
import { MapModeSelector } from './MapModeSelector'
import { useNdviContourIndices } from '../hooks/useNdviContourIndices'
import { useNdviContours, type NdviBandProps } from '../hooks/useNdviContours'

// Etiquetas legibles de los índices más comunes (fallback: la propia clave).
const INDEX_LABELS: Record<string, string> = {
  ndvi: 'NDVI',
  nir_vigor: 'Vigor NIR',
  osavi: 'OSAVI',
  vari: 'VARI',
  bare_soil_index: 'Suelo desnudo',
  image_red: 'Imagen rojo',
  image_green: 'Imagen verde',
  image_blue: 'Imagen azul',
  red_edge: 'Límite rojo',
  swir: 'SWIR',
  ndre: 'NDRE',
  msavi2: 'MSAVI2',
  gndvi: 'GNDVI',
  ndmi: 'NDMI',
  psri: 'PSRI',
}

function bboxFromRing(ring: number[][]): [number, number, number, number] {
  const lngs = ring.map((c) => c[0] as number)
  const lats = ring.map((c) => c[1] as number)
  return [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)]
}

function fmt(v: number | null): string {
  return v === null || v === undefined ? '∞' : v.toFixed(3)
}

interface NdviMapProps {
  sessionId: string
  plotId: string | null | undefined
}

export function NdviMap({ sessionId, plotId }: NdviMapProps) {
  const mapRef = useRef<MapRef>(null)
  const { mapMode, setMapMode } = useMapMode(mapRef)

  const { data: plot } = usePlotGeometry(plotId ?? null)
  const { data: indexData, isLoading: loadingIndices } = useNdviContourIndices(sessionId)

  const indices = useMemo(() => indexData?.indices ?? [], [indexData])
  const contourStatus = indexData?.contour_status ?? null

  // Índice activo: NDVI si está, si no el primero disponible.
  const [activeIndex, setActiveIndex] = useState<string | null>(null)
  useEffect(() => {
    if (indices.length === 0) {
      setActiveIndex(null)
    } else if (!activeIndex || !indices.includes(activeIndex)) {
      setActiveIndex(indices.includes('ndvi') ? 'ndvi' : indices[0]!)
    }
  }, [indices, activeIndex])

  const { data: contours, isLoading: loadingContours } = useNdviContours(sessionId, activeIndex)

  // Leyenda: una entrada por banda, ordenada por band_order.
  const legend = useMemo(() => {
    const feats = contours?.features ?? []
    return feats
      .map((f) => f.properties as NdviBandProps)
      .sort((a, b) => a.band_order - b.band_order)
  }, [contours])

  const plotGeojson = useMemo(() => {
    if (!plot?.geometry) return null
    return { type: 'Feature' as const, geometry: plot.geometry, properties: {} }
  }, [plot])

  const mapBounds = useMemo<[number, number, number, number] | null>(() => {
    const ring = plot?.geometry?.coordinates?.[0]
    if (ring && ring.length > 0) return bboxFromRing(ring as number[][])
    return null
  }, [plot])

  useEffect(() => {
    if (!mapRef.current || !mapBounds) return
    mapRef.current.fitBounds(mapBounds, { padding: 40, duration: 600, maxZoom: 18 })
  }, [mapBounds])

  const generating = contourStatus === 'processing' || contourStatus === null
  const errored = contourStatus === 'error'

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

        {contours && contours.features.length > 0 && (
          <Source id="ndvi-contours" type="geojson" data={contours}>
            <Layer
              id="ndvi-contours-fill"
              type="fill"
              paint={{
                // El color viene por feature desde el backend (banda ya clasificada).
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                'fill-color': ['get', 'color'] as unknown as any,
                'fill-opacity': 0.6,
                'fill-outline-color': 'rgba(0,0,0,0.15)',
              }}
            />
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
          value={activeIndex ?? ''}
          disabled={indices.length === 0}
          onChange={(e) => setActiveIndex(e.target.value)}
        >
          {indices.length === 0 && <option value="">—</option>}
          {indices.map((k) => (
            <option key={k} value={k}>
              {INDEX_LABELS[k] ?? k}
            </option>
          ))}
        </select>
      </div>

      {/* Estado / leyenda */}
      <div className="absolute bottom-3 left-3 z-10 max-w-xs rounded-md bg-white/90 p-3 shadow">
        {generating && (
          <p className="text-sm text-amber-600">
            <span className="mr-1 animate-spin">⏳</span> Generando contornos…
          </p>
        )}
        {errored && <p className="text-sm text-red-600">Error al generar los contornos.</p>}
        {!generating && !errored && (loadingIndices || loadingContours) && (
          <p className="text-sm text-gray-500">Cargando…</p>
        )}
        {!generating && !errored && legend.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold text-gray-700">
              {INDEX_LABELS[activeIndex ?? ''] ?? activeIndex}
            </p>
            <ul className="space-y-1">
              {legend.map((b) => (
                <li key={b.band_order} className="flex items-center gap-2 text-xs">
                  <span
                    className="inline-block h-3 w-4 rounded-sm border border-black/10"
                    style={{ backgroundColor: b.color ?? '#ccc' }}
                  />
                  <span className="text-gray-700">
                    {b.label ?? `Banda ${b.band_order + 1}`}
                  </span>
                  <span className="ml-auto tabular-nums text-gray-500">
                    {fmt(b.band_min)} – {fmt(b.band_max)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
