import {
  Bug,
  CalendarDays,
  CheckCircle2,
  Image as ImageIcon,
  Leaf,
  MapPin,
  MessageSquareText,
  X,
} from 'lucide-react'
import type { PhytoCheckpointProps } from '../hooks/usePhytoCheckPoints'
import {
  DISEASE_INDEX_LABEL,
  PEST_INDEX_LABEL,
  PHYTO_INDEX_COLOR,
  type PhytoIndexLevel,
} from '../lib/phytoIndices'

const PRESENCE_COLOR: Record<string, string> = {
  low: '#16a34a',
  warning: '#f59e0b',
  critical: '#dc2626',
}

const PRESENCE_LABEL: Record<string, string> = {
  low: 'Baja',
  warning: 'Advertencia',
  critical: 'Crítica',
}

const PRESENCE_RANK: Record<string, number> = {
  low: 0,
  warning: 1,
  critical: 2,
}

interface PhytoPointPanelProps {
  pointNumber: number
  items: PhytoCheckpointProps[]
  pestQty: number
  pestTolerance: number
  pestLevel: PhytoIndexLevel
  diseaseLevel: PhytoIndexLevel
  lon: number
  lat: number
  hasSessionsSlot?: boolean
  onClose: () => void
  onOpenPhoto: (url: string) => void
  onOpenNote: (note: string) => void
}

