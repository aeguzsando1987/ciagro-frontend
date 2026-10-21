// CIAGRO_LINEA_PRO_REFINEMENT_20261020: el modo PARCELA conserva su timeline
/**
 * Dashboard del Visor de Datos Agrícolas: muestra estadísticas según el nivel
 * seleccionado en el explorador. Las estadísticas se calculan en cliente (decisión
 * 7.D.0) con las funciones puras de lib/visorStats. En los niveles rancho/parcela/sesión
 * dibuja el mapa de polígonos de las parcelas del rancho (RanchPlotsMap); al hacer clic
 * en un polígono se selecciona esa parcela. La integración del visor de aspersión
 * (al elegir una sesión) se añade en 7.E.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useAuthStore } from '@/features/auth/useAuthStore'
import { useProducers } from '@/features/admin/hooks/useProducers'
import { useRanches } from '@/features/admin/hooks/useRanches'
import { usePlots, usePlotDetail } from '@/features/admin/hooks/usePlots'
import { useAspersionSessionHeaders } from '../hooks/useAspersionSessionHeaders'
import { usePhytoSessionHeaders } from '../hooks/usePhytoSessionHeaders'
import { useSoilMapSessionHeaders } from '../hooks/useSoilMapSessionHeaders'
import { useNdviSessionHeaders } from '../hooks/useNdviSessionHeaders'
import { useYieldMapHeaders } from '@/features/yield-map/hooks/useYieldMapHeaders'
import { usePlantingMapHeaders } from '@/features/planting-map/hooks/usePlantingMapHeaders'
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
import { SessionInfoCard } from './SessionInfoCard'
import { SoilMapSessionInfoCard } from './SoilMapSessionInfoCard'
import { AspersionMap } from './AspersionMap'
import { NdviMap } from './NdviMap'
import { PlotUnifiedTimeline } from './PlotUnifiedTimeline'
import { SoilMap as SoilMapMap } from './SoilMap'
import { YieldMap } from './YieldMap'
import { PlantingMap } from './PlantingMap'
import { PhytoMap } from '@/features/task-manager/components/PhytoMap'
import { PhytoStatsCard } from '@/features/task-manager/components/PhytoStatsCard'
import { SessionReportToggle } from '@/features/session-report/components/SessionReportToggle'
import { ArrowLeft } from 'lucide-react'
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
    if (kind === 'yield_map') return 'Sesión de rendimiento'
    if (kind === 'planting_map') return 'Sesión de siembra'
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
  /** CIAGRO_SESSION_FOCUSED_LAYOUT_20261020: ocultar chrome sólo en sesión. */
  focusedSession?: boolean
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
    <div className="min-w-[112px] shrink-0 flex-1 px-3 py-2.5 sm:min-w-28 sm:flex-none sm:px-4">
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
        className="flex min-h-[76px] shrink-0 gap-px overflow-hidden rounded-xl border border-default bg-border-light"
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
    <div className="flex min-h-[76px] shrink-0 divide-x divide-border-light overflow-x-auto overflow-y-hidden rounded-xl border border-default bg-surface">
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
  const viewRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!statsHidden) {
      viewRef.current?.scrollTo({ top: 0 })
    }
  }, [statsHidden, selection.level, selection.plot?.id])

  const stats = isPlotLevel ? null : ranchStats(visiblePlots.length, areaHa)
  const isPhytoSession = isSessionLevel && selection.session?.kind === 'phyto'
  const isNdviSession = isSessionLevel && selection.session?.kind === 'ndvi'
  const isSoilMapSession = isSessionLevel && selection.session?.kind === 'soil_map'
  const isYieldMapSession = isSessionLevel && selection.session?.kind === 'yield_map'
  const isPlantingMapSession = isSessionLevel && selection.session?.kind === 'planting_map'
  // La transición se prepara sólo al pulsar Play o elegir otra sesión en la
  // línea de tiempo. Mantenemos la sesión, la fecha y la capa visible hasta que
  // el mapa siguiente (sea del tipo que sea) confirma datos + render de MapLibre.
  const [readyMapKey, setReadyMapKey] = useState<string | null>(null)
  const [pendingSession, setPendingSession] = useState<VisorSession | null>(null)
  const [transitionStopToken, setTransitionStopToken] = useState(0)
  const [transitionError, setTransitionError] = useState(false)
  const selectionRef = useRef(selection)
  const onSelectRef = useRef(onSelect)
  const comparisonModeRef = useRef(comparisonMode)
  const pendingSessionRef = useRef<VisorSession | null>(null)
  const pendingPlotRef = useRef<string | null>(null)
  const pendingSourceSessionRef = useRef<string | null>(null)
  const transitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  selectionRef.current = selection
  onSelectRef.current = onSelect
  comparisonModeRef.current = comparisonMode

  const cancelPendingSession = useCallback(() => {
    pendingSessionRef.current = null
    pendingPlotRef.current = null
    pendingSourceSessionRef.current = null
    setPendingSession(null)
    if (transitionTimerRef.current !== null) {
      clearTimeout(transitionTimerRef.current)
      transitionTimerRef.current = null
    }
  }, [])

  const requestTimelineSession = useCallback((next: VisorSession) => {
    const current = selectionRef.current
    cancelPendingSession()
    setTransitionError(false)
    if (
      !comparisonModeRef.current &&
      current.level === 'session' &&
      current.session && current.plot &&
      (next.kind !== current.session.kind || next.id !== current.session.id)
    ) {
      pendingSessionRef.current = next
      pendingPlotRef.current = current.plot.id
      pendingSourceSessionRef.current = current.session.id
      setPendingSession(next)
      // No existe salto forzado a otro mapa: si falla o tarda demasiado,
      // el usuario conserva la sesión actual y Play se detiene.
      transitionTimerRef.current = setTimeout(() => {
        if (pendingSessionRef.current?.id !== next.id ||
            pendingSessionRef.current?.kind !== next.kind) return
        cancelPendingSession()
        setTransitionStopToken((token) => token + 1)
        setTransitionError(true)
      }, 60_000)
      return
    }
    onSelectRef.current(selectSession(current, next))
  }, [cancelPendingSession])

  const onMapReadyChange = useCallback((ready: boolean, sessionId: string) => {
    const current = selectionRef.current
    const active = current.level === 'session' && current.session?.id === sessionId
    const staged = pendingSessionRef.current
    if (!active && staged?.id !== sessionId) return
    const activeKey = active && current.session
      ? `${current.session.kind}:${current.session.id}` : null
    const stagedKey = staged && staged.id === sessionId
      ? `${staged.kind}:${staged.id}` : null
    if (activeKey && !stagedKey) {
      setReadyMapKey((old) => ready ? activeKey : (old === activeKey ? null : old))
    }
    if (ready && stagedKey && pendingPlotRef.current === current.plot?.id &&
        pendingSourceSessionRef.current === current.session?.id) {
      // El mapa preparado conserva su key: React lo mantiene montado al hacerlo
      // visible, evitando otra descarga o una pantalla de carga intermedia.
      setReadyMapKey(stagedKey)
      cancelPendingSession()
      onSelectRef.current(selectSession(current, staged!))
    }
  }, [cancelPendingSession])

  // Cambio externo desde el explorador: descarta cualquier mapa pendiente.
  useEffect(() => {
    if (!pendingSessionRef.current) return
    if (selection.level !== 'session' || selection.plot?.id !== pendingPlotRef.current ||
        selection.session?.id !== pendingSourceSessionRef.current) {
      cancelPendingSession()
    }
  }, [selection.level, selection.session?.id, selection.plot?.id, cancelPendingSession])

  useEffect(() => () => {
    if (transitionTimerRef.current !== null) clearTimeout(transitionTimerRef.current)
  }, [])

  useEffect(() => {
    setTransitionError(false)
  }, [selection.plot?.id, selection.session?.id])

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
    <div ref={viewRef} className={`flex h-full min-h-0 flex-col overflow-y-auto pr-1 ${isSessionLevel ? 'gap-1.5' : 'gap-2.5'}`}>
      {!statsHidden && stats && <StatGrid loading={plots.isLoading} stats={stats} />}
      {!statsHidden && isPlotLevel && <PlotStats plotId={selection.plot!.id} />}
      {!statsHidden &&
        isSessionLevel &&
        !isPhytoSession &&
        !isNdviSession &&
        !isSoilMapSession &&
        !isYieldMapSession &&
        !isPlantingMapSession && (
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
      {/* La línea de tiempo de PARCELA permanece exactamente arriba y sin cambios. */}
      {selection.level === 'plot' && !comparisonMode && (
        <PlotUnifiedTimeline
          mode={selection.level === 'plot' ? 'parcel' : 'cycle'}
          plotId={selection.plot!.id}
          selectedSession={selection.session ?? null}
          onSelectSession={(session) => onSelect(selectSession(selection, session))}
          defaultCollapsed={isSessionLevel}
        />
      )}
      <div
        className={`relative min-h-[320px] flex-1 rounded-lg border ${
          isNdviSession && !comparisonMode ? 'overflow-y-auto overflow-x-hidden' : 'overflow-hidden'
        }`}
      >
        {isSessionLevel ? (
          <div className="relative h-full w-full">
            {/* Un solo mapa visible y, si hay transición, UNO adicional oculto.
                Sin precargar ciclos ni abrir capas de otra sesión por su cuenta. */}
            {[selection.session!, ...(
              pendingSession && (pendingSession.id !== selection.session!.id || pendingSession.kind !== selection.session!.kind)
                ? [pendingSession] : []
            )].map((session, index) => {
              const staged = index !== 0
              const activeMapSync = staged ? undefined : mapSync
              const key = `${selection.plot!.id}:${session.kind}:${session.id}`
              return (
                <div
                  key={key}
                  className={`absolute inset-0 ${staged ? 'pointer-events-none z-0 opacity-0' : 'z-10'}`}
                  aria-hidden={staged}
                >
                  {session.kind === 'ndvi' ? (
                    <NdviMap
                      showMapModeSelector={!comparisonMode}
                      sessionId={session.id}
                      plotId={selection.plot!.id}
                      tenantId={selection.org.id}
                      mapSync={activeMapSync}
                      onReadyChange={onMapReadyChange}
                    />
                  ) : session.kind === 'phyto' ? (
                    <PhytoMap
                      showMapModeSelector={!comparisonMode}
                      sessionId={session.id}
                      plotId={selection.plot!.id}
                      floatingToolbar
                      comparisonMode={comparisonMode}
                      mapSync={activeMapSync}
                      toolbarStart={backToPlotButton}
                      onReadyChange={onMapReadyChange}
                    />
                  ) : session.kind === 'soil_map' ? (
                    <SoilMapMap
                      showMapModeSelector={!comparisonMode}
                      tenantId={selection.org.id}
                      sessionId={session.id}
                      plotId={selection.plot!.id}
                      floatingToolbar
                      mapSync={activeMapSync}
                      showStatsCards={!comparisonMode}
                      toolbarStart={backToPlotButton}
                      toolbarEnd={<SessionReportToggle
                        objectId={session.id}
                        plotId={selection.plot!.id}
                        datacentralId={selection.datacentral?.id ?? null}
                        sessionType="soilmap"
                      />}
                      onReadyChange={onMapReadyChange}
                    />
                  ) : session.kind === 'yield_map' ? (
                    <YieldMap
                      showMapModeSelector={!comparisonMode}
                      tenantId={selection.org.id}
                      sessionId={session.id}
                      plotId={selection.plot!.id}
                      mapSync={activeMapSync}
                      comparisonMode={comparisonMode}
                      toolbarStart={backToPlotButton}
                      onReadyChange={onMapReadyChange}
                    />
                  ) : session.kind === 'planting_map' ? (
                    <PlantingMap
                      showMapModeSelector={!comparisonMode}
                      tenantId={selection.org.id}
                      sessionId={session.id}
                      plotId={selection.plot!.id}
                      mapSync={activeMapSync}
                      comparisonMode={comparisonMode}
                      toolbarStart={backToPlotButton}
                      onReadyChange={onMapReadyChange}
                    />
                  ) : (
                    <AspersionMap
                      showMapModeSelector={!comparisonMode}
                      tenantId={selection.org.id}
                      sessionId={session.id}
                      plotId={selection.plot!.id}
                      floatingToolbar
                      mapSync={activeMapSync}
                      showCategoryStats={!comparisonMode}
                      toolbarStart={backToPlotButton}
                      toolbarEnd={<SessionReportToggle
                        objectId={session.id}
                        plotId={selection.plot!.id}
                        datacentralId={selection.datacentral?.id ?? null}
                      />}
                      onReadyChange={onMapReadyChange}
                    />
                  )}
                </div>
              )
            })}
            {pendingSession && (
              <div role="status" className="pointer-events-none absolute bottom-3 right-3 z-20 rounded-md bg-black/65 px-3 py-2 text-xs text-white">
                Preparando siguiente mapa…
              </div>
            )}
            {transitionError && !pendingSession && (
              <div role="alert" className="pointer-events-none absolute bottom-3 right-3 z-20 rounded-md bg-black/75 px-3 py-2 text-xs text-white">
                No se pudo preparar el siguiente mapa. Se conserva la sesión actual.
              </div>
            )}
          </div>
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
      </div>
      {/* CIAGRO_SESSION_FOCUSED_LAYOUT_20261020: sólo sesiones; el Play queda
          visible incluso cuando el cuerpo de la línea de tiempo está contraído. */}
      {isSessionLevel && !comparisonMode && (
        <PlotUnifiedTimeline
          mode="cycle"
          plotId={selection.plot!.id}
          selectedSession={selection.session ?? null}
          mapReady={readyMapKey === `${selection.session?.kind}:${selection.session?.id}`}
          onSelectSession={requestTimelineSession}
          onCancelPendingSelection={cancelPendingSession}
          stopToken={transitionStopToken}
          defaultCollapsed
        />
      )}
    </div>
  )
}

function PlotStats({ plotId }: { plotId: string }) {
  const plot = usePlotDetail(plotId)
  const sessions = useAspersionSessionHeaders(plotId)
  const phytoSessions = usePhytoSessionHeaders(plotId)
  const ndviSessions = useNdviSessionHeaders(plotId)
  const soilMapSessions = useSoilMapSessionHeaders(plotId)
  const yieldMapSessions = useYieldMapHeaders(plotId)
  const plantingMapSessions = usePlantingMapHeaders(plotId)
  const loading =
    plot.isLoading ||
    sessions.isLoading ||
    phytoSessions.isLoading ||
    ndviSessions.isLoading ||
    soilMapSessions.isLoading ||
    yieldMapSessions.isLoading ||
    plantingMapSessions.isLoading
  const officialAreaHa = parseArea(plot.data?.total_area)
  const stats = [
    ...plotStats(officialAreaHa, sessions.data?.length ?? 0),
    { label: 'Sesiones fitosanitarias', value: String(phytoSessions.data?.length ?? 0) },
    { label: 'Sesiones NDVI', value: String(ndviSessions.data?.length ?? 0) },
    { label: 'Sesiones de mapeo de suelo', value: String(soilMapSessions.data?.length ?? 0) },
    { label: 'Sesiones de rendimiento', value: String(yieldMapSessions.data?.length ?? 0) },
    { label: 'Sesiones de siembra', value: String(plantingMapSessions.data?.length ?? 0) },
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
        <DataCentralStats dcId={selection.datacentral!.id} dcName={selection.datacentral!.name} />
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
  focusedSession = false,
  mapSync,
}: DashboardProps) {
  const [statsHidden, setStatsHidden] = useState(true)
  // El toggle de estadísticas solo aplica en niveles con mapa (gana alto el mapa).
  const hasMap =
    selection.level === 'producer' ||
    selection.level === 'ranch' ||
    selection.level === 'plot' ||
    selection.level === 'session'

  return (
    <div className="flex h-full flex-col gap-2.5">
      {!comparisonMode && !(focusedSession && selection.level === 'session') && (
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
          statsHidden={comparisonMode || statsHidden || (focusedSession && selection.level === 'session')}
          searchResult={searchResult}
          comparisonMode={comparisonMode}
          mapSync={mapSync}
        />
      </div>
    </div>
  )
}
