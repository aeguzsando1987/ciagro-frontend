/**
 * Mapa de los ranchos de un productor: un pin por rancho (geom Point), con su nombre.
 * Al hacer clic en un pin se selecciona ese rancho (sube a nivel rancho → el dashboard
 * pasa a mostrar sus parcelas). Solo lectura.
 */
import { useEffect, useMemo, useRef } from 'react'
import Map, { Marker } from 'react-map-gl/maplibre'
import type { MapRef } from 'react-map-gl/maplibre'
import { ESRI_STYLE } from './AspersionMap'
import type { RanchFlat, PlotFlat } from '@/features/admin/types'

type Bounds = [number, number, number, number]

/** Centroide promedio de las parcelas de un rancho (fallback cuando el rancho no tiene
 *  su propia ubicación). Usa el `centroid` Point de cada parcela. */
function ranchCentroidFromPlots(ranchId: string, plots: PlotFlat[]): [number, number] | null {
  let sx = 0, sy = 0, n = 0
  for (const p of plots) {
    if (p.ranch !== ranchId) continue
    const c = (p.centroid as { coordinates?: number[] } | null | undefined)?.coordinates
    if (c && c.length >= 2 && Number.isFinite(c[0]) && Number.isFinite(c[1])) {
      sx += c[0]!; sy += c[1]!; n++
    }
  }
  return n > 0 ? [sx / n, sy / n] : null
}

/** Coordenada [lon, lat] de un rancho: geom Point → lat/lon → centroide de sus parcelas. */
function ranchCoord(ranch: RanchFlat, plots: PlotFlat[]): [number, number] | null {
  const c = (ranch.geom as { coordinates?: number[] } | null | undefined)?.coordinates
  if (c && c.length >= 2 && Number.isFinite(c[0]) && Number.isFinite(c[1])) return [c[0]!, c[1]!]
  const lon = parseFloat(String(ranch.lon ?? ''))
  const lat = parseFloat(String(ranch.lat ?? ''))
  if (Number.isFinite(lon) && Number.isFinite(lat)) return [lon, lat]
  return ranchCentroidFromPlots(ranch.id, plots)
}

interface ProducerRanchesMapProps {
  ranches: RanchFlat[]
  /** Parcelas del productor: fallback de ubicación para ranchos sin geom propio. */
  plots: PlotFlat[]
  onSelectRanch: (ranch: { id: string; name: string }) => void
  producerName?: string
}

export function ProducerRanchesMap({ ranches, plots, onSelectRanch, producerName }: ProducerRanchesMapProps) {
  const mapRef = useRef<MapRef>(null)

  const pins = useMemo(
    () =>
      ranches
        .map((r) => ({ ranch: r, coord: ranchCoord(r, plots) }))
        .filter((p): p is { ranch: RanchFlat; coord: [number, number] } => p.coord !== null),
    [ranches, plots],
  )

  const bounds = useMemo<Bounds | null>(() => {
    if (pins.length === 0) return null
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const { coord } of pins) {
      minX = Math.min(minX, coord[0]); maxX = Math.max(maxX, coord[0])
      minY = Math.min(minY, coord[1]); maxY = Math.max(maxY, coord[1])
    }
    return [minX, minY, maxX, maxY]
  }, [pins])

  useEffect(() => {
    if (!mapRef.current || !bounds) return
    // maxZoom moderado: si solo hay un rancho, no acercar demasiado.
    mapRef.current.fitBounds(bounds, { padding: 80, duration: 600, maxZoom: 13 })
  }, [bounds])

  const hasPins = pins.length > 0

  return (
    <div className="relative h-full w-full">
      {!hasPins && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 text-sm text-muted-foreground">
          Los ranchos de este productor no tienen ubicación cargada.
        </div>
      )}
      <Map
        ref={mapRef}
        initialViewState={
          bounds
            ? { bounds, fitBoundsOptions: { padding: 80, maxZoom: 13 } }
            : { longitude: -101, latitude: 20.5, zoom: 5 }
        }
        maxZoom={20}
        mapStyle={ESRI_STYLE}
        cooperativeGestures
        attributionControl={false}
        style={{ width: '100%', height: '100%' }}
      >
        {pins.map(({ ranch, coord }) => (
          <Marker key={ranch.id} longitude={coord[0]} latitude={coord[1]} anchor="bottom">
            <button
              type="button"
              title={`Ver parcelas de ${ranch.name ?? ranch.code ?? ''}`}
              onClick={() => onSelectRanch({ id: ranch.id, name: ranch.name ?? ranch.code ?? ranch.id.slice(0, 8) })}
              className="flex flex-col items-center"
              style={{ cursor: 'pointer' }}
            >
              <span className="rounded-md bg-emerald-800/90 px-2 py-1 text-[11px] font-semibold text-white shadow-md whitespace-nowrap hover:bg-emerald-700">
                📍 {ranch.name ?? ranch.code ?? ranch.id.slice(0, 8)}
              </span>
              <span className="h-2 w-0.5 bg-emerald-800/90" />
            </button>
          </Marker>
        ))}
      </Map>

      {producerName && (
        <div className="pointer-events-none absolute left-3 top-3 z-10 rounded-md bg-black/55 px-3 py-2 text-white shadow">
          <div className="text-[11px] opacity-80">Productor</div>
          <div className="text-sm font-semibold leading-tight">{producerName}</div>
          <div className="mt-1 text-[10px] opacity-90">Clic en un rancho para ver sus parcelas</div>
        </div>
      )}
    </div>
  )
}
