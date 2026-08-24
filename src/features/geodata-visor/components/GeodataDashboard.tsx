/**
 * Dashboard del Visor de Datos Agrícolas: muestra estadísticas según el nivel
 * seleccionado en el explorador. Las estadísticas se calculan en cliente (decisión
 * 7.D.0) con las funciones puras de lib/visorStats. En los niveles rancho/parcela/sesión
 * dibuja el mapa de polígonos de las parcelas del rancho (RanchPlotsMap); al hacer clic
 * en un polígono se selecciona esa parcela. La integración del visor de aspersión
 * (al elegir una sesión) se añade en 7.E.
 */
import { useMemo, useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useAuthStore } from '@/features/auth/useAuthStore'
import { useProducers } from '@/features/admin/hooks/useProducers'
import { useRanches } from '@/features/admin/hooks/useRanches'
import { usePlots, usePlotDetail } from '@/features/admin/hooks/usePlots'
import { useAspersionSessionHeaders } from '../hooks/useAspersionSessionHeaders'
import { usePhytoSessionHeaders } from '../hooks/usePhytoSessionHeaders'
import { useSoilMapSessionHeaders } from '../hooks/useSoilMapSessionHeaders'
import { useNdviSessionHeaders } from '../hooks/useNdviSessionHeaders'
import {
  type StatEntry,
  sumArea,
  parseArea,
  datacentralStats,
  producerStats,
  ranchStats,
  plotStats,
} from '../lib/visorStats'
import { VisorBreadcrumb } from './VisorBreadcrumb'
import { RanchPlotsMap } from './RanchPlotsMap'
import { ProducerRanchesMap } from './ProducerRanchesMap'
import { SessionsPanel } from './SessionsPanel'
import { PhytoSessionsPanel } from './PhytoSessionsPanel'
import { SoilMapSessionsPanel } from './SoilMapSessionsPanel'
import { PlotSessionsPanel } from './PlotSessionsPanel'
import { SessionInfoCard } from './SessionInfoCard'
import { SoilMapSessionInfoCard } from './SoilMapSessionInfoCard'
import { AspersionMap } from './AspersionMap'
import { NdviMap } from './NdviMap'
import { NdviSessionsPanel } from './NdviSessionsPanel'
import { SoilMap as SoilMapMap } from './SoilMap'
import { PhytoMap } from '@/features/task-manager/components/PhytoMap'
import { PhytoStatsCard } from '@/features/task-manager/components/PhytoStatsCard'
import { SessionReportToggle } from '@/features/session-report/components/SessionReportToggle'
import { ArrowLeft } from 'lucide-react'
import { sessionIdsForPlot } from '../lib/advancedSearch'
import type { MapCameraSyncBinding } from '../lib/mapCameraSync'
import type { AdvancedSearchResult, VisorSelection, VisorSession } from '../types'
import { Skeleton } from '@/components/ui/skeleton'

const LEVEL_TITLE: Record<VisorSelection['level'], string> = {
  org: 'Organización',
  datacentral: 'CIAgro hija',
  producer: 'Productor',
  ranch: 'Rancho',
  plot: 'Parcela',
  session: 'Sesión',
}

/** Etiqueta del nivel; a nivel sesión distingue el tipo de monitoreo. */
function levelTitle(selection: VisorSelection): string {
  if (selection.level === 'session') {
    const kind = selection.session?.kind
    if (kind === 'phyto') return 'Sesión fitosanitaria'
    if (kind === 'ndvi') return 'Sesión NDVI'
    if (kind === 'soil_map') return 'Sesión de mapeo de suelo'
    return 'Sesión de aspersión'
  }
  return LEVEL_TITLE[selection.level]
}

interface DashboardProps {
  selection: VisorSelection
  onSelect: (sel: VisorSelection) => void
  /**
   * Resultado de la búsqueda avanzada (fase AS), o `null` si no hay búsqueda activa.
   * Cuando lo hay, el mapa muestra solo las parcelas involucradas -y se reencuadra a
   * ellas- y las tarjetas de sesiones listan solo las que el filtro devolvió.
   */
  searchResult?: AdvancedSearchResult | null
  /** Reduce chrome y listas duplicadas para reservar ancho a la comparacion A/B. */
  comparisonMode?: boolean
  mapSync?: MapCameraSyncBinding
}

/**
 * Recorta las parcelas a las del resultado de búsqueda.
 *
 * El reencuadre dinámico que pide el use case sale gratis: `RanchPlotsMap` y
 * `ProducerRanchesMap` calculan sus límites a partir del arreglo que reciben.
 */
