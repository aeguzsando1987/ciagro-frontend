import Map, { Layer, Source } from 'react-map-gl/maplibre'
import { usePlotGeometry } from '../hooks/usePlotGeometry'

interface PlotMiniMapProps {
  plotId: string | null
}

const ESRI_STYLE = {
  version: 8 as const,
  sources: {
    esri: {
      type: 'raster' as const,
      tiles: [
        'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      ],
      tileSize: 256,
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

export function PlotMiniMap({ plotId }: PlotMiniMapProps) {
  const { data: plot, isLoading } = usePlotGeometry(plotId)

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

  return (
    <div className="h-80 w-full overflow-hidden rounded-md border">
      <Map
        initialViewState={{ bounds: bboxFromCoords(coords), fitBoundsOptions: { padding: 60 } }}
        mapStyle={ESRI_STYLE}
        interactive={false}
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
      </Map>
    </div>
  )
}
