import { useState } from 'react'
import Map, { Layer, Source, Popup } from 'react-map-gl/maplibre'
import { usePlotGeometry } from '../hooks/usePlotGeometry'

interface PlotMiniMapProps {
  plotId: string | null
  /** Muestra un popup al pasar el cursor sobre el polígono. */
  showTooltip?: boolean
}

type HoverPos = { lon: number; lat: number }

const ESRI_STYLE = {
  version: 8 as const,
  sources: {
    esri: {
      type: 'raster' as const,
      tiles: [
        'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      ],
      tileSize: 256,
      // maxzoom declara el último nivel con tiles reales; MapLibre hace overzoom
      // (estira el tile) más allá de este punto en lugar de mostrar en blanco.
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

/** Convierte hectáreas (string decimal) a m² formateado. */
function haToM2(ha: string | null | undefined): string | null {
  const n = parseFloat(ha ?? '')
  if (isNaN(n)) return null
  return (n * 10_000).toLocaleString('es-MX', { maximumFractionDigits: 0 })
}

export function PlotMiniMap({ plotId, showTooltip = false }: PlotMiniMapProps) {
  const { data: plot, isLoading } = usePlotGeometry(plotId)
  const [hoverPos, setHoverPos] = useState<HoverPos | null>(null)

  if (!plotId) {
    return (
      <div className="flex h-36 items-center justify-center rounded-md border bg-muted/30 text-sm text-muted-foreground">
        Parcela no asignada
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex h-36 items-center justify-center rounded-md border bg-muted/30 text-sm text-muted-foreground">
        Cargando mapa…
      </div>
    )
  }

  const coords = plot?.geometry?.coordinates?.[0]
  if (!coords || coords.length === 0) {
    return (
      <div className="flex h-36 flex-col items-center justify-center gap-1 rounded-md border bg-muted/30 px-4 text-center text-xs text-muted-foreground">
        <span className="font-medium">Geometría no disponible</span>
        <span>Carga el polígono de la parcela desde la sección de Geo-activos → Parcelas → Importar vértices.</span>
      </div>
    )
  }

  const geojson = {
    type: 'Feature' as const,
    geometry: plot!.geometry as GeoJSON.Geometry,
    properties: {},
  }

  const props = plot?.properties
  const m2 = haToM2(props?.total_area)

  return (
    <div className="h-80 w-full overflow-hidden rounded-md border">
      <Map
        initialViewState={{ bounds: bboxFromCoords(coords), fitBoundsOptions: { padding: 60 } }}
        mapStyle={ESRI_STYLE}
        // cooperativeGestures: requiere Ctrl+scroll para zoom, evita secuestrar el scroll del dialog
        cooperativeGestures
        interactiveLayerIds={showTooltip ? ['plot-fill'] : []}
        onMouseMove={(e) => {
          if (!showTooltip) return
          // e.features se puebla solo cuando el cursor está sobre una capa de interactiveLayerIds
          if (e.features && e.features.length > 0) {
            setHoverPos({ lon: e.lngLat.lng, lat: e.lngLat.lat })
          } else {
            setHoverPos(null)
          }
        }}
        onMouseLeave={() => setHoverPos(null)}
        attributionControl={false}
        style={{ width: '100%', height: '100%' }}
      >
        <Source id="plot" type="geojson" data={geojson}>
          <Layer
            id="plot-fill"
            type="fill"
            paint={{ 'fill-color': '#22c55e', 'fill-opacity': 0.25 }}
          />
          <Layer
            id="plot-outline"
            type="line"
            paint={{ 'line-color': '#16a34a', 'line-width': 2 }}
          />
        </Source>

        {showTooltip && hoverPos && (
          <Popup
            longitude={hoverPos.lon}
            latitude={hoverPos.lat}
            closeButton={false}
            closeOnClick={false}
            anchor="bottom"
            offset={10}
            style={{ padding: 0 }}
          >
            <div className="px-2 py-1.5 text-xs space-y-0.5 min-w-[120px]">
              <p className="font-semibold text-foreground">{props?.code ?? '—'}</p>
              {props?.total_area && (
                <p className="text-muted-foreground">
                  {props.total_area} ha
                  {m2 && <span className="ml-1">· {m2} m²</span>}
                </p>
              )}
              {props?.status && (
                <p className="text-muted-foreground capitalize">{props.status}</p>
              )}
            </div>
          </Popup>
        )}
      </Map>
    </div>
  )
}