function plotsInSearch<T extends { id: string }>(
  plots: T[],
  searchResult: AdvancedSearchResult | null | undefined
): T[] {
  if (!searchResult) return plots
  const allowed = new Set(searchResult.plot_ids)
  return plots.filter((plot) => allowed.has(plot.id))
}

// ─── Presentacional ───────────────────────────────────────────────────────────

function StatCard({ label, value }: StatEntry) {
  return (
    <div className="min-w-0 flex-1 px-3 py-2.5 sm:min-w-28 sm:flex-none sm:px-4">
      <span className="block text-xl font-semibold tabular-nums leading-none text-foreground">
        {value}
      </span>
      <span className="mt-1 block text-xs leading-4 text-secondary">{label}</span>
    </div>
  )
}

function StatGrid({ stats, loading }: { stats: StatEntry[]; loading?: boolean }) {
  if (loading) {
    return (
      <div
        role="status"
        aria-label="Calculando estadísticas"
        className="flex gap-px overflow-hidden rounded-xl border border-default bg-border-light"
      >
        <span className="sr-only">Calculando estadísticas…</span>
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="w-32 space-y-2 bg-surface px-4 py-3">
            <Skeleton className="h-5 w-14" />
            <Skeleton className="h-3 w-24" />
          </div>
        ))}
      </div>
    )
  }
  return (
    <div className="flex divide-x divide-border-light overflow-hidden rounded-xl border border-default bg-surface">
      {stats.map((s) => (
        <StatCard key={s.label} {...s} />
      ))}
    </div>
  )
}

// ─── Stats por nivel ──────────────────────────────────────────────────────────

/**
 * Panel de la CIAgro: es la pantalla de entrada del Visor y tambien el punto de
 * retorno —seleccionar la CIAgro en el arbol vuelve aqui desde cualquier nivel—, asi
 * que abre con un saludo en vez de con numeros sueltos. Es el sitio donde iran las
 * estadisticas y graficos generales de la CIAgro.
 */
function DataCentralStats({ dcId, dcName }: { dcId: string; dcName?: string }) {
  const user = useAuthStore((s) => s.user)
  const producers = useProducers(dcId)
  const producerIds = useMemo(() => producers.data?.map((p) => p.id) ?? [], [producers.data])

  // Una peticion por lote en vez de una por productor: este panel es ahora lo primero
  // que se carga al entrar, asi que encadenar N peticiones se nota de inmediato.
  const ranches = useRanches(null, producerIds)
  const plots = usePlots({ producerIds })

  const loading = producers.isLoading || ranches.isLoading || plots.isLoading

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">
          Bienvenido{user?.username ? `, ${user.username}` : ''}
        </h2>
        <p className="text-sm text-muted-foreground">
          Estás en <span className="font-medium text-foreground">{dcName ?? 'esta CIAgro'}</span>.
          Explora el árbol de la izquierda para ver sus productores, ranchos, parcelas y sesiones.
        </p>
      </div>
      <StatGrid
        loading={loading}
        stats={datacentralStats(
          producerIds.length,
          ranches.data?.length ?? 0,
          plots.data?.length ?? 0,
          sumArea(plots.data ?? [])
        )}
      />
    </div>
  )
}

/** Vista de productor: tarjetas de stats + mapa con un pin por rancho. */
function ProducerView({
  selection,
  onSelect,
  statsHidden,
  searchResult,
  mapSync,
}: DashboardProps & { statsHidden: boolean }) {
  const producerId = selection.producer!.id
  const ranches = useRanches(producerId)
  const plots = usePlots({ producerId })
  const loading = ranches.isLoading || plots.isLoading
  // Con búsqueda activa el mapa muestra las parcelas involucradas del productor, a
  // través de todos sus ranchos, y se reencuadra a ellas.
  const visiblePlots = plotsInSearch(plots.data ?? [], searchResult)
  const areaHa = sumArea(visiblePlots)

  return (
    <div className="flex h-full flex-col gap-2.5">
      {!statsHidden && (
        <StatGrid
          loading={loading}
          stats={producerStats(ranches.data?.length ?? 0, visiblePlots.length, areaHa)}
        />
      )}
      <div className="relative min-h-[320px] flex-1 overflow-hidden rounded-lg border">
        <ProducerRanchesMap
          ranches={ranches.data ?? []}
          plots={visiblePlots}
          producerName={selection.producer?.name}
          onSelectRanch={(ranch) => onSelect(selectRanchFromMap(selection, ranch))}
          mapSync={mapSync}
        />
      </div>
    </div>
  )
}

