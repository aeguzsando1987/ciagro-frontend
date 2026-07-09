/**
 * Mapa de monitoreo fitosanitario de una sesión — símil del mapa de aspersión.
 *
 * Sobre la imagen satelital ESRI pinta:
 *  - El polígono de la parcela relleno en VERDE (área sana base).
 *  - Un mapa de calor ROJO sobre los checkpoints con problema (presence_status
 *    'warning' + 'critical', ponderado: crítica pesa más; 'low' no aporta calor).
 *  - Un marcador por checkpoint (color por presencia) inspeccionable con popup.
 *
 * Carga sus propios datos a partir de `sessionId` (header) + `plotId`.
 */
import { useMemo, useState } from 'react'
import Map, { Layer, Source, Popup } from 'react-map-gl/maplibre'
import type { MapLayerMouseEvent } from 'react-map-gl/maplibre'
import { ESRI_STYLE } from '@/features/geodata-visor/lib/aspersionMap.helpers'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { usePlotGeometry } from '../hooks/usePlotGeometry'
import { usePhytoCheckPoints, type PhytoCheckpointProps } from '../hooks/usePhytoCheckPoints'

interface PhytoMapProps {
  /** UUID del PhytoMonitoringHeader. */
  sessionId: string
  plotId: string | null
  enabled?: boolean
  toolbarStart?: React.ReactNode
  toolbarEnd?: React.ReactNode
}

function bboxFromCoords(coords: number[][]): [number, number, number, number] {
  const lngs = coords.map((c) => c[0] as number)
  const lats = coords.map((c) => c[1] as number)
  return [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)]
}

const PRESENCE_COLOR: Record<string, string> = {
  low: '#10b981',
  warning: '#f59e0b',
  critical: '#dc2626',
}
const PRESENCE_LABEL: Record<string, string> = {
  low: 'Baja',
  warning: 'Advertencia',
  critical: 'Crítica',
}

// Capa de calor: solo advertencia/crítica aportan (crítica pesa más).
const HEAT_WEIGHT = [
  'match', ['get', 'presence_status'],
  'critical', 1,
  'warning', 0.7,
  0,
] as unknown[]

// Rampa intensa SIN halo blanquecino: se mantiene el mismo tono rojo en toda la
// rampa y solo varía la opacidad, de modo que el borde de baja densidad se desvanece
// en rojo translúcido (no en un rosa/blanco pálido).
const HEAT_COLOR = [
  'interpolate', ['linear'], ['heatmap-density'],
  0, 'rgba(220,38,38,0)',
  0.2, 'rgba(220,38,38,0.35)',
  0.5, 'rgba(220,38,38,0.7)',
  0.8, 'rgba(200,20,20,0.9)',
  1, 'rgba(153,27,27,1)',
] as unknown[]


// Color del marcador según presencia.
const CIRCLE_COLOR = [
  'match', ['get', 'presence_status'],
  'critical', PRESENCE_COLOR.critical,
  'warning', PRESENCE_COLOR.warning,
  'low', PRESENCE_COLOR.low,
  '#94a3b8',
] as unknown[]

// Prioridad de presencia para elegir la "peor" de un punto con varios hallazgos.
const PRESENCE_RANK: Record<string, number> = { low: 0, warning: 1, critical: 2 }

type HoverInfo = { lon: number; lat: number; items: PhytoCheckpointProps[] }

