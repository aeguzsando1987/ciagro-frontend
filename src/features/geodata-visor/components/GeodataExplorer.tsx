/**
 * Explorador jerárquico del Visor de Datos Agrícolas (decisión 7.C.0: componente
 * recursivo propio, sin dependencias). Estilo Explorador de Windows / Object Explorer
 * de SSMS: cada nivel se expande mostrando a sus hijos, que se cargan de forma perezosa
 * (el hook del nivel se dispara al montar su lista, es decir, al expandir el padre).
 *
 * Escalonamiento: Organización → CIAgro hija → Productores → Ranchos → Parcelas → Sesiones.
 * Reutiliza los hooks de la jerarquía (regla de reuso del contrato) y emite una
 * VisorSelection con la ruta completa al hacer clic en cualquier nodo.
 */
import { useEffect, useState, useMemo } from 'react'
import {
  Building2, Bug, CalendarDays, CalendarRange, ChevronDown, ChevronRight, FlaskConical,
  Layers, Leaf, MapPin, RefreshCw, Sprout, Tractor, Wheat,
  LayoutDashboard,
} from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { TruncatedText } from '@/components/ui/truncated-text'
import { SiloIcon } from '@/components/ui/silo-icon'
import { resolveExplorerRoot } from '../lib/explorerRoot'
import { useAuthStore } from '@/features/auth/useAuthStore'
import { ROLE_LEVELS } from '@/lib/auth/roles'
import { useDataCentralMains, useDataCentrals } from '@/features/admin/hooks/useDataCentrals'
import { useProducers } from '@/features/admin/hooks/useProducers'
import { useRanches } from '@/features/admin/hooks/useRanches'
import { usePlots } from '@/features/admin/hooks/usePlots'
import { usePlotSessionTree } from '../hooks/usePlotSessionTree'
import {
  GENERALES_LABEL,
  buildPlotTree,
  incompleteSessionsNotice,
  sessionIdsOf,
  type PlotTree,
  type TreeSession,
  type TypeGroup,
  type YearGroup,
} from '../lib/plotSessionTree'
import {
  activeIdFor,
  type AdvancedSearchResult,
  type SearchProducerNode,
  type SessionKind,
  type VisorSelection,
} from '../types'

interface ExplorerProps {
  selection: VisorSelection | null
  onSelect: (sel: VisorSelection) => void
  /**
   * Modo resultados (fase AS). Con una búsqueda activa el explorador deja de cargar
   * niveles bajo demanda y pinta el árbol que devolvió el endpoint, ya expandido.
   * Los criterios y la petición viven en el shell: aquí solo llega el resultado, para
   * que este componente siga sin depender de una ruta concreta.
   */
  searchActive?: boolean
  searchResult?: AdvancedSearchResult | null
  searchLoading?: boolean
  searchError?: boolean
  onRetrySearch?: () => void
}


function codeLabel(value: string | null | undefined, id: string) {
  const trimmed = value?.trim()
  return trimmed || id.slice(0, 8)
}

// ─── Fila presentacional compartida ──────────────────────────────────────────

interface TreeRowProps {
  depth: number
  icon: React.ReactNode
  label: string
  /** undefined = nodo hoja (sin chevron). */
  expanded?: boolean
  onToggle?: () => void
  selected: boolean
  onSelect: () => void
  badge?: string
}

function TreeRow({ depth, icon, label, expanded, onToggle, selected, onSelect, badge }: TreeRowProps) {
  return (
    <div
      role="treeitem"
      aria-selected={selected}
      aria-expanded={expanded}
      onClick={onSelect}
      onDoubleClick={onToggle}
      className={`mx-1 flex min-h-10 cursor-pointer select-none items-center gap-1.5 rounded-md pr-2 text-[13px] text-secondary transition-colors duration-150 hover:bg-surface-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 ${
        selected ? 'bg-primary-soft font-medium text-brand' : ''
      }`}
      style={{ paddingLeft: depth * 14 + 8 }}
    >
      <button
        type="button"
        aria-label={expanded ? 'Contraer' : 'Expandir'}
        onClick={(e) => { e.stopPropagation(); onToggle?.() }}
        className="flex h-6 w-5 shrink-0 items-center justify-center rounded text-muted hover:bg-surface hover:text-foreground"
      >
        {expanded === undefined ? null : expanded ? (
          <ChevronDown className="h-3.5 w-3.5" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5" />
        )}
      </button>
      <span className={selected ? 'shrink-0 text-brand' : 'shrink-0 text-muted'}>{icon}</span>
      <TruncatedText text={label} />
      {badge && <span className="ml-auto shrink-0 text-[12px] text-muted">{badge}</span>}
    </div>
  )
}