/** Selección de rancho a partir de la ruta del productor (clic en un pin). */
function selectRanchFromMap(
  selection: VisorSelection,
  ranch: { id: string; name: string }
): VisorSelection {
  return {
    org: selection.org,
    datacentral: selection.datacentral,
    producer: selection.producer,
    ranch,
    level: 'ranch',
  }
}

// ─── Vistas con mapa (rancho / parcela / sesión) ──────────────────────────────

/** Selección de parcela a partir de la ruta actual (al hacer clic en el mapa). */
function selectPlotFromMap(
  selection: VisorSelection,
  plot: { id: string; name: string }
): VisorSelection {
  return {
    org: selection.org,
    datacentral: selection.datacentral,
    producer: selection.producer,
    ranch: selection.ranch,
    plot,
    level: 'plot',
  }
}

/** Vuelve a la vista del rancho (deselecciona parcela/sesión). */
function selectRanchLevel(selection: VisorSelection): VisorSelection {
  return {
    org: selection.org,
    datacentral: selection.datacentral,
    producer: selection.producer,
    ranch: selection.ranch,
    level: 'ranch',
  }
}

/** Vuelve a la vista del productor (mapa de pines de ranchos). */
function selectProducerLevel(selection: VisorSelection): VisorSelection {
  return {
    org: selection.org,
    datacentral: selection.datacentral,
    producer: selection.producer,
    level: 'producer',
  }
}

/** Selecciona una sesión conservando la parcela y la ruta actual. */
function selectSession(selection: VisorSelection, session: VisorSession): VisorSelection {
  return {
    org: selection.org,
    datacentral: selection.datacentral,
    producer: selection.producer,
    ranch: selection.ranch,
    plot: selection.plot,
    session,
    level: 'session',
  }
}

/** Vuelve a la parcela (deselecciona la sesión, conserva la parcela). */
function selectPlotLevel(selection: VisorSelection): VisorSelection {
  return {
    org: selection.org,
    datacentral: selection.datacentral,
    producer: selection.producer,
    ranch: selection.ranch,
    plot: selection.plot,
    level: 'plot',
  }
}