export function PhytoMap({ sessionId, plotId, enabled = true, toolbarStart, toolbarEnd }: PhytoMapProps) {
  const { data: fc, isLoading } = usePhytoCheckPoints(sessionId, enabled)
  const { data: plot } = usePlotGeometry(plotId)
  const [popup, setPopup] = useState<HoverInfo | null>(null)
  const [photoModal, setPhotoModal] = useState<string | null>(null)
  const [noteModal, setNoteModal] = useState<string | null>(null)

  const plotGeojson = plot?.geometry

  // Agrupa los checkpoints por coordenada: en un mismo punto puede haber varias
  // plagas/enfermedades. `pointsFC` tiene un marcador por punto CON peligro (peor
  // presencia del grupo); `groups` guarda todos los hallazgos por punto para el popup.
  // (Objeto plano, no `Map`, porque `Map` está sombreado por react-map-gl.)
  const { groups, pointsFC } = useMemo(() => {
    const g: Record<string, PhytoCheckpointProps[]> = {}
    if (fc) {
      for (const f of fc.features) {
        const key = f.geometry.coordinates.join(',')
        ;(g[key] ??= []).push(f.properties)
      }
    }
    const features = Object.entries(g)
      .map(([key, items]) => ({
        key,
        items,
        worst: Math.max(...items.map((i) => PRESENCE_RANK[i.presence_status] ?? 0)),
      }))
      .filter((x) => x.worst >= 1) // solo puntos con peligro
      .map((x) => {
        const parts = x.key.split(',').map(Number)
        return {
          type: 'Feature' as const,
          geometry: { type: 'Point' as const, coordinates: [parts[0] ?? 0, parts[1] ?? 0] },
          properties: {
            key: x.key,
            presence_status: x.worst >= 2 ? 'critical' : 'warning',
            count: x.items.length,
          },
        }
      })
    return { groups: g, pointsFC: { type: 'FeatureCollection' as const, features } }
  }, [fc])

  const mapBounds = useMemo<[number, number, number, number] | null>(() => {
    const plotCoords = plot?.geometry?.coordinates?.[0]
    if (plotCoords && plotCoords.length > 0) return bboxFromCoords(plotCoords as number[][])
    if (fc && fc.features.length > 0) {
      return bboxFromCoords(fc.features.map((f) => f.geometry.coordinates))
    }
    return null
  }, [plot, fc])

  const isEmpty = !isLoading && fc && fc.features.length === 0

  function handleClick(e: MapLayerMouseEvent) {
    const feat = e.features?.[0]
    if (feat) {
      const key = (feat.properties as { key?: string }).key
      const items = key ? (groups[key] ?? []) : []
      const coords = (feat.geometry as GeoJSON.Point).coordinates
      setPopup({ lon: coords[0] as number, lat: coords[1] as number, items })
    } else {
      setPopup(null)
    }
  }

  return (
    <div className="flex h-full flex-col">
      {(toolbarStart || toolbarEnd) && (
        <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
          <div className="flex items-center gap-2">{toolbarStart}</div>
          <div className="flex items-center gap-2">{toolbarEnd}</div>
        </div>
      )}

      <div className="relative flex-1">
        {isLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 text-sm text-muted-foreground">
            <span className="mr-2 animate-spin">⏳</span> Cargando puntos…
          </div>
        )}
        {isEmpty && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 text-sm text-muted-foreground">
            Esta sesión aún no tiene puntos capturados.
          </div>
        )}

        {/* Leyenda */}
        <div className="absolute right-2 top-2 z-10 rounded border bg-background/90 px-3 py-2 text-xs shadow-sm">
          <p className="mb-1 font-medium">Presencia</p>
          {(['critical', 'warning'] as const).map((k) => (
            <div key={k} className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: PRESENCE_COLOR[k] }} />
              <span className="text-muted-foreground">{PRESENCE_LABEL[k]}</span>
            </div>
          ))}
        </div>

        <Map
          initialViewState={
            mapBounds
              ? { bounds: mapBounds, fitBoundsOptions: { padding: 56, maxZoom: 18 } }
              : { longitude: -101, latitude: 20.5, zoom: 6 }
          }
          maxZoom={20}
          mapStyle={ESRI_STYLE}
          attributionControl={false}
          interactiveLayerIds={['cp-circles']}
          onClick={handleClick}
          style={{ width: '100%', height: '100%' }}
        >
          {/* Parcela — relleno verde base */}
          {plotGeojson && (
            <Source id="plot" type="geojson" data={plotGeojson}>
              <Layer id="plot-fill" type="fill" paint={{ 'fill-color': '#22c55e', 'fill-opacity': 0.35 }} />
              <Layer id="plot-line" type="line" paint={{ 'line-color': '#15803d', 'line-width': 1.5 }} />
            </Source>
          )}

          {/* Heatmap rojo sobre TODOS los checkpoints con problema (la densidad sube
              donde coinciden varios en un punto). */}
          {fc && fc.features.length > 0 && (
            <Source id="cp-heat-src" type="geojson" data={fc}>
              <Layer
                id="cp-heat"
                type="heatmap"
                paint={{
                  'heatmap-weight': HEAT_WEIGHT as never,
                  'heatmap-color': HEAT_COLOR as never,
                  'heatmap-radius': 38,
                  'heatmap-intensity': 1.4,
                  'heatmap-opacity': 1,
                }}
              />
            </Source>
          )}

          {/* Un marcador por PUNTO con peligro (agrupado por coordenada); clic → popup
              con todos los hallazgos del punto. */}
          {pointsFC.features.length > 0 && (
            <Source id="cp-points-src" type="geojson" data={pointsFC}>
              <Layer
                id="cp-circles"
                type="circle"
                paint={{
                  'circle-radius': 6,
                  'circle-color': CIRCLE_COLOR as never,
                  'circle-stroke-color': '#ffffff',
                  'circle-stroke-width': 1.5,
                  'circle-opacity': 0.95,
                }}
              />
            </Source>
          )}

          {popup && popup.items.length > 0 && (
            <Popup
              longitude={popup.lon}
              latitude={popup.lat}
              closeButton
              closeOnClick={false}
              onClose={() => setPopup(null)}
              anchor="bottom"
              offset={12}
              maxWidth="420px"
              style={{ padding: 0 }}
            >
              <div className="px-2 py-1.5 text-xs">
                <p className="mb-1 font-medium">
                  {popup.items.length} {popup.items.length === 1 ? 'hallazgo' : 'hallazgos'} en este punto
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="text-left text-muted-foreground">
                      <tr>
                        <th className="py-0.5 pr-2 font-medium">Problema</th>
                        <th className="py-0.5 px-1.5 font-medium">Tipo</th>
                        <th className="py-0.5 px-1.5 font-medium">Etapa</th>
                        <th className="py-0.5 px-1.5 text-right font-medium">Cant.</th>
                        <th className="py-0.5 px-1.5 font-medium">Presencia</th>
                        <th className="py-0.5 px-1.5 font-medium">Foto</th>
                        <th className="py-0.5 pl-1.5 font-medium">Nota</th>
                      </tr>
                    </thead>
                    <tbody>
                      {popup.items
                        .slice()
                        .sort((a, b) => (PRESENCE_RANK[b.presence_status] ?? 0) - (PRESENCE_RANK[a.presence_status] ?? 0))
                        .map((it) => (
                          <tr key={it.id} className="border-t">
                            <td className="py-0.5 pr-2 font-medium">{it.issue ?? 'Sin problema'}</td>
                            <td className="py-0.5 px-1.5 text-muted-foreground">{it.issue_type ?? '—'}</td>
                            <td className="py-0.5 px-1.5">{it.stage_display ?? '—'}</td>
                            <td className="py-0.5 px-1.5 text-right">{it.qty ?? '—'}</td>
                            <td className="py-0.5 px-1.5">
                              <span className="inline-flex items-center gap-1 whitespace-nowrap font-medium" style={{ color: PRESENCE_COLOR[it.presence_status] }}>
                                <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: PRESENCE_COLOR[it.presence_status] }} />
                                {PRESENCE_LABEL[it.presence_status] ?? it.presence_status}
                              </span>
                            </td>
                            <td className="py-0.5 pl-1.5">
                              {it.photo ? (
                                <button
                                  type="button"
                                  onClick={() => setPhotoModal(it.photo)}
                                  className="block h-8 w-8 overflow-hidden rounded border transition hover:ring-2 hover:ring-primary"
                                  title="Ver foto completa"
                                >
                                  <img src={it.photo} alt="Foto del hallazgo" className="h-full w-full object-cover" />
                                </button>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                            <td className="py-0.5 pl-1.5">
                              {it.notes ? (
                                <button
                                  type="button"
                                  onClick={() => setNoteModal(it.notes)}
                                  className="whitespace-nowrap text-primary underline underline-offset-2 hover:opacity-80"
                                >
                                  Ver
                                </button>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </Popup>
          )}
        </Map>
      </div>

      {/* Modal de foto completa */}
      <Dialog open={!!photoModal} onOpenChange={(o) => { if (!o) setPhotoModal(null) }}>
        <DialogContent className="max-w-3xl p-2">
          <DialogTitle className="sr-only">Foto del hallazgo</DialogTitle>
          {photoModal && (
            <img src={photoModal} alt="Foto del hallazgo" className="max-h-[80vh] w-full rounded object-contain" />
          )}
        </DialogContent>
      </Dialog>

      {/* Modal de nota */}
      <Dialog open={!!noteModal} onOpenChange={(o) => { if (!o) setNoteModal(null) }}>
        <DialogContent className="max-w-md">
          <DialogTitle>Nota del hallazgo</DialogTitle>
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">{noteModal}</p>
        </DialogContent>
      </Dialog>
    </div>
  )
}