function StatusRow({ depth, children }: { depth: number; children: React.ReactNode }) {
  return (
    <div
      className="flex items-center gap-1.5 px-1 py-1 text-sm text-muted-foreground"
      style={{ paddingLeft: depth * 14 + 22 }}
    >
      {children}
    </div>
  )
}

function Loading({ depth }: { depth: number }) {
  return (
    <StatusRow depth={depth}>
      <Skeleton className="h-3 w-28" />
    </StatusRow>
  )
}

function Empty({ depth, text }: { depth: number; text: string }) {
  return <StatusRow depth={depth}>{text}</StatusRow>
}

function InlineError({ depth, text, onRetry }: { depth: number; text: string; onRetry: () => void }) {
  return (
    <div className="space-y-1 py-2" style={{ paddingLeft: depth * 14 + 22 }}>
      <p className="text-sm leading-5 text-danger">{text}</p>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex min-h-10 items-center gap-1 text-sm font-medium text-brand transition-colors duration-150 hover:text-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
      >
        <RefreshCw className="h-3 w-3" />
        Reintentar
      </button>
    </div>
  )
}

// ─── Nivel 6: Sesiones (FASE CV: Generales > año / ciclo productivo > tipo) ──

/** Fila de agrupacion (Generales, ciclo, tipo, año): un clic abre o cierra, no selecciona. */
function GroupRow({ depth, icon, label, expanded, active, onToggle }: {
  depth: number
  icon: React.ReactNode
  label: string
  expanded: boolean
  active: boolean
  onToggle: () => void
}) {
  return (
    <div
      role="treeitem"
      aria-expanded={expanded}
      onClick={onToggle}
      className={`mx-1 flex min-h-10 cursor-pointer select-none items-center gap-1.5 rounded-md pr-2 text-[13px] transition-colors duration-150 hover:bg-surface-secondary hover:text-foreground ${
        active ? 'text-brand' : 'text-secondary'
      }`}
      style={{ paddingLeft: depth * 14 + 8 }}
    >
      <button
        type="button"
        aria-label={expanded ? 'Contraer' : 'Expandir'}
        onClick={(e) => { e.stopPropagation(); onToggle() }}
        className="flex h-6 w-5 shrink-0 items-center justify-center rounded text-muted hover:bg-surface hover:text-foreground"
      >
        {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
      </button>
      <span className={active ? 'shrink-0 text-brand' : 'shrink-0 text-muted'}>{icon}</span>
      <TruncatedText text={label} />
    </div>
  )
}

/** Nodo de agrupacion; se abre solo si contiene la sesion seleccionada. */
function GroupNode({ depth, icon, label, ids, selection, defaultExpanded = false, children }: {
  depth: number
  icon: React.ReactNode
  label: string
  ids: Set<string>
  selection: VisorSelection | null
  defaultExpanded?: boolean
  children: React.ReactNode
}) {
  const activeId = activeIdFor(selection)
  const containsSelected = selection?.level === 'session' && activeId !== null && ids.has(activeId)
  const [expanded, setExpanded] = useState(defaultExpanded || containsSelected)

  useEffect(() => {
    if (containsSelected) setExpanded(true)
  }, [containsSelected, activeId])

  return (
    <>
      <GroupRow
        depth={depth}
        icon={icon}
        label={label}
        expanded={expanded}
        active={containsSelected}
        onToggle={() => setExpanded((value) => !value)}
      />
      {expanded && children}
    </>
  )
}

interface SessionTreeProps {
  plot: { id: string; name: string }
  base: Pick<VisorSelection, 'org' | 'datacentral' | 'producer' | 'ranch'>
  selection: VisorSelection | null
  onSelect: (sel: VisorSelection) => void
  defaultExpanded?: boolean
}

function SessionLeaf({ depth, session, plot, base, selection, onSelect }: SessionTreeProps & {
  depth: number
  session: TreeSession
}) {
  const activeId = activeIdFor(selection)
  return (
    <TreeRow
      depth={depth}
      icon={SESSION_ICONS[session.kind]}
      label={`${session.date ?? 'Sin fecha'}${session.points_count ? ` · ${session.points_count} pts` : ''}`}
      selected={selection?.level === 'session' && selection.session?.kind === session.kind && activeId === session.id}
      onSelect={() => onSelect({
        ...base,
        plot,
        session: { id: session.id, date: session.date, kind: session.kind },
        level: 'session',
      })}
    />
  )
}

function YearNodes({ depth, years, ...props }: SessionTreeProps & { depth: number; years: YearGroup[] }) {
  return (
    <>
      {years.map((year) => (
        <GroupNode
          key={year.key}
          depth={depth}
          icon={<CalendarDays className="h-3.5 w-3.5" />}
          label={year.label}
          ids={sessionIdsOf(year)}
          selection={props.selection}
          defaultExpanded={props.defaultExpanded}
        >
          {year.sessions.map((session) => (
            <SessionLeaf key={session.id} depth={depth + 1} session={session} {...props} />
          ))}
        </GroupNode>
      ))}
    </>
  )
}

function TypeNodes({ depth, types, ...props }: SessionTreeProps & { depth: number; types: TypeGroup[] }) {
  return (
    <>
      {types.map((type) => (
        <GroupNode
          key={type.key}
          depth={depth}
          icon={SESSION_ICONS[type.kind]}
          label={type.label}
          ids={sessionIdsOf(type)}
          selection={props.selection}
          defaultExpanded={props.defaultExpanded}
        >
          {type.sessions.map((session) => (
            <SessionLeaf key={session.id} depth={depth + 1} session={session} {...props} />
          ))}
        </GroupNode>
      ))}
    </>
  )
}

/** Generales + ciclos productivos (FASE CV). Lo usan el arbol normal y la busqueda. */
function SessionTreeNodes({ depth, tree, ...props }: SessionTreeProps & { depth: number; tree: PlotTree }) {
  const generalesIds = new Set(tree.generales.flatMap((year) => [...sessionIdsOf(year)]))
  return (
    <>
      {tree.generales.length > 0 && (
        <GroupNode
          depth={depth}
          icon={<FlaskConical className="h-3.5 w-3.5" />}
          label={GENERALES_LABEL}
          ids={generalesIds}
          selection={props.selection}
          defaultExpanded={props.defaultExpanded}
        >
          <YearNodes depth={depth + 1} years={tree.generales} {...props} />
        </GroupNode>
      )}
      {tree.cycles.map((cycle) => (
        <GroupNode
          key={cycle.key}
          depth={depth}
          icon={<CalendarRange className="h-3.5 w-3.5" />}
          label={cycle.label}
          ids={sessionIdsOf(cycle)}
          selection={props.selection}
          defaultExpanded={props.defaultExpanded}
        >
          <TypeNodes depth={depth + 1} types={cycle.types} {...props} />
        </GroupNode>
      ))}
    </>
  )
}

/** Sesiones de la parcela agrupadas por Generales y ciclo productivo. */
function PlotSessionTree({ depth, ...props }: SessionTreeProps & { depth: number }) {
  const { tree, total, missing, isLoading, isError, refetch } = usePlotSessionTree(props.plot.id)
  if (isLoading) return <Loading depth={depth} />
  if (isError) return <InlineError depth={depth} text="No pudimos cargar las sesiones." onRetry={refetch} />
  if (tree.generales.length === 0 && tree.cycles.length === 0) {
    return <Empty depth={depth} text="Sin sesiones." />
  }
  const notice = incompleteSessionsNotice(total, missing)
  return (
    <>
      {notice && (
        <StatusRow depth={depth}>
          <span role="status" className="text-warning-foreground">{notice}</span>
        </StatusRow>
      )}
      <SessionTreeNodes depth={depth} tree={tree} {...props} />
    </>
  )
}

// ─── Nivel 5: Parcelas ────────────────────────────────────────────────────────

function PlotNode({ depth, plotRef, base, selection, onSelect }: {
  depth: number
  plotRef: { id: string; name: string }
  base: Pick<VisorSelection, 'org' | 'datacentral' | 'producer' | 'ranch'>
  selection: VisorSelection | null
  onSelect: (sel: VisorSelection) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const activeId = activeIdFor(selection)
  return (
    <>
      <TreeRow
        depth={depth}
        icon={<Sprout className="h-3.5 w-3.5" />}
        label={plotRef.name}
        expanded={expanded}
        onToggle={() => setExpanded((e) => !e)}
        selected={selection?.level === 'plot' && activeId === plotRef.id}
        onSelect={() => onSelect({ ...base, plot: plotRef, level: 'plot' })}
      />
      {expanded && (
        <PlotSessionTree depth={depth + 1} plot={plotRef} base={base} selection={selection} onSelect={onSelect} />
      )}
    </>
  )
}

/** Referencia minima de un nodo del arbol: lo que hace falta para pintarlo y seleccionarlo. */
type RanchRef = { id: string; name: string }
type PlotRef = { id: string; name: string }

function PlotList({ depth, ranch, plots, base, selection, onSelect }: {
  depth: number
  ranch: { id: string; name: string }
  plots: PlotRef[]
  base: Pick<VisorSelection, 'org' | 'datacentral' | 'producer'>
  selection: VisorSelection | null
  onSelect: (sel: VisorSelection) => void
}) {
  // `RanchList` ya trajo las parcelas de todos sus ranchos en una sola peticion, y solo
  // pinta los que tienen alguna: aqui la lista nunca llega vacia.
  if (plots.length === 0) return <Empty depth={depth} text="Sin parcelas." />
  const childBase = { ...base, ranch }
  return (
    <>
      {plots.map((p) => (
        <PlotNode
          key={p.id}
          depth={depth}
          plotRef={p}
          base={childBase}
          selection={selection}
          onSelect={onSelect}
        />
      ))}
    </>
  )
}

// ─── Nivel 4: Ranchos ─────────────────────────────────────────────────────────

function RanchNode({ depth, ranchRef, plots, base, selection, onSelect }: {
  depth: number
  ranchRef: { id: string; name: string }
  /** Ya resueltas por `RanchList`: evita una peticion por rancho al expandir. */
  plots: PlotRef[]
  base: Pick<VisorSelection, 'org' | 'datacentral' | 'producer'>
  selection: VisorSelection | null
  onSelect: (sel: VisorSelection) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const activeId = activeIdFor(selection)
  return (
    <>
      <TreeRow
        depth={depth}
        icon={<MapPin className="h-3.5 w-3.5" />}
        label={ranchRef.name}
        expanded={expanded}
        onToggle={() => setExpanded((e) => !e)}
        selected={selection?.level === 'ranch' && activeId === ranchRef.id}
        onSelect={() => onSelect({ ...base, ranch: ranchRef, level: 'ranch' })}
      />
      {expanded && (
        <PlotList depth={depth + 1} ranch={ranchRef} plots={plots} base={base} selection={selection} onSelect={onSelect} />
      )}
    </>
  )
}

function RanchList({ depth, producer, ranches, base, selection, onSelect }: {
  depth: number
  producer: { id: string; name: string }
  ranches: RanchRef[]
  base: Pick<VisorSelection, 'org' | 'datacentral'>
  selection: VisorSelection | null
  onSelect: (sel: VisorSelection) => void
}) {
  const idsRanchos = useMemo(() => ranches.map((r) => r.id), [ranches])
  // Las parcelas de todos los ranchos del productor de una vez, por el mismo motivo
  // que en el nivel de arriba: una sola peticion y poda antes de pintar.
  const parcelas = usePlots({ ranchIds: idsRanchos })

  if (ranches.length === 0) return <Empty depth={depth} text="Sin ranchos." />
  if (parcelas.isLoading) return <Loading depth={depth} />
  if (parcelas.isError) {
    return <InlineError depth={depth} text="No pudimos cargar las parcelas." onRetry={() => void parcelas.refetch()} />
  }

  const porRancho = new Map<string, PlotRef[]>()
  for (const p of parcelas.data ?? []) {
    if (!p.ranch) continue
    const lista = porRancho.get(p.ranch) ?? []
    lista.push({ id: p.id, name: p.code ?? p.id.slice(0, 8) })
    porRancho.set(p.ranch, lista)
  }
  // Poda: un rancho sin parcelas visibles no lleva a ninguna sesion.
  const conParcelas = ranches.filter((r) => (porRancho.get(r.id) ?? []).length > 0)
  if (conParcelas.length === 0) return <Empty depth={depth} text="Sin ranchos con parcelas." />

  const childBase = { ...base, producer }
  return (
    <>
      {conParcelas.map((r) => (
        <RanchNode
          key={r.id}
          depth={depth}
          ranchRef={r}
          plots={porRancho.get(r.id) ?? []}
          base={childBase}
          selection={selection}
          onSelect={onSelect}
        />
      ))}
    </>
  )
}

// ─── Nivel 3: Productores ─────────────────────────────────────────────────────

function ProducerNode({ depth, producerRef, ranches, base, selection, onSelect }: {
  depth: number
  producerRef: { id: string; name: string }
  /** Ya resueltos por `ProducerList`: evita una peticion por productor al expandir. */
  ranches: RanchRef[]
  base: Pick<VisorSelection, 'org' | 'datacentral'>
  selection: VisorSelection | null
  onSelect: (sel: VisorSelection) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const activeId = activeIdFor(selection)
  return (
    <>
      <TreeRow
        depth={depth}
        icon={<Tractor className="h-3.5 w-3.5" />}
        label={producerRef.name}
        expanded={expanded}
        onToggle={() => setExpanded((e) => !e)}
        selected={selection?.level === 'producer' && activeId === producerRef.id}
        onSelect={() => onSelect({ ...base, producer: producerRef, level: 'producer' })}
      />
      {expanded && (
        <RanchList depth={depth + 1} producer={producerRef} ranches={ranches} base={base} selection={selection} onSelect={onSelect} />
      )}
    </>
  )
}

function ProducerList({ depth, datacentral, base, selection, onSelect }: {
  depth: number
  datacentral: { id: string; name: string }
  base: Pick<VisorSelection, 'org'>
  selection: VisorSelection | null
  onSelect: (sel: VisorSelection) => void
}) {
  const roleLevel = useAuthStore((st) => st.user?.role_level)
  const codeOnlyViewer = roleLevel === ROLE_LEVELS.GUEST
  const { data, isLoading, isError, refetch } = useProducers(datacentral.id)
  const idsProductores = useMemo(() => (data ?? []).map((p) => p.id), [data])
  // Los ranchos de TODA la CIAgro en una sola peticion. Sirve para dos cosas: evita
  // una peticion por productor al expandir, y es lo unico que permite saber, ANTES de
  // pintar, que productores no tienen ningun rancho visible.
  const ranchos = useRanches(null, idsProductores)

  if (isLoading) return <Loading depth={depth} />
  if (isError) return <InlineError depth={depth} text="No pudimos cargar los productores." onRetry={() => void refetch()} />
  if (!data || data.length === 0) return <Empty depth={depth} text="Sin productores." />
  if (ranchos.isLoading) return <Loading depth={depth} />

  const porProductor = new Map<string, RanchRef[]>()
  for (const r of ranchos.data ?? []) {
    if (!r.producer) continue
    const lista = porProductor.get(r.producer) ?? []
    lista.push({ id: r.id, name: codeOnlyViewer ? codeLabel(r.code, r.id) : (r.name ?? r.code ?? r.id.slice(0, 8)) })
    porProductor.set(r.producer, lista)
  }
  // Poda: un productor sin ranchos no tiene nada que explorar en el Visor. Se omite
  // en vez de pintarlo con un "Sin ranchos" debajo, que es ruido en el arbol.
  const conRanchos = data.filter((p) => (porProductor.get(p.id) ?? []).length > 0)
  if (conRanchos.length === 0) return <Empty depth={depth} text="Sin productores con ranchos." />

  const childBase = { ...base, datacentral }
  return (
    <>
      {conRanchos.map((p) => (
        <ProducerNode
          key={p.id}
          depth={depth}
          producerRef={{ id: p.id, name: codeOnlyViewer ? codeLabel(p.code, p.id) : (p.commercial_name ?? p.code ?? p.id.slice(0, 8)) }}
          ranches={porProductor.get(p.id) ?? []}
          base={childBase}
          selection={selection}
          onSelect={onSelect}
        />
      ))}
    </>
  )
}

// ─── Nivel 2: CIAgro hijas (DataCentral) ──────────────────────────────────────

function DataCentralNode({ depth, dcRef, org, selection, onSelect }: {
  depth: number
  dcRef: { id: string; name: string }
  org: { id: string; name: string }
  selection: VisorSelection | null
  onSelect: (sel: VisorSelection) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const activeId = activeIdFor(selection)
  return (
    <>
      <TreeRow
        depth={depth}
        icon={<SiloIcon className="h-3.5 w-3.5" />}
        label={dcRef.name}
        expanded={expanded}
        onToggle={() => setExpanded((e) => !e)}
        selected={selection?.level === 'datacentral' && activeId === dcRef.id}
        onSelect={() => onSelect({ org, datacentral: dcRef, level: 'datacentral' })}
      />
      {expanded && (
        <ProducerList depth={depth + 1} datacentral={dcRef} base={{ org }} selection={selection} onSelect={onSelect} />
      )}
    </>
  )
}

function DataCentralList({ depth, org, selection, onSelect }: {
  depth: number
  org: { id: string; name: string }
  selection: VisorSelection | null
  onSelect: (sel: VisorSelection) => void
}) {
  const roleLevel = useAuthStore((st) => st.user?.role_level)
  const codeOnlyViewer = roleLevel === ROLE_LEVELS.GUEST
  const { data, isLoading, isError, refetch } = useDataCentrals(org.id)
  if (isLoading) return <Loading depth={depth} />
  if (isError) return <InlineError depth={depth} text="No pudimos cargar las CIAgros." onRetry={() => void refetch()} />
  if (!data || data.length === 0) return <Empty depth={depth} text="Sin CIAgros hijas." />
  return (
    <>
      {data.map((dc) => (
        <DataCentralNode
          key={dc.id}
          depth={depth}
          dcRef={{ id: dc.id, name: codeOnlyViewer ? codeLabel(dc.slug, dc.id) : dc.name }}
          org={org}
          selection={selection}
          onSelect={onSelect}
        />
      ))}
    </>
  )
}

// ─── Nivel 1: Organizaciones (raíz) ───────────────────────────────────────────

function OrgNode({ orgRef, selection, onSelect }: {
  orgRef: { id: string; name: string; count?: string }
  selection: VisorSelection | null
  onSelect: (sel: VisorSelection) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const activeId = activeIdFor(selection)
  const org = { id: orgRef.id, name: orgRef.name }
  return (
    <>
      <TreeRow
        depth={0}
        icon={<Building2 className="h-3.5 w-3.5" />}
        label={orgRef.name}
        badge={orgRef.count}
        expanded={expanded}
        onToggle={() => setExpanded((e) => !e)}
        selected={selection?.level === 'org' && activeId === orgRef.id}
        onSelect={() => onSelect({ org, level: 'org' })}
      />
      {expanded && (
        <DataCentralList depth={1} org={org} selection={selection} onSelect={onSelect} />
      )}
    </>
  )
}

// ─── Modo resultados de búsqueda (fase AS) ────────────────────────────────────

const SESSION_ICONS: Record<SessionKind, React.ReactNode> = {
  aspersion: <Layers className="h-3.5 w-3.5" />,
  phyto: <Bug className="h-3.5 w-3.5" />,
  ndvi: <Leaf className="h-3.5 w-3.5" />,
  soil_map: <FlaskConical className="h-3.5 w-3.5" />,
  yield_map: <Wheat className="h-3.5 w-3.5" />,
  planting_map: <Sprout className="h-3.5 w-3.5" />,
}

/** Un productor del resultado, con sus ranchos y parcelas ya expandidos. */
function SearchProducerBranch({ producer, selection, onSelect }: {
  producer: SearchProducerNode
  selection: VisorSelection | null
  onSelect: (sel: VisorSelection) => void
}) {
  const [expanded, setExpanded] = useState(true)
  const activeId = activeIdFor(selection)

  // Sin organización no se puede construir una VisorSelection válida (el dashboard y
  // el mapa NDVI la necesitan), así que el nodo se muestra pero no se selecciona.
  const org = producer.organization
  const producerRef = { id: producer.id, name: producer.name }

  return (
    <>
      <TreeRow
        depth={0}
        icon={<Tractor className="h-3.5 w-3.5" />}
        label={producer.name}
        expanded={expanded}
        onToggle={() => setExpanded((value) => !value)}
        selected={selection?.level === 'producer' && activeId === producer.id}
        onSelect={() => org && onSelect({ org, producer: producerRef, level: 'producer' })}
      />
      {!org && <Empty depth={1} text="Sin organización asociada: no navegable." />}
      {expanded && org &&
        producer.ranches.map((ranch) => (
          <SearchRanchBranch
            key={ranch.id}
            ranch={ranch}
            base={{ org, producer: producerRef }}
            selection={selection}
            onSelect={onSelect}
          />
        ))}
    </>
  )
}

function SearchRanchBranch({ ranch, base, selection, onSelect }: {
  ranch: SearchProducerNode['ranches'][number]
  base: Pick<VisorSelection, 'org' | 'producer'>
  selection: VisorSelection | null
  onSelect: (sel: VisorSelection) => void
}) {
  const [expanded, setExpanded] = useState(true)
  const activeId = activeIdFor(selection)
  const ranchRef = { id: ranch.id, name: ranch.name }

  return (
    <>
      <TreeRow
        depth={1}
        icon={<MapPin className="h-3.5 w-3.5" />}
        label={ranch.name}
        expanded={expanded}
        onToggle={() => setExpanded((value) => !value)}
        selected={selection?.level === 'ranch' && activeId === ranch.id}
        onSelect={() => onSelect({ ...base, ranch: ranchRef, level: 'ranch' })}
      />
      {expanded &&
        ranch.plots.map((plot) => (
          <SearchPlotBranch
            key={plot.id}
            plot={plot}
            base={{ ...base, ranch: ranchRef }}
            selection={selection}
            onSelect={onSelect}
          />
        ))}
    </>
  )
}

/** Parcela del resultado con la misma estructura del arbol normal, ya expandida (D5). */
function SearchPlotBranch({ plot, base, selection, onSelect }: {
  plot: SearchProducerNode['ranches'][number]['plots'][number]
  base: Pick<VisorSelection, 'org' | 'producer' | 'ranch'>
  selection: VisorSelection | null
  onSelect: (sel: VisorSelection) => void
}) {
  const [expanded, setExpanded] = useState(true)
  const activeId = activeIdFor(selection)
  const plotRef = { id: plot.id, name: plot.code }
  // `date` es la del modo de la busqueda (programada o real): se ordena por la fecha filtrada.
  const tree = useMemo(
    () => buildPlotTree(plot.sessions.map((session) => ({
      id: session.id,
      kind: session.kind,
      date: session.date,
      points_count: session.points_count,
      cycle: session.program_cycle,
    }))),
    [plot.sessions],
  )

  return (
    <>
      <TreeRow
        depth={2}
        icon={<Sprout className="h-3.5 w-3.5" />}
        label={plot.code}
        badge={`${plot.sessions.length}`}
        expanded={expanded}
        onToggle={() => setExpanded((value) => !value)}
        selected={selection?.level === 'plot' && activeId === plot.id}
        onSelect={() => onSelect({ ...base, plot: plotRef, level: 'plot' })}
      />
      {expanded && (
        <SessionTreeNodes
          depth={3}
          tree={tree}
          plot={plotRef}
          base={base}
          selection={selection}
          onSelect={onSelect}
          defaultExpanded
        />
      )}
    </>
  )
}

function SearchResultsTree({ result, selection, onSelect }: {
  result: AdvancedSearchResult
  selection: VisorSelection | null
  onSelect: (sel: VisorSelection) => void
}) {
  if (result.producers.length === 0) {
    return <Empty depth={0} text="Ninguna sesión coincide con la búsqueda." />
  }
  return (
    <div role="tree" className="py-1 pr-1">
      {result.truncated && (
        <p className="mx-1 mb-1 rounded border border-dashed px-2 py-1 text-xs leading-4 text-muted-foreground">
          Se muestran las {result.count} sesiones más recientes de {result.total}. Refina la
          búsqueda para ver el resto.
        </p>
      )}
      {result.producers.map((producer) => (
        <SearchProducerBranch
          key={producer.id}
          producer={producer}
          selection={selection}
          onSelect={onSelect}
        />
      ))}
    </div>
  )
}

// ─── Componente raíz ──────────────────────────────────────────────────────────

export function GeodataExplorer({
  selection,
  onSelect,
  searchActive = false,
  searchResult = null,
  searchLoading = false,
  searchError = false,
  onRetrySearch,
}: ExplorerProps) {
  // Los hooks se llaman siempre (regla de hooks); solo cambia lo que se pinta.
  const { data: orgs, isLoading, error, refetch } = useDataCentralMains()

  // Las CIAgros visibles salen de `/users/me/`, que ya está en el store: son las de
  // las organizaciones que posee más las que tiene asignadas, sin las de
  // organizaciones inactivas. Decidir la raíz no cuesta ni una petición extra.
  const misDatacentrals = useAuthStore((st) => st.user?.datacentrals)
  const roleLevel = useAuthStore((st) => st.user?.role_level)
  const codeOnlyViewer = roleLevel === ROLE_LEVELS.GUEST

  const raiz = resolveExplorerRoot({
    orgs: orgs?.length ?? 0,
    datacentrals: misDatacentrals?.length ?? 0,
  })

  if (searchActive && !codeOnlyViewer) {
    if (searchLoading) return <Loading depth={0} />
    if (searchError) {
      return (
        <InlineError
          depth={0}
          text="No pudimos ejecutar la búsqueda."
          onRetry={onRetrySearch ?? (() => {})}
        />
      )
    }
    if (!searchResult) return <Loading depth={0} />
    return <SearchResultsTree result={searchResult} selection={selection} onSelect={onSelect} />
  }

  if (isLoading) return <Loading depth={0} />
  if (error) {
    return (
      <InlineError
        depth={0}
        text="No pudimos cargar las organizaciones."
        onRetry={() => void refetch()}
      />
    )
  }
  if (!orgs || orgs.length === 0) return <Empty depth={0} text="No hay organizaciones visibles." />

  const unicaOrg = orgs[0]
  const unicaDc = misDatacentrals?.[0]

  // Los niveles que se ocultan no desaparecen del modelo: viajan como ancestros
  // implícitos en `base`, que es lo que ya espera cada nivel del árbol. Sin ellos, el
  // dashboard y los mapas no sabrían de qué CIAgro cuelga lo seleccionado.
  const contenido = () => {
    if (raiz === 'producer' && unicaOrg && unicaDc) {
      return (
        <ProducerList
          depth={0}
          datacentral={{ id: unicaDc.id, name: codeOnlyViewer ? codeLabel(unicaDc.slug, unicaDc.id) : unicaDc.name }}
          base={{ org: { id: unicaOrg.id, name: codeOnlyViewer ? codeLabel(unicaOrg.slug, unicaOrg.id) : unicaOrg.name } }}
          selection={selection}
          onSelect={onSelect}
        />
      )
    }
    if (raiz === 'datacentral' && unicaOrg) {
      return (
        <DataCentralList
          depth={0}
          org={{ id: unicaOrg.id, name: codeOnlyViewer ? codeLabel(unicaOrg.slug, unicaOrg.id) : unicaOrg.name }}
          selection={selection}
          onSelect={onSelect}
        />
      )
    }
    return orgs.map((o) => (
      <OrgNode
        key={o.id}
        orgRef={{ id: o.id, name: codeOnlyViewer ? codeLabel(o.slug, o.id) : o.name, count: `${o.datacentrals_count} CIAgros` }}
        selection={selection}
        onSelect={onSelect}
      />
    ))
  }

  return (
    <div role="tree" className="py-1 pr-1">
      {/* Fila fija de vuelta al panel de la CIAgro. Va aparte del árbol a propósito:
          cuando la raíz colapsa, el nodo de CIAgro deja de existir y con él se perdía
          el único camino de regreso al dashboard. Aquí no depende de qué niveles se
          pinten. */}
      {unicaOrg && unicaDc && raiz !== 'org' && (
        <DashboardRow
          org={{ id: unicaOrg.id, name: codeOnlyViewer ? codeLabel(unicaOrg.slug, unicaOrg.id) : unicaOrg.name }}
          datacentral={{ id: unicaDc.id, name: codeOnlyViewer ? codeLabel(unicaDc.slug, unicaDc.id) : unicaDc.name }}
          selection={selection}
          onSelect={onSelect}
        />
      )}
      {contenido()}
    </div>
  )
}

/** Acceso permanente al panel de la CIAgro, sea cual sea la raíz del árbol. */
function DashboardRow({ org, datacentral, selection, onSelect }: {
  org: { id: string; name: string }
  datacentral: { id: string; name: string }
  selection: VisorSelection | null
  onSelect: (sel: VisorSelection) => void
}) {
  const activo = selection?.level === 'datacentral' && selection.datacentral?.id === datacentral.id
  return (
    <TreeRow
      depth={0}
      icon={<LayoutDashboard className="h-3.5 w-3.5" />}
      label="Dashboard"
      selected={activo}
      onSelect={() => onSelect({ org, datacentral, level: 'datacentral' })}
    />
  )
}
