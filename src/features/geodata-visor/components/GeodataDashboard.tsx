/**
 * Dashboard del Visor de Datos Agrícolas: muestra estadísticas según el nivel
 * seleccionado en el explorador. Las estadísticas se calculan en cliente (decisión
 * 7.D.0) con las funciones puras de lib/visorStats. En los niveles rancho/parcela/sesión
 * dibuja el mapa de polígonos de las parcelas del rancho (RanchPlotsMap); al hacer clic
 * en un polígono se selecciona esa parcela. La integración del visor de aspersión
 * (al elegir una sesión) se añade en 7.E.
 */
import { useState } from 'react'
import { useQueries } from '@tanstack/react-query'
import { ChevronDown, ChevronUp, Loader2 } from 'lucide-react'
import { useProducers } from '@/features/admin/hooks/useProducers'
import { useRanches, ranchesQueryOptions } from '@/features/admin/hooks/useRanches'
import { usePlots, usePlotDetail, plotsQueryOptions } from '@/features/admin/hooks/usePlots'
import { useAspersionSessionHeaders } from '../hooks/useAspersionSessionHeaders'
import {
  type StatEntry,
  sumArea, parseArea,
  datacentralStats, producerStats, ranchStats, plotStats,
} from '../lib/visorStats'
import { RanchPlotsMap } from './RanchPlotsMap'
import { ProducerRanchesMap } from './ProducerRanchesMap'
import { SessionsPanel } from './SessionsPanel'
import { SessionInfoCard } from './SessionInfoCard'
import { AspersionMap } from './AspersionMap'
import { ArrowLeft } from 'lucide-react'
import type { VisorSelection } from '../types'

const LEVEL_TITLE: Record<VisorSelection['level'], string> = {
  org: 'Organización',
  datacentral: 'CIAgro hija',
  producer: 'Productor',
  ranch: 'Rancho',
  plot: 'Parcela',
  session: 'Sesión de aspersión',
}

interface DashboardProps {
  selection: VisorSelection
  onSelect: (sel: VisorSelection) => void
}

// ─── Presentacional ───────────────────────────────────────────────────────────

function StatCard({ label, value }: StatEntry) {
  return (
    <div className="flex items-baseline gap-1.5 rounded-md border bg-card px-2.5 py-1">
      <span className="text-base font-semibold tabular-nums leading-none">{value}</span>
      <span className="text-[11px] text-muted-foreground">{label}</span>
    </div>
  )
}

function StatGrid({ stats, loading }: { stats: StatEntry[]; loading?: boolean }) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Calculando estadísticas…
      </div>
    )
  }
  return (
    <div className="flex flex-wrap gap-2">
      {stats.map((s) => <StatCard key={s.label} {...s} />)}
    </div>
  )
}

// ─── Stats por nivel ──────────────────────────────────────────────────────────

function DataCentralStats({ dcId }: { dcId: string }) {
  const producers = useProducers(dcId)
  const producerIds = producers.data?.map((p) => p.id) ?? []

  const ranchQueries = useQueries({ queries: producerIds.map((id) => ranchesQueryOptions(id)) })
  const plotQueries = useQueries({ queries: producerIds.map((id) => plotsQueryOptions({ producerId: id })) })

  const loading =
    producers.isLoading ||
    ranchQueries.some((q) => q.isLoading) ||
    plotQueries.some((q) => q.isLoading)

  const ranches = ranchQueries.reduce((acc, q) => acc + (q.data?.length ?? 0), 0)
  const plots = plotQueries.reduce((acc, q) => acc + (q.data?.length ?? 0), 0)

  return <StatGrid loading={loading} stats={datacentralStats(producerIds.length, ranches, plots)} />
}

/** Vista de productor: tarjetas de stats + mapa con un pin por rancho. */
function ProducerView({ selection, onSelect, statsHidden }: DashboardProps & { statsHidden: boolean }) {
  const producerId = selection.producer!.id
  const ranches = useRanches(producerId)
  const plots = usePlots({ producerId })
  const loading = ranches.isLoading || plots.isLoading
  const areaHa = sumArea(plots.data ?? [])

  return (
    <div className="flex h-full flex-col gap-2.5">
      {!statsHidden && (
        <StatGrid loading={loading} stats={producerStats(ranches.data?.length ?? 0, plots.data?.length ?? 0, areaHa)} />
      )}
      <div className="relative min-h-[320px] flex-1 overflow-hidden rounded-lg border">
        <ProducerRanchesMap
          ranches={ranches.data ?? []}
          plots={plots.data ?? []}
          producerName={selection.producer?.name}
          onSelectRanch={(ranch) => onSelect(selectRanchFromMap(selection, ranch))}
        />
      </div>
    </div>
  )
}