function RanchView({
  selection,
  onSelect,
  statsHidden,
  searchResult,
  comparisonMode = false,
  mapSync,
}: DashboardProps & { statsHidden: boolean }) {
  const ranchId = selection.ranch!.id
  const plots = usePlots({ ranchId })
  const visiblePlots = plotsInSearch(plots.data ?? [], searchResult)
  const areaHa = sumArea(visiblePlots)
  const isPlotLevel = selection.level !== 'ranch'
  const isSessionLevel = selection.level === 'session'

  // Ids que la búsqueda permite para ESTA parcela, por tipo. `null` sin búsqueda, con
  // lo que los paneles se comportan como siempre.
  const plotId = selection.plot?.id ?? null
  const allowed = {
    aspersion: plotId ? sessionIdsForPlot(searchResult ?? null, plotId, 'aspersion') : null,
    phyto: plotId ? sessionIdsForPlot(searchResult ?? null, plotId, 'phyto') : null,
    ndvi: plotId ? sessionIdsForPlot(searchResult ?? null, plotId, 'ndvi') : null,
    soil_map: plotId ? sessionIdsForPlot(searchResult ?? null, plotId, 'soil_map') : null,
  }

  const stats = isPlotLevel ? null : ranchStats(visiblePlots.length, areaHa)
  const isPhytoSession = isSessionLevel && selection.session?.kind === 'phyto'
  const isNdviSession = isSessionLevel && selection.session?.kind === 'ndvi'
  const isSoilMapSession = isSessionLevel && selection.session?.kind === 'soil_map'

  const backToPlotButton = (
    <button
      type="button"
      onClick={() => onSelect(selectPlotLevel(selection))}
      className="mr-2 flex h-7 items-center gap-1 rounded-md bg-black/55 px-2.5 text-xs font-medium text-white shadow hover:bg-black/70"
    >
      <ArrowLeft className="h-3.5 w-3.5" /> Parcela
    </button>
  )

  return (
    <div className="flex h-full flex-col gap-2.5">
      {!statsHidden && stats && <StatGrid loading={plots.isLoading} stats={stats} />}
      {!statsHidden && isPlotLevel && <PlotStats plotId={selection.plot!.id} />}
      {!statsHidden && isSessionLevel && !isPhytoSession && !isNdviSession && !isSoilMapSession && (
        <SessionInfoCard
          sessionId={selection.session!.id}
          datacentralId={selection.datacentral?.id}
        />
      )}
      {!statsHidden && isPhytoSession && <PhytoStatsCard headerId={selection.session!.id} />}
      {!statsHidden && isSoilMapSession && (
        <SoilMapSessionInfoCard
          sessionId={selection.session!.id}
          datacentralId={selection.datacentral?.id}
        />
      )}
      <div className="relative min-h-[320px] flex-1 overflow-hidden rounded-lg border">
        {isSessionLevel ? (
          isNdviSession ? (
            /* Sesión NDVI: puntos de muestreo coloreados por clase (cuartiles) sobre la
               parcela. La lista de sesiones NDVI va en la columna derecha. */
            <div className="flex h-full">
              <div className="relative flex-1">
                <NdviMap
                  sessionId={selection.session!.id}
                  plotId={selection.plot!.id}
                  /* La organización del árbol define de quién son los umbrales: el
                     productor puede estar compartido con otra organización. */
                  tenantId={selection.org.id}
                  mapSync={mapSync}
                />
              </div>
              {!comparisonMode && (
                <div className="w-56 shrink-0 border-l bg-background/60 p-2">
                  <NdviSessionsPanel
                    floating={false}
                    plotId={selection.plot!.id}
                    selectedSessionId={selection.session?.id ?? null}
                    onSelectSession={(session) => onSelect(selectSession(selection, session))}
                    allowedIds={allowed.ndvi}
                  />
                </div>
              )}
            </div>
          ) : isPhytoSession ? (
            /* Sesión fitosanitaria: mapa de calor de checkpoints sobre la parcela (reuso
               del PhytoMap del task-manager). La lista de sesiones fitosanitarias va en la
               columna derecha del mapa. */
            <PhytoMap
              sessionId={selection.session!.id}
              plotId={selection.plot!.id}
              floatingToolbar
              mapSync={mapSync}
              sessionsSlot={
                comparisonMode ? undefined : (
                  <PhytoSessionsPanel
                    floating={false}
                    plotId={selection.plot!.id}
                    selectedSessionId={selection.session?.id ?? null}
                    onSelectSession={(session) => onSelect(selectSession(selection, session))}
                    allowedIds={allowed.phyto}
                  />
                )
              }
              toolbarStart={backToPlotButton}
            />
          ) : isSoilMapSession ? (
            /* Sesión de mapeo de suelo: rangos espaciales dentro de la parcela.
               La lista de sesiones comparte la columna derecha del visor. */
            <SoilMapMap
              sessionId={selection.session!.id}
              plotId={selection.plot!.id}
              floatingToolbar
              mapSync={mapSync}
              sessionsSlot={
                comparisonMode ? undefined : (
                  <SoilMapSessionsPanel
                    floating={false}
                    plotId={selection.plot!.id}
                    selectedSessionId={selection.session?.id ?? null}
                    onSelectSession={(session) => onSelect(selectSession(selection, session))}
                    allowedIds={allowed.soil_map}
                  />
                )
              }
              toolbarStart={backToPlotButton}
            />
          ) : (
            /* Sesión de aspersión: las 5 capas heatmap sobre la parcela (reuso Fase 6).
               La lista de sesiones va en la columna derecha del mapa, y debajo de ella la
               tarjeta de categorías de % de aplicación (renderizada por AspersionMap). */
            <AspersionMap
              sessionId={selection.session!.id}
              plotId={selection.plot!.id}
              floatingToolbar
              mapSync={mapSync}
              sessionsSlot={
                comparisonMode ? undefined : (
                  <SessionsPanel
                    floating={false}
                    plotId={selection.plot!.id}
                    selectedSessionId={selection.session?.id ?? null}
                    onSelectSession={(session) => onSelect(selectSession(selection, session))}
                    allowedIds={allowed.aspersion}
                  />
                )
              }
              toolbarStart={backToPlotButton}
              toolbarEnd={
                <SessionReportToggle
                  objectId={selection.session!.id}
                  plotId={selection.plot!.id}
                  datacentralId={selection.datacentral?.id ?? null}
                />
              }
            />
          )
        ) : (
          <RanchPlotsMap
            plots={visiblePlots}
            selectedPlotId={selection.plot?.id ?? null}
            onSelectPlot={(plot) => onSelect(selectPlotFromMap(selection, plot))}
            producerName={selection.producer?.name}
            ranchName={selection.ranch?.name}
            onBackToRanch={() => onSelect(selectRanchLevel(selection))}
            onBackToProducer={
              selection.producer ? () => onSelect(selectProducerLevel(selection)) : undefined
            }
            mapSync={mapSync}
          />
        )}
        {/* Nivel parcela (sin sesión): las listas de sesiones por tipo
            apiladas en una columna flotante sobre el mapa de parcelas. A nivel sesión la
            lista vive dentro del mapa correspondiente (sessionsSlot). */}
        {isPlotLevel && !isSessionLevel && !comparisonMode && (
          <PlotSessionsPanel
            plotId={selection.plot!.id}
            selectedSessionId={selection.session?.id ?? null}
            onSelectSession={(session) => onSelect(selectSession(selection, session))}
            allowedIds={allowed}
          />
        )}
      </div>
    </div>
  )
}

