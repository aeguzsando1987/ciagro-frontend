import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import type {
  MapCameraSyncBinding,
} from '../lib/mapCameraSync'

import type {
  VisorSession,
} from '../types'

import {
  useNdviTimeline,
} from '../hooks/useNdviTimeline'

import {
  groupSessionsByCycle,
} from '../lib/ndviCycleTimeline'

import {
  NdviMap,
} from './NdviMap'

import {
  NdviProgramAnalysis,
} from './NdviAnalysisCharts'

import {
  GpaLoader,
} from '@/components/ui/gpa-loader'

/* =========================================================
   PROPS
   ========================================================= */

interface NdviTimelineViewProps {
  sessionId: string
  plotId: string
  tenantId?: string
  mapSync?: MapCameraSyncBinding
  comparisonMode?: boolean
  allowedIds?: string[] | null
  onSelectSession: (session: VisorSession) => void
}

/* =========================================================
   FORMATO DE FECHA
   ========================================================= */

function formatCycleDate(
  value: string | null | undefined
): string {
  if (!value) return '—'

  const date = new Date(`${value}T12:00:00`)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
    .format(date)
    .replace('.', '')
}

/* =========================================================
   COMPONENTE
   ========================================================= */

export function NdviTimelineView({
  sessionId,
  plotId,
  tenantId,
  mapSync,
  comparisonMode = false,
  onSelectSession,
}: NdviTimelineViewProps) {
  /* =====================================================
     PLAY AUTOMÁTICO

     La gráfica es ahora la única línea de tiempo visual.
     Play recorre SOLO las sesiones que realmente tienen NDVI.
     Cada punto permanece 1 segundo antes de avanzar.
     ===================================================== */

  const [isPlaying, setIsPlaying] = useState(false)
  const [mapReady, setMapReady] = useState(false)

  /* El análisis inicia contraído para priorizar el mapa. */
  const [analysisOpen, setAnalysisOpen] = useState(false)

  /* =====================================================
     TIMELINE DEL BACKEND
     ===================================================== */

  const {
    data,
    isLoading,
    isError,
  } = useNdviTimeline(plotId)

  /* =====================================================
     SESIONES ORDENADAS
     ===================================================== */

  const sessions = useMemo(
    () =>
      (data ?? [])
        .slice()
        .sort((a, b) => {
          if (!a.session_date && !b.session_date) return 0
          if (!a.session_date) return 1
          if (!b.session_date) return -1
          return a.session_date.localeCompare(b.session_date)
        }),
    [data]
  )

  /* =====================================================
     SUBCICLOS
     ===================================================== */

  const groups = useMemo(
    () => groupSessionsByCycle(sessions),
    [sessions]
  )

  /* =====================================================
     SESIÓN SELECCIONADA
     ===================================================== */

  const selectedSession = useMemo(
    () =>
      sessions.find((item) => item.id === sessionId) ?? null,
    [sessions, sessionId]
  )

  /* =====================================================
     SUBCICLO ACTIVO
     ===================================================== */

  const activeGroup = useMemo(() => {
    const found = groups.find((group) =>
      group.sessions.some((session) => session.id === sessionId)
    )

    return found ?? groups[0] ?? null
  }, [groups, sessionId])

  /* =====================================================
     SESIONES REPRODUCIBLES

     No incluimos semanas grises / sin NDVI.
     ===================================================== */

  const playableSessions = useMemo(
    () =>
      (activeGroup?.slots ?? [])
        .filter(
          (slot) =>
            slot.session !== null &&
            slot.session !== undefined &&
            slot.has_ndvi &&
            slot.session.mean !== null
        )
        .map((slot) => slot.session!),
    [activeGroup]
  )

  /* =====================================================
     AL ABRIR UN SUBCICLO: PRIMER NDVI DISPONIBLE

     Se ejecuta una sola vez por subciclo para no interferir
     después con los clics del usuario en la gráfica.
     ===================================================== */

  const initializedProgramRef = useRef<string | null>(null)

  useEffect(() => {
    const programId = activeGroup?.program_id ?? null
    const first = playableSessions[0]

    if (!programId || !first) return

    if (initializedProgramRef.current === programId) {
      return
    }

    initializedProgramRef.current = programId
    setIsPlaying(false)

    if (sessionId !== first.id) {
      setMapReady(false)
      onSelectSession({
        id: first.id,
        date: first.session_date,
        kind: 'ndvi',
      })
    }
  }, [
    activeGroup?.program_id,
    onSelectSession,
    playableSessions,
    sessionId,
  ])

  /* =====================================================
     REPRODUCCIÓN: 1 SEGUNDO ENTRE PUNTOS REALES
     ===================================================== */

  useEffect(() => {
    if (!isPlaying || !mapReady || playableSessions.length <= 1) {
      return
    }

    const currentIndex = playableSessions.findIndex(
      (session) => session.id === sessionId
    )

    if (currentIndex < 0) {
      return
    }

    if (currentIndex >= playableSessions.length - 1) {
      setIsPlaying(false)
      return
    }

    const timer = window.setTimeout(() => {
      const next = playableSessions[currentIndex + 1]

      if (!next) {
        setIsPlaying(false)
        return
      }

      setMapReady(false)

      onSelectSession({
        id: next.id,
        date: next.session_date,
        kind: 'ndvi',
      })
    }, 1000)

    return () => window.clearTimeout(timer)
  }, [
    isPlaying,
    mapReady,
    onSelectSession,
    playableSessions,
    sessionId,
  ])

  /* =====================================================
     PLAY / PAUSA DESDE LA GRÁFICA
     ===================================================== */

  const handleTogglePlay = () => {
    if (isPlaying) {
      setIsPlaying(false)
      return
    }

    if (playableSessions.length <= 1) {
      return
    }

    const currentIndex = playableSessions.findIndex(
      (session) => session.id === sessionId
    )

    /*
     * Si estamos en el último punto, Play reinicia desde
     * el primer NDVI y desde ahí continúa automáticamente.
     */
    if (
      currentIndex < 0 ||
      currentIndex === playableSessions.length - 1
    ) {
      const first = playableSessions[0]

      if (!first) return

      setMapReady(false)
      onSelectSession({
        id: first.id,
        date: first.session_date,
        kind: 'ndvi',
      })
    }

    setIsPlaying(true)
  }

  /* =====================================================
     SELECCIÓN MANUAL EN LA GRÁFICA

     Al tocar un punto se pausa Play y el mapa de abajo
     recibe inmediatamente la sesión seleccionada.
     ===================================================== */

  const handleSelectFromChart = (session: VisorSession) => {
    setIsPlaying(false)
    setMapReady(false)
    onSelectSession(session)
  }

  /* =====================================================
     COMPARACIÓN A/B
     ===================================================== */

  if (comparisonMode) {
    return (
      <NdviMap
        sessionId={sessionId}
        plotId={plotId}
        tenantId={tenantId}
        mapSync={mapSync}
      />
    )
  }

  /* =====================================================
     ESTADOS
     ===================================================== */

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
        <GpaLoader size="sm" />
        Cargando NDVI…
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center text-sm text-destructive">
        No se pudo cargar la información NDVI del subciclo.
      </div>
    )
  }

  if (!selectedSession) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center text-sm text-muted-foreground">
        No se encontró la sesión NDVI seleccionada.
      </div>
    )
  }

  /* =====================================================
     VISTA FINAL

     1. ÚNICA gráfica / control NDVI esperado vs real.
     2. Mapa de la sesión seleccionada ABAJO.

     Ya no se renderiza una segunda línea de tiempo.
     ===================================================== */

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 overflow-y-auto bg-background pb-2">

      {analysisOpen && (
        <div className="shrink-0">
          <NdviProgramAnalysis
            slots={activeGroup?.slots ?? []}
            selectedSessionId={selectedSession.id}
            selectedSession={selectedSession}
            subcycleName={activeGroup?.productive_cycle_name ?? activeGroup?.program_name ?? undefined}
            parentProgramName={activeGroup?.master_program_name ?? null}
            cropName={activeGroup?.crop_name ?? null}
            cropVarietyName={activeGroup?.crop_variety_name ?? null}
            referenceStart={activeGroup?.reference_start ?? null}
            referenceEnd={activeGroup?.reference_end ?? null}
            ndviReference={activeGroup?.ndvi_reference ?? null}
            isPlaying={isPlaying}
            canPlay={isPlaying || (playableSessions.length > 1 && mapReady)}
            onTogglePlay={handleTogglePlay}
            onSelectSession={handleSelectFromChart}
            onHide={() => setAnalysisOpen(false)}
          />
        </div>
      )}

      <section
        className={[
          'flex shrink-0 flex-col overflow-hidden rounded-xl border bg-background',
          analysisOpen ? 'min-h-[520px]' : 'min-h-[680px] flex-1',
        ].join(' ')}
      >
        <div className="flex h-10 shrink-0 items-center border-b px-3">
          <div>
            <h3 className="text-xs font-semibold">
              Mapa NDVI de la parcela
            </h3>
            {analysisOpen && (
              <p className="mt-0.5 text-[9px] text-muted-foreground">
                El mapa cambia al seleccionar un punto real de la línea de tiempo.
              </p>
            )}
          </div>

          <div className="ml-auto flex items-center gap-2">
            <span className="text-[10px] font-medium text-foreground">
              {formatCycleDate(selectedSession.session_date)}
            </span>

            {!analysisOpen && (
              <button
                type="button"
                onClick={() => setAnalysisOpen(true)}
                className="flex h-7 items-center rounded-md border px-2 text-[9px] font-medium transition hover:bg-accent focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                Ver línea de tiempo
              </button>
            )}
          </div>
        </div>

        <div className={analysisOpen ? 'relative min-h-[470px] flex-1' : 'relative min-h-[630px] flex-1'}>
          <NdviMap
            sessionId={selectedSession.id}
            plotId={plotId}
            tenantId={tenantId}
            mapSync={mapSync}
            onReadyChange={setMapReady}
          />
        </div>
      </section>

    </div>
  )
}