/** Selección de rancho a partir de la ruta del productor (clic en un pin). */
function selectRanchFromMap(selection: VisorSelection, ranch: { id: string; name: string }): VisorSelection {
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
function selectPlotFromMap(selection: VisorSelection, plot: { id: string; name: string }): VisorSelection {
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
function selectSession(selection: VisorSelection, session: { id: string; date: string | null }): VisorSelection {
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

function RanchView({ selection, onSelect, statsHidden }: DashboardProps & { statsHidden: boolean }) {
  const ranchId = selection.ranch!.id
  const plots = usePlots({ ranchId })
  const areaHa = sumArea(plots.data ?? [])
  const isPlotLevel = selection.level !== 'ranch'
  const isSessionLevel = selection.level === 'session'

  const stats = isPlotLevel ? null : ranchStats(plots.data?.length ?? 0, areaHa)

  return (
    <div className="flex h-full flex-col gap-2.5">
      {!statsHidden && stats && <StatGrid loading={plots.isLoading} stats={stats} />}
      {!statsHidden && isPlotLevel && <PlotStats plotId={selection.plot!.id} />}
      {!statsHidden && isSessionLevel && (
        <SessionInfoCard sessionId={selection.session!.id} datacentralId={selection.datacentral?.id} />
      )}
      <div className="relative min-h-[320px] flex-1 overflow-hidden rounded-lg border">
        {isSessionLevel ? (
          /* Sesión seleccionada: las 5 capas heatmap sobre la parcela (reuso Fase 6).
             La lista de sesiones va en la columna derecha del mapa, y debajo de ella la
             tarjeta de categorías de % de aplicación (renderizada por AspersionMap). */
          <AspersionMap
            sessionId={selection.session!.id}
            plotId={selection.plot!.id}
            floatingToolbar
            sessionsSlot={
              <SessionsPanel
                floating={false}
                plotId={selection.plot!.id}
                selectedSessionId={selection.session?.id ?? null}
                onSelectSession={(session) => onSelect(selectSession(selection, session))}
              />
            }
            toolbarStart={
              <button
                type="button"
                onClick={() => onSelect(selectPlotLevel(selection))}
                className="mr-2 flex h-7 items-center gap-1 rounded-md bg-black/55 px-2.5 text-xs font-medium text-white shadow hover:bg-black/70"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Parcela
              </button>
            }
          />
        ) : (
          <RanchPlotsMap
            plots={plots.data ?? []}
            selectedPlotId={selection.plot?.id ?? null}
            onSelectPlot={(plot) => onSelect(selectPlotFromMap(selection, plot))}
            producerName={selection.producer?.name}
            ranchName={selection.ranch?.name}
            onBackToRanch={() => onSelect(selectRanchLevel(selection))}
            onBackToProducer={selection.producer ? () => onSelect(selectProducerLevel(selection)) : undefined}
          />
        )}
        {/* Nivel parcela (sin sesión): lista de sesiones flotante sobre el mapa de parcelas.
            A nivel sesión la lista vive dentro de AspersionMap (sessionsSlot). */}
        {isPlotLevel && !isSessionLevel && (
          <SessionsPanel
            plotId={selection.plot!.id}
            selectedSessionId={selection.session?.id ?? null}
            onSelectSession={(session) => onSelect(selectSession(selection, session))}
          />
        )}
      </div>
    </div>
  )
}

function PlotStats({ plotId }: { plotId: string }) {
  const plot = usePlotDetail(plotId)
  const sessions = useAspersionSessionHeaders(plotId)
  const loading = plot.isLoading || sessions.isLoading
  const areaHa = parseArea(plot.data?.total_area)
  return <StatGrid loading={loading} stats={plotStats(areaHa, sessions.data?.length ?? 0)} />
}

// ─── Cuerpo del dashboard ──────────────────────────────────────────────────────

function LevelBody({ selection, onSelect, statsHidden }: DashboardProps & { statsHidden: boolean }) {
  switch (selection.level) {
    case 'org':
      return (
        <p className="text-sm text-muted-foreground">
          Selecciona una CIAgro hija para ver sus estadísticas.
        </p>
      )
    case 'datacentral':
      return <DataCentralStats dcId={selection.datacentral!.id} />
    case 'producer':
      return <ProducerView selection={selection} onSelect={onSelect} statsHidden={statsHidden} />
    case 'ranch':
    case 'plot':
    case 'session':
      return <RanchView selection={selection} onSelect={onSelect} statsHidden={statsHidden} />
  }
}

function selectionName(selection: VisorSelection): string {
  switch (selection.level) {
    case 'org': return selection.org.name
    case 'datacentral': return selection.datacentral!.name
    case 'producer': return selection.producer!.name
    case 'ranch': return selection.ranch!.name
    case 'plot': return selection.plot!.name
    case 'session': return selection.session!.date ?? 'Sesión'
  }
}

export function GeodataDashboard({ selection, onSelect }: DashboardProps) {
  const [statsHidden, setStatsHidden] = useState(false)
  // El toggle de estadísticas solo aplica en niveles con mapa (gana alto el mapa).
  const hasMap = selection.level === 'producer' || selection.level === 'ranch' || selection.level === 'plot' || selection.level === 'session'

  return (
    <div className="flex h-full flex-col gap-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <div className="flex items-baseline gap-2">
          <h2 className="text-base font-semibold leading-tight">{selectionName(selection)}</h2>
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
            {LEVEL_TITLE[selection.level]}
          </span>
        </div>
        {hasMap && (
          <button
            type="button"
            onClick={() => setStatsHidden((h) => !h)}
            className="flex shrink-0 items-center gap-1 self-center rounded px-1.5 py-0.5 text-[11px] text-muted-foreground hover:bg-accent"
          >
            {statsHidden ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
            {statsHidden ? 'Mostrar estadísticas' : 'Ocultar estadísticas'}
          </button>
        )}
      </div>
      <div className="min-h-0 flex-1">
        <LevelBody selection={selection} onSelect={onSelect} statsHidden={statsHidden} />
      </div>
    </div>
  )
}