function PlotStats({ plotId }: { plotId: string }) {
  const plot = usePlotDetail(plotId)
  const sessions = useAspersionSessionHeaders(plotId)
  const phytoSessions = usePhytoSessionHeaders(plotId)
  const ndviSessions = useNdviSessionHeaders(plotId)
  const soilMapSessions = useSoilMapSessionHeaders(plotId)
  const loading =
    plot.isLoading ||
    sessions.isLoading ||
    phytoSessions.isLoading ||
    ndviSessions.isLoading ||
    soilMapSessions.isLoading
  const officialAreaHa = parseArea(plot.data?.total_area)
  const stats = [
    ...plotStats(officialAreaHa, sessions.data?.length ?? 0),
    { label: 'Sesiones fitosanitarias', value: String(phytoSessions.data?.length ?? 0) },
    { label: 'Sesiones NDVI', value: String(ndviSessions.data?.length ?? 0) },
    { label: 'Sesiones de mapeo de suelo', value: String(soilMapSessions.data?.length ?? 0) },
  ]
  return <StatGrid loading={loading} stats={stats} />
}

// ─── Cuerpo del dashboard ──────────────────────────────────────────────────────

function LevelBody({
  selection,
  onSelect,
  statsHidden,
  searchResult,
  comparisonMode,
  mapSync,
}: DashboardProps & { statsHidden: boolean }) {
  switch (selection.level) {
    case 'org':
      return (
        <p className="text-sm text-muted-foreground">
          Selecciona una CIAgro hija para ver sus estadísticas.
        </p>
      )
    case 'datacentral':
      return (
        <DataCentralStats
          dcId={selection.datacentral!.id}
          dcName={selection.datacentral!.name}
        />
      )
    case 'producer':
      return (
        <ProducerView
          selection={selection}
          onSelect={onSelect}
          statsHidden={statsHidden}
          searchResult={searchResult}
          comparisonMode={comparisonMode}
          mapSync={mapSync}
        />
      )
    case 'ranch':
    case 'plot':
    case 'session':
      return (
        <RanchView
          selection={selection}
          onSelect={onSelect}
          statsHidden={statsHidden}
          searchResult={searchResult}
          comparisonMode={comparisonMode}
          mapSync={mapSync}
        />
      )
  }
}


export function GeodataDashboard({
  selection,
  onSelect,
  searchResult = null,
  comparisonMode = false,
  mapSync,
}: DashboardProps) {
  const [statsHidden, setStatsHidden] = useState(false)
  // El toggle de estadísticas solo aplica en niveles con mapa (gana alto el mapa).
  const hasMap =
    selection.level === 'producer' ||
    selection.level === 'ranch' ||
    selection.level === 'plot' ||
    selection.level === 'session'

  return (
    <div className="flex h-full flex-col gap-2.5">
      {!comparisonMode && (
        <div className="flex items-baseline justify-between gap-2">
          {/* Las migas sustituyen al titulo suelto: decian el nombre del nodo actual
              pero no como se llego a el, que es lo que el usuario necesita saber
              cuando el explorador oculta niveles o el arbol se ha desplazado. El
              ultimo escalon es el mismo nombre que habia antes. */}
          <div className="flex min-w-0 items-baseline gap-2">
            <VisorBreadcrumb selection={selection} onSelect={onSelect} />
            <span className="shrink-0 text-[11px] uppercase tracking-wide text-muted-foreground">
              {levelTitle(selection)}
            </span>
          </div>
          {hasMap && (
            <button
              type="button"
              onClick={() => setStatsHidden((h) => !h)}
              className="flex shrink-0 items-center gap-1 self-center rounded px-1.5 py-0.5 text-[11px] text-muted-foreground hover:bg-accent"
            >
              {statsHidden ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronUp className="h-3.5 w-3.5" />
              )}
              {statsHidden ? 'Mostrar estadísticas' : 'Ocultar estadísticas'}
            </button>
          )}
        </div>
      )}
      <div className="min-h-0 flex-1">
        <LevelBody
          selection={selection}
          onSelect={onSelect}
          statsHidden={comparisonMode || statsHidden}
          searchResult={searchResult}
          comparisonMode={comparisonMode}
          mapSync={mapSync}
        />
      </div>
    </div>
  )
}
