/**
 * Mapa de los ranchos de un productor sobre imagen satelital: los polígonos de sus
 * parcelas, coloreados por rancho, y encima un pin con el nombre de cada uno. Al hacer
 * clic en un pin o en un polígono se selecciona ese rancho (sube a nivel rancho → el
 * dashboard pasa a mostrar sus parcelas). Solo lectura.
 *
 * Los polígonos son lo que deja ver la tierra real; el pin solo dice dónde está. Antes
 * solo había pines, así que a nivel de productor no se apreciaba la extensión.
 */
import { useEffect, useMemo, useRef } from 'react'
import Map, { Layer, Marker, Source } from 'react-map-gl/maplibre'
import type { MapRef } from 'react-map-gl/maplibre'
import { MapModeSelector } from './MapModeSelector'
import { useMapMode } from '../lib/mapModes'
import { useMapCameraSync, type MapCameraSyncBinding } from '../lib/mapCameraSync'
import { ESRI_STYLE } from '../lib/aspersionMap.helpers'
import type { RanchFlat, PlotFlat } from '@/features/admin/types'

type Bounds = [number, number, number, number]

/**
 * Colores por rancho, en ORDEN FIJO — nunca se ciclan.
 *
 * Validados con el script de la guía de visualización contra un fondo oscuro, que es
 * lo que más se parece a la imagen satelital: separación para daltonismo ΔE 21.1
 * (deutan) y 13.3 (tritan), visión normal 27.4, contraste >= 3:1. La única
 * comprobación que no pasa es la banda de luminosidad, y es esperable: esa banda se
 * calibra contra una superficie PLANA de gráfico, mientras que aquí el fondo es
 * terreno —variable y a menudo claro—, donde los tonos brillantes a baja opacidad son
 * justo lo que se distingue.
 *
 * La identidad nunca depende del color: cada rancho lleva además su pin con nombre.
 */
const COLORES_RANCHO = [
  '#22d3ee', '#fb923c', '#c084fc', '#a3e635', '#f472b6', '#fbbf24',
] as const

/** Gris neutro para los ranchos que exceden la paleta: ciclar hues seria enga\u00f1oso. */
const COLOR_EXCEDENTE = '#94a3b8'


/** Centroide promedio de las parcelas de un rancho (fallback cuando el rancho no tiene
 *  su propia ubicación). Usa el `centroid` Point de cada parcela. */
