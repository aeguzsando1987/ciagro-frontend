/**
 * Línea de tiempo NDVI tipo video.
 *
 * Reglas visuales:
 * - Las sesiones con NDVI se muestran como "fotogramas" principales.
 * - Las semanas consecutivas sin NDVI se compactan en un solo bloque gris.
 * - Al tocar un bloque gris se expanden sus semanas internas.
 * - El scrubber inferior solo recorre sesiones con NDVI real.
 * - NDVI = 0 es un valor válido.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, ChevronUp, Leaf } from 'lucide-react'
import type { VisorSession } from '../types'
import type { NdviWeekSlot } from '../lib/ndviCycleTimeline'
import type { NdviColorResolver } from '../lib/ndviConfiguredColor'

interface NdviTimelineProps {
  slots: NdviWeekSlot[]
  selectedSessionId: string | null
  onSelectSession: (session: VisorSession) => void
  onManualNavigation?: () => void
  isPlaying?: boolean
  getNdviColor: NdviColorResolver
}

type TimelineItem =
  | {
      type: 'ndvi'
      key: string
      slot: NdviWeekSlot
    }
  | {
      type: 'gap'
      key: string
      slots: NdviWeekSlot[]
    }

function formatExactSessionDate(value: string): { top: string; bottom: string } {
  const date = new Date(`${value}T12:00:00`)
  if (Number.isNaN(date.getTime())) {
    return { top: value, bottom: '' }
  }

  const top = new Intl.DateTimeFormat('es-MX', {
    day: '2-digit',
    month: 'short',
  })
    .format(date)
    .replace('.', '')

  return {
    top,
    bottom: String(date.getFullYear()),
  }
}

function slotHasNdvi(slot: NdviWeekSlot): boolean {
  return Boolean(slot.session && slot.has_ndvi && slot.session.mean !== null)
}

function buildCompactItems(slots: NdviWeekSlot[]): TimelineItem[] {
  const items: TimelineItem[] = []
  let gapBuffer: NdviWeekSlot[] = []

  const flushGap = () => {
    if (gapBuffer.length === 0) return

    items.push({
      type: 'gap',
      key: `gap:${gapBuffer[0]?.key ?? items.length}`,
      slots: gapBuffer,
    })

    gapBuffer = []
  }

  for (const slot of slots) {
    if (slotHasNdvi(slot)) {
      flushGap()
      items.push({
        type: 'ndvi',
        key: `ndvi:${slot.key}`,
        slot,
      })
    } else {
      gapBuffer.push(slot)
    }
  }

  flushGap()
  return items
}

export function NdviTimeline({
  slots,
  selectedSessionId,
  onSelectSession,
  onManualNavigation,
  isPlaying = false,
  getNdviColor,
}: NdviTimelineProps) {
  const scrollerRef = useRef<HTMLDivElement | null>(null)
  const scrubberSessionRef = useRef<string | null>(null)
  const [expandedGaps, setExpandedGaps] = useState<Set<string>>(() => new Set())
  const [dragProgress, setDragProgress] = useState<number | null>(null)

  const compactItems = useMemo(() => buildCompactItems(slots), [slots])

  const playableSlots = useMemo(
    () =>
      slots
        .map((slot, slotIndex) => ({ slot, slotIndex }))
        .filter(({ slot }) => slotHasNdvi(slot) && slot.session),
    [slots]
  )

  const selectedSlotIndex = useMemo(() => {
    const found = playableSlots.find(({ slot }) => slot.session?.id === selectedSessionId)
    return found?.slotIndex ?? playableSlots[0]?.slotIndex ?? 0
  }, [playableSlots, selectedSessionId])

  const selectedProgress =
    slots.length > 1 ? selectedSlotIndex / Math.max(slots.length - 1, 1) : 0

  const visibleScrubberProgress = dragProgress ?? selectedProgress

  /*
   * Mantiene visible el fotograma activo una vez que termina el arrastre.
   * Mientras el usuario hace scrub, la fila superior no se mueve sola: la
   * línea vertical sigue exactamente la posición del puntero.
   */
  useEffect(() => {
    if (!selectedSessionId || dragProgress !== null) return

    const selectedButton = scrollerRef.current?.querySelector<HTMLElement>(
      `[data-session-id="${selectedSessionId}"]`
    )

    selectedButton?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'center',
    })
  }, [dragProgress, selectedSessionId])

  if (slots.length === 0) {
    return (
      <div className="flex min-h-[48px] items-center justify-center border-t px-4 text-[10px] text-muted-foreground">
        No existen periodos semanales para este subciclo.
      </div>
    )
  }

  const selectLoadedSlot = (slot: NdviWeekSlot) => {
    const session = slot.session
    if (!session || !slotHasNdvi(slot)) return

    onManualNavigation?.()
    onSelectSession({
      id: session.id,
      date: session.session_date,
      kind: 'ndvi',
    })
  }

  /*
   * Scrubber tipo video real:
   * - La posición es continua (0..1), por eso la línea sigue exactamente al mouse.
   * - El eje representa TODAS las semanas del subciclo, incluso las grises.
   * - En un hueco sin NDVI se conserva el último mapa disponible.
   * - El mapa cambia únicamente cuando se alcanza otra semana con NDVI cargado.
   */
  const scrubToProgress = (progressValue: number) => {
    if (slots.length === 0 || playableSlots.length === 0) return

    const progress = Math.min(1, Math.max(0, progressValue))
    const targetSlotIndex = Math.round(progress * Math.max(slots.length - 1, 0))

    const firstPlayable = playableSlots[0]
    if (!firstPlayable) return

    let candidate = firstPlayable

    for (const playable of playableSlots) {
      if (playable.slotIndex <= targetSlotIndex) {
        candidate = playable
      } else {
        break
      }
    }

    const candidateSession = candidate?.slot.session
    if (!candidateSession) return

    if (scrubberSessionRef.current === candidateSession.id) return
    scrubberSessionRef.current = candidateSession.id

    if (candidateSession.id === selectedSessionId) return

    selectLoadedSlot(candidate.slot)
  }

  return (
    <div className="border-t bg-muted/10 px-2 py-1.5">
      <div ref={scrollerRef} className="overflow-x-auto pb-1">
        <div className="flex min-w-max items-start gap-1.5">
          {compactItems.map((item) => {
            if (item.type === 'gap') {
              const expanded = expandedGaps.has(item.key)
              const count = item.slots.length

              return (
                <div key={item.key} className="w-max shrink-0">
                  <button
                    type="button"
                    aria-expanded={expanded}
                    title="Mostrar semanas sin NDVI"
                    onClick={() => {
                      setExpandedGaps((current) => {
                        const next = new Set(current)
                        if (next.has(item.key)) next.delete(item.key)
                        else next.add(item.key)
                        return next
                      })
                    }}
                    className="mx-auto flex h-[50px] w-[60px] flex-col items-center justify-center rounded-md border border-zinc-300 bg-zinc-200 px-1 text-zinc-700 transition hover:bg-zinc-300/80 focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    <span className="text-[9px] font-semibold leading-tight">
                      {count} {count === 1 ? 'semana' : 'semanas'}
                    </span>
                    <span className="mt-0.5 text-[8px] leading-none">sin NDVI</span>
                    {expanded ? (
                      <ChevronUp className="mt-0.5 h-3 w-3" />
                    ) : (
                      <ChevronDown className="mt-0.5 h-3 w-3" />
                    )}
                  </button>

                  {expanded && (
                    <div className="mt-1 flex gap-1 rounded-md border border-zinc-200 bg-zinc-100/80 p-1">
                      {item.slots.map((slot) => {
                        const canSelect = Boolean(slot.session)

                        return (
                          <button
                            key={slot.key}
                            type="button"
                            disabled={!canSelect}
                            title={`${slot.start} a ${slot.end}: sin imagen NDVI`}
                            onClick={() => {
                              if (!slot.session) return
                              onManualNavigation?.()
                              onSelectSession({
                                id: slot.session.id,
                                date: slot.session.session_date,
                                kind: 'ndvi',
                              })
                            }}
                            className="flex h-[42px] w-[54px] shrink-0 flex-col items-center justify-center rounded border border-zinc-300 bg-zinc-200 px-1 text-zinc-600 disabled:cursor-default"
                          >
                            <span className="whitespace-nowrap text-[7px] font-semibold leading-tight">
                              {slot.labelTop}
                            </span>
                            <Leaf className="my-0.5 h-3 w-3" />
                            <span className="text-[7px] leading-none">Sin NDVI</span>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            }

            const slot = item.slot
            const session = slot.session!
            const selected = session.id === selectedSessionId
            const dateLabel = session.session_date
              ? formatExactSessionDate(session.session_date)
              : { top: slot.labelTop, bottom: slot.labelBottom }
            const color =
              session.mean !== null && session.mean !== undefined
                ? getNdviColor(session.mean)
                : null

            return (
              <button
                key={item.key}
                type="button"
                aria-pressed={selected}
                title={
                  session.session_date
                    ? `Imagen NDVI cargada el ${session.session_date}`
                    : 'Imagen NDVI cargada'
                }
                onClick={() => selectLoadedSlot(slot)}
                data-session-id={session.id}
                className={[
                  'relative flex h-[66px] w-[72px] shrink-0 flex-col overflow-hidden rounded-md border text-center transition',
                  'focus:outline-none focus:ring-2 focus:ring-primary/40',
                  selected
                    ? 'border-primary bg-primary/5 shadow-sm ring-1 ring-primary'
                    : 'border-border bg-background hover:border-primary/60 hover:bg-accent/20',
                ].join(' ')}
              >
                {selected && (
                  <span className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-primary/70" />
                )}

                <div className="border-current/10 relative flex h-[27px] flex-col items-center justify-center border-b px-1">
                  <span className="whitespace-nowrap text-[8px] font-semibold leading-tight">
                    {dateLabel.top}
                  </span>
                  <span className="mt-px text-[7px] opacity-65">{dateLabel.bottom}</span>
                </div>

                <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center px-1">
                  {color && (
                    <div
                      className="mb-0.5 h-[13px] w-full rounded-sm border border-black/10"
                      style={{ backgroundColor: color }}
                    />
                  )}
                  <span
                    className="text-[11px] font-bold tabular-nums"
                    style={color ? { color } : undefined}
                  >
                    {session.mean?.toFixed(2) ?? '—'}
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/*
        Scrubber tipo video. La línea vertical sigue exactamente al puntero
        durante el arrastre; el mapa cambia solo al alcanzar semanas con NDVI.
      */}
      <div className="flex items-center gap-2 border-t border-border/60 pt-1.5">
        <span className="shrink-0 text-[8px] text-muted-foreground">NDVI</span>

        <div className="relative h-8 min-w-0 flex-1">
          {/* Track visual: representa TODO el periodo del subciclo. */}
          <div className="pointer-events-none absolute inset-x-0 top-[11px] h-1 overflow-hidden rounded-full bg-zinc-300">
            <div
              className={[
                'h-full rounded-full bg-primary',
                dragProgress === null && isPlaying ? 'transition-[width] duration-300 ease-out' : '',
              ].join(' ')}
              style={{ width: `${visibleScrubberProgress * 100}%` }}
            />
          </div>

          {/*
            Marcas de NDVI cargados. Así se ve de inmediato en qué posiciones
            del periodo existe un mapa real, aunque entre ellos haya huecos grises.
          */}
          <div className="pointer-events-none absolute inset-x-0 top-[7px] h-3">
            {playableSlots.map(({ slot, slotIndex }) => {
              const session = slot.session
              if (!session) return null

              const markerProgress =
                slots.length > 1 ? slotIndex / Math.max(slots.length - 1, 1) : 0
              const markerColor =
                typeof session.mean === 'number' ? getNdviColor(session.mean) : undefined
              const active = session.id === selectedSessionId

              return (
                <span
                  key={`scrubber-marker:${session.id}`}
                  className={[
                    'absolute top-0 -translate-x-1/2 rounded-full border border-background shadow-sm',
                    active ? 'h-3 w-3 ring-1 ring-foreground/35' : 'h-2.5 w-2.5',
                  ].join(' ')}
                  style={{
                    left: `${markerProgress * 100}%`,
                    backgroundColor: markerColor ?? 'currentColor',
                  }}
                />
              )
            })}
          </div>

          {/* Playhead: sigue el mouse al arrastrar y avanza solo con Play. */}
          <div
            className={[
              'pointer-events-none absolute top-0 z-10 h-7 w-px -translate-x-1/2 bg-foreground shadow-[0_0_0_1px_rgba(255,255,255,0.65)]',
              dragProgress === null && isPlaying ? 'transition-[left] duration-300 ease-out' : '',
            ].join(' ')}
            style={{ left: `${visibleScrubberProgress * 100}%` }}
          >
            <span className="absolute left-1/2 top-[11px] h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-foreground shadow-sm" />
          </div>

          {/*
            Range transparente: conserva teclado/accesibilidad y entrega una
            posición continua, no saltos enteros entre sesiones.
          */}
          <input
            type="range"
            min={0}
            max={1000}
            step={1}
            value={Math.round(visibleScrubberProgress * 1000)}
            disabled={playableSlots.length <= 1}
            aria-label="Adelantar o retroceder la línea de tiempo NDVI"
            onPointerDown={() => {
              scrubberSessionRef.current = null
              onManualNavigation?.()
              setDragProgress(selectedProgress)
            }}
            onPointerUp={() => {
              setDragProgress(null)
              scrubberSessionRef.current = null
            }}
            onPointerCancel={() => {
              setDragProgress(null)
              scrubberSessionRef.current = null
            }}
            onBlur={() => {
              setDragProgress(null)
              scrubberSessionRef.current = null
            }}
            onChange={(event) => {
              const progress = Number(event.target.value) / 1000
              setDragProgress(progress)
              scrubToProgress(progress)
            }}
            className="absolute inset-0 z-20 h-full w-full cursor-ew-resize opacity-0 disabled:cursor-default"
          />
        </div>

        <span className="w-[58px] shrink-0 text-right text-[8px] tabular-nums text-muted-foreground">
          {playableSlots.length > 0
            ? `${playableSlots.findIndex(({ slot }) => slot.session?.id === selectedSessionId) + 1 || 1}/${playableSlots.length}`
            : '0/0'}
        </span>
      </div>

      <div className="mt-1 flex items-center justify-center gap-4 text-[8px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-primary" />
          Cada punto = NDVI cargado
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-zinc-400" />
          Semanas sin NDVI agrupadas
        </span>
      </div>
    </div>
  )
}