function formatCapturedAt(value: string | null): string {
  if (!value) return 'Sin fecha'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('es-MX', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

function primaryDate(items: PhytoCheckpointProps[]): string {
  const values = items
    .map((item) => item.captured_at)
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
  return values.length > 0 ? formatCapturedAt(values[0] ?? null) : 'Sin fecha'
}

function toleranceLabel(value: number): string {
  return value >= 3 ? '3+' : String(value)
}

function IndexChip({
  prefix,
  label,
  level,
}: {
  prefix: string
  label: string
  level: PhytoIndexLevel
}) {
  const color = PHYTO_INDEX_COLOR[level]
  return (
    <span
      className="inline-flex min-h-9 items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold shadow-sm"
      style={{
        borderColor: `${color}55`,
        backgroundColor: `${color}12`,
        color,
      }}
    >
      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
      <span className="text-foreground">
        {prefix} · {label}
      </span>
    </span>
  )
}

function SummaryCard({
  title,
  value,
  icon,
}: {
  title: string
  value: string
  icon?: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-default bg-muted/25 p-3">
      <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {icon}
        {title}
      </div>
      <p className="text-sm font-semibold text-foreground">{value}</p>
    </div>
  )
}

export function PhytoPointPanel({
  pointNumber,
  items,
  pestQty,
  pestTolerance,
  pestLevel,
  diseaseLevel,
  lon,
  lat,
  hasSessionsSlot = false,
  onClose,
  onOpenPhoto,
  onOpenNote,
}: PhytoPointPanelProps) {
  const sortedItems = items
    .slice()
    .sort(
      (a, b) => (PRESENCE_RANK[b.presence_status] ?? 0) - (PRESENCE_RANK[a.presence_status] ?? 0)
    )

  return (
    <aside
      aria-label={`Información del punto ${pointNumber}`}
      className={`absolute bottom-2 left-2 right-2 z-30 flex max-h-[74%] flex-col overflow-hidden rounded-2xl border border-default bg-background/95 shadow-2xl backdrop-blur-sm sm:bottom-auto sm:left-auto sm:top-2 sm:max-h-[calc(100%-1rem)] sm:w-[25rem] sm:rounded-2xl ${
        hasSessionsSlot ? 'sm:right-[15rem]' : 'sm:right-2'
      }`}
    >
      <div className="shrink-0 border-b border-default bg-background px-4 pb-3 pt-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Detalle del monitoreo
            </p>
            <h3 className="mt-0.5 text-2xl font-bold leading-tight text-foreground">
              Punto {pointNumber}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
            aria-label="Cerrar detalle del punto"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <IndexChip prefix="P" label={PEST_INDEX_LABEL[pestLevel]} level={pestLevel} />
          <IndexChip prefix="E" label={DISEASE_INDEX_LABEL[diseaseLevel]} level={diseaseLevel} />
          <span className="inline-flex min-h-9 items-center gap-2 rounded-full border border-emerald-600/25 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Monitoreado
          </span>
        </div>

        <p className="mt-3 text-sm text-muted-foreground">
          Registros en este punto: <strong className="text-foreground">{items.length}</strong>
          <span className="mx-1.5">·</span>
          Cantidad de plagas: <strong className="text-foreground">{pestQty}</strong>
        </p>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        <section>
          <h4 className="mb-2 text-sm font-bold text-foreground">Detalle capturado</h4>
          <div className="space-y-3">
            {sortedItems.map((item, index) => {
              const presenceColor = PRESENCE_COLOR[item.presence_status] ?? '#64748b'
              const title = item.issue ?? 'Sin plaga / enfermedad'
              return (
                <article
                  key={item.id}
                  className="rounded-2xl border border-default bg-background p-3 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[11px] font-medium text-muted-foreground">
                        Registro {index + 1}
                      </p>
                      <p className="truncate text-base font-bold text-foreground" title={title}>
                        {title}
                      </p>
                      {item.issue_type && (
                        <p className="text-xs text-muted-foreground">{item.issue_type}</p>
                      )}
                    </div>
                    <span
                      className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold"
                      style={{ color: presenceColor, backgroundColor: `${presenceColor}12` }}
                    >
                      {PRESENCE_LABEL[item.presence_status] ?? item.presence_status}
                    </span>
                  </div>

                  {(item.notes || item.photo) && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {item.notes && (
                        <button
                          type="button"
                          onClick={() => onOpenNote(item.notes ?? '')}
                          className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-default bg-muted/20 px-3 text-xs font-medium text-foreground transition-colors hover:bg-accent"
                        >
                          <MessageSquareText className="h-4 w-4 text-brand" /> Comentario
                        </button>
                      )}
                      {item.photo && (
                        <button
                          type="button"
                          onClick={() => onOpenPhoto(item.photo ?? '')}
                          className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-default bg-muted/20 px-3 text-xs font-medium text-foreground transition-colors hover:bg-accent"
                        >
                          <ImageIcon className="h-4 w-4 text-brand" /> Foto
                        </button>
                      )}
                    </div>
                  )}

                  <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 text-xs">
                    <dt className="font-semibold text-brand">Fase / presencia:</dt>
                    <dd className="text-foreground">{item.stage_display ?? item.stage ?? '—'}</dd>
                    <dt className="font-semibold text-brand">Cantidad:</dt>
                    <dd className="text-foreground">{item.qty ?? 0}</dd>
                    <dt className="font-semibold text-brand">Severidad:</dt>
                    <dd className="font-semibold" style={{ color: presenceColor }}>
                      {PRESENCE_LABEL[item.presence_status] ?? item.presence_status}
                    </dd>
                    <dt className="font-semibold text-brand">Fecha:</dt>
                    <dd className="text-foreground">{formatCapturedAt(item.captured_at)}</dd>
                  </dl>
                </article>
              )
            })}
          </div>
        </section>

        <section className="grid grid-cols-2 gap-2">
          <SummaryCard
            title="Estado"
            value="Monitoreado"
            icon={<CheckCircle2 className="h-3.5 w-3.5" />}
          />
          <SummaryCard
            title="Fecha principal"
            value={primaryDate(items)}
            icon={<CalendarDays className="h-3.5 w-3.5" />}
          />
          <SummaryCard
            title="Cantidad de plagas"
            value={String(pestQty)}
            icon={<Bug className="h-3.5 w-3.5" />}
          />
          <SummaryCard
            title="Tolerancia"
            value={toleranceLabel(pestTolerance)}
            icon={<Leaf className="h-3.5 w-3.5" />}
          />
        </section>

        <section className="rounded-xl border border-default bg-muted/20 p-3">
          <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" /> Coordenadas GPS
          </div>
          <p className="font-mono text-xs text-foreground">
            {lat.toFixed(6)}, {lon.toFixed(6)}
          </p>
        </section>
      </div>
    </aside>
  )
}