function ranchCentroidFromPlots(ranchId: string, plots: PlotFlat[]): [number, number] | null {
  let sx = 0,
    sy = 0,
    n = 0
  for (const p of plots) {
    if (p.ranch !== ranchId) continue
    const c = (p.centroid as { coordinates?: number[] } | null | undefined)?.coordinates
    if (c && c.length >= 2 && Number.isFinite(c[0]) && Number.isFinite(c[1])) {
      sx += c[0]!
      sy += c[1]!
      n++
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
  mapSync?: MapCameraSyncBinding
}

export function ProducerRanchesMap({
  ranches,
  plots,
  onSelectRanch,
  producerName,
  mapSync,
}: ProducerRanchesMapProps) {
  const mapRef = useRef<MapRef>(null)
  const { mapMode, setMapMode } = useMapMode(mapRef)
  const handleCameraMove = useMapCameraSync(mapRef, mapSync)

  const pins = useMemo(
    () =>
      ranches
        .map((r) => ({ ranch: r, coord: ranchCoord(r, plots) }))
        .filter((p): p is { ranch: RanchFlat; coord: [number, number] } => p.coord !== null),
    [ranches, plots]
  )

  /** Color de cada rancho, fijado por su posición en la lista (no por su ranking). */
  // Objeto plano y no `Map`: el componente `Map` de react-map-gl tapa el constructor
  // nativo en este módulo.
  const colorPorRancho = useMemo<Record<string, string>>(() => {
    const porId: Record<string, string> = {}
    ranches.forEach((r, i) => {
      porId[r.id] = COLORES_RANCHO[i] ?? COLOR_EXCEDENTE
    })
    return porId
  }, [ranches])

  const poligonos = useMemo<GeoJSON.FeatureCollection>(() => {
    const deEsteProductor = new Set(ranches.map((r) => r.id))
    return {
      type: 'FeatureCollection',
      features: plots
        .filter((p) => p.geom && p.ranch && deEsteProductor.has(p.ranch))
        .map((p) => ({
          type: 'Feature' as const,
          geometry: p.geom as GeoJSON.Geometry,
          properties: {
            ranchId: p.ranch,
            color: colorPorRancho[p.ranch!] ?? COLOR_EXCEDENTE,
          },
        })),
    }
  }, [plots, ranches, colorPorRancho])

  const hayPoligonos = poligonos.features.length > 0

  const bounds = useMemo<Bounds | null>(() => {
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity
    let hay = false

    const anota = (lon: number, lat: number) => {
      if (!Number.isFinite(lon) || !Number.isFinite(lat)) return
      hay = true
      minX = Math.min(minX, lon)
      maxX = Math.max(maxX, lon)
      minY = Math.min(minY, lat)
      maxY = Math.max(maxY, lat)
    }

    for (const { coord } of pins) anota(coord[0], coord[1])

    // Los polígonos también entran en el encuadre: con solo los pines, una parcela
    // grande quedaba cortada por el borde del mapa.
    const recorre = (nodo: unknown) => {
      if (!Array.isArray(nodo)) return
      if (typeof nodo[0] === 'number' && typeof nodo[1] === 'number') {
        anota(nodo[0], nodo[1])
        return
      }
      for (const hijo of nodo) recorre(hijo)
    }
    for (const f of poligonos.features) {
      recorre((f.geometry as { coordinates?: unknown }).coordinates)
    }

    return hay ? [minX, minY, maxX, maxY] : null
  }, [pins, poligonos])

  useEffect(() => {
    if (!mapRef.current || !bounds) return
    // maxZoom moderado: si solo hay un rancho, no acercar demasiado.
    mapRef.current.fitBounds(bounds, { padding: 80, duration: 600, maxZoom: 13 })
  }, [bounds])

  // Con polígonos ya se ve dónde está el rancho aunque no haya pin.
  const hasPins = pins.length > 0 || hayPoligonos

  return (
    <div className="relative h-full w-full">
      {!hasPins && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 text-sm text-muted-foreground">
          Los ranchos de este productor no tienen ubicación cargada.
        </div>
      )}
      <Map
        ref={mapRef}
        onMove={mapSync ? handleCameraMove : undefined}
        initialViewState={
          bounds
            ? { bounds, fitBoundsOptions: { padding: 80, maxZoom: 13 } }
            : { longitude: -101, latitude: 20.5, zoom: 5 }
        }
        maxZoom={20}
        mapStyle={ESRI_STYLE}
        interactiveLayerIds={hayPoligonos ? ['producer-plots-fill'] : []}
        onClick={(e) => {
          // El polígono es un objetivo mucho mayor que el pin: hace clicable toda la
          // superficie del rancho, no solo su etiqueta.
          const ranchId = e.features?.[0]?.properties?.['ranchId'] as string | undefined
          if (!ranchId) return
          const ranch = ranches.find((r) => r.id === ranchId)
          if (!ranch) return
          onSelectRanch({
            id: ranch.id,
            name: ranch.name ?? ranch.code ?? ranch.id.slice(0, 8),
          })
        }}
        cooperativeGestures
        attributionControl={false}
        style={{ width: '100%', height: '100%' }}
      >
        {hayPoligonos && (
          <Source id="producer-plots" type="geojson" data={poligonos}>
            {/* Relleno translúcido: deja ver el terreno debajo, que es el punto de
                usar imagen satelital. */}
            <Layer
              id="producer-plots-fill"
              type="fill"
              paint={{ 'fill-color': ['get', 'color'] as unknown as string, 'fill-opacity': 0.28 }}
            />
            {/* Contorno opaco: sobre terreno irregular el borde es lo que define la
                parcela; el relleno solo la tiñe. */}
            <Layer
              id="producer-plots-line"
              type="line"
              paint={{ 'line-color': ['get', 'color'] as unknown as string, 'line-width': 2 }}
            />
          </Source>
        )}

        {pins.map(({ ranch, coord }) => (
          <Marker key={ranch.id} longitude={coord[0]} latitude={coord[1]} anchor="bottom">
            <button
              type="button"
              title={`Ver parcelas de ${ranch.name ?? ranch.code ?? ''}`}
              onClick={() =>
                onSelectRanch({
                  id: ranch.id,
                  name: ranch.name ?? ranch.code ?? ranch.id.slice(0, 8),
                })
              }
              className="flex flex-col items-center"
              style={{ cursor: 'pointer' }}
            >
              <span className="whitespace-nowrap rounded-md bg-emerald-800/90 px-2 py-1 text-[11px] font-semibold text-white shadow-md hover:bg-emerald-700">
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

      <MapModeSelector active={mapMode} onChange={setMapMode} />
    </div>
  )
}
