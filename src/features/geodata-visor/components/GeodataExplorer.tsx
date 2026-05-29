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
import { useState } from 'react'
import {
  Building2, ChevronDown, ChevronRight, Factory, Layers,
  MapPin, Sprout, Tractor, Loader2,
} from 'lucide-react'
import { useDataCentralMains, useDataCentrals } from '@/features/admin/hooks/useDataCentrals'
import { useProducers } from '@/features/admin/hooks/useProducers'
import { useRanches } from '@/features/admin/hooks/useRanches'
import { usePlots } from '@/features/admin/hooks/usePlots'
import { useAspersionSessionHeaders } from '../hooks/useAspersionSessionHeaders'
import { activeIdFor, type VisorSelection } from '../types'

interface ExplorerProps {
  selection: VisorSelection | null
  onSelect: (sel: VisorSelection) => void
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
      className={`flex cursor-pointer select-none items-center gap-1 rounded px-1 py-1 text-sm hover:bg-accent ${
        selected ? 'bg-accent font-medium' : ''
      }`}
      style={{ paddingLeft: depth * 14 + 4 }}
    >
      <button
        type="button"
        aria-label={expanded ? 'Contraer' : 'Expandir'}
        onClick={(e) => { e.stopPropagation(); onToggle?.() }}
        className="flex h-4 w-4 shrink-0 items-center justify-center text-muted-foreground"
      >
        {expanded === undefined ? null : expanded ? (
          <ChevronDown className="h-3.5 w-3.5" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5" />
        )}
      </button>
      <span className="shrink-0 text-muted-foreground">{icon}</span>
      <span className="truncate">{label}</span>
      {badge && <span className="ml-auto shrink-0 text-xs text-muted-foreground">{badge}</span>}
    </div>
  )
}

function StatusRow({ depth, children }: { depth: number; children: React.ReactNode }) {
  return (
    <div
      className="flex items-center gap-1.5 px-1 py-1 text-xs text-muted-foreground"
      style={{ paddingLeft: depth * 14 + 22 }}
    >
      {children}
    </div>
  )
}

function Loading({ depth }: { depth: number }) {
  return (
    <StatusRow depth={depth}>
      <Loader2 className="h-3 w-3 animate-spin" /> Cargando…
    </StatusRow>
  )
}

function Empty({ depth, text }: { depth: number; text: string }) {
  return <StatusRow depth={depth}>{text}</StatusRow>
}

// ─── Nivel 6: Sesiones de aspersión ───────────────────────────────────────────

function SessionList({ depth, plot, base, selection, onSelect }: {
  depth: number
  plot: { id: string; name: string }
  base: Pick<VisorSelection, 'org' | 'datacentral' | 'producer' | 'ranch'>
  selection: VisorSelection | null
  onSelect: (sel: VisorSelection) => void
}) {
  const { data, isLoading } = useAspersionSessionHeaders(plot.id)
  if (isLoading) return <Loading depth={depth} />
  if (!data || data.length === 0) return <Empty depth={depth} text="Sin sesiones de aspersión." />
  const activeId = activeIdFor(selection)
  return (
    <>
      {data.map((s) => (
        <TreeRow
          key={s.id}
          depth={depth}
          icon={<Layers className="h-3.5 w-3.5" />}
          label={`${s.aspersion_date ?? 'Sin fecha'}${s.points_count ? ` · ${s.points_count} pts` : ''}`}
          selected={selection?.level === 'session' && activeId === s.id}
          onSelect={() => onSelect({
            ...base,
            plot,
            session: { id: s.id, date: s.aspersion_date ?? null },
            level: 'session',
          })}
        />
      ))}
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
        <SessionList depth={depth + 1} plot={plotRef} base={base} selection={selection} onSelect={onSelect} />
      )}
    </>
  )
}

function PlotList({ depth, ranch, base, selection, onSelect }: {
  depth: number
  ranch: { id: string; name: string }
  base: Pick<VisorSelection, 'org' | 'datacentral' | 'producer'>
  selection: VisorSelection | null
  onSelect: (sel: VisorSelection) => void
}) {
  const { data, isLoading } = usePlots({ ranchId: ranch.id })
  if (isLoading) return <Loading depth={depth} />
  if (!data || data.length === 0) return <Empty depth={depth} text="Sin parcelas." />
  const childBase = { ...base, ranch }
  return (
    <>
      {data.map((p) => (
        <PlotNode
          key={p.id}
          depth={depth}
          plotRef={{ id: p.id, name: p.code ?? p.id.slice(0, 8) }}
          base={childBase}
          selection={selection}
          onSelect={onSelect}
        />
      ))}
    </>
  )
}

// ─── Nivel 4: Ranchos ─────────────────────────────────────────────────────────

function RanchNode({ depth, ranchRef, base, selection, onSelect }: {
  depth: number
  ranchRef: { id: string; name: string }
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
        <PlotList depth={depth + 1} ranch={ranchRef} base={base} selection={selection} onSelect={onSelect} />
      )}
    </>
  )
}

function RanchList({ depth, producer, base, selection, onSelect }: {
  depth: number
  producer: { id: string; name: string }
  base: Pick<VisorSelection, 'org' | 'datacentral'>
  selection: VisorSelection | null
  onSelect: (sel: VisorSelection) => void
}) {
  const { data, isLoading } = useRanches(producer.id)
  if (isLoading) return <Loading depth={depth} />
  if (!data || data.length === 0) return <Empty depth={depth} text="Sin ranchos." />
  const childBase = { ...base, producer }
  return (
    <>
      {data.map((r) => (
        <RanchNode
          key={r.id}
          depth={depth}
          ranchRef={{ id: r.id, name: r.name ?? r.code ?? r.id.slice(0, 8) }}
          base={childBase}
          selection={selection}
          onSelect={onSelect}
        />
      ))}
    </>
  )
}

// ─── Nivel 3: Productores ─────────────────────────────────────────────────────

function ProducerNode({ depth, producerRef, base, selection, onSelect }: {
  depth: number
  producerRef: { id: string; name: string }
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
        <RanchList depth={depth + 1} producer={producerRef} base={base} selection={selection} onSelect={onSelect} />
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
  const { data, isLoading } = useProducers(datacentral.id)
  if (isLoading) return <Loading depth={depth} />
  if (!data || data.length === 0) return <Empty depth={depth} text="Sin productores." />
  const childBase = { ...base, datacentral }
  return (
    <>
      {data.map((p) => (
        <ProducerNode
          key={p.id}
          depth={depth}
          producerRef={{ id: p.id, name: p.commercial_name ?? p.code ?? p.id.slice(0, 8) }}
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
        icon={<Factory className="h-3.5 w-3.5" />}
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
  const { data, isLoading } = useDataCentrals(org.id)
  if (isLoading) return <Loading depth={depth} />
  if (!data || data.length === 0) return <Empty depth={depth} text="Sin CIAgros hijas." />
  return (
    <>
      {data.map((dc) => (
        <DataCentralNode
          key={dc.id}
          depth={depth}
          dcRef={{ id: dc.id, name: dc.name }}
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

// ─── Componente raíz ──────────────────────────────────────────────────────────

export function GeodataExplorer({ selection, onSelect }: ExplorerProps) {
  const { data: orgs, isLoading, error } = useDataCentralMains()

  if (isLoading) return <Loading depth={0} />
  if (error) return <Empty depth={0} text="No se pudieron cargar las organizaciones." />
  if (!orgs || orgs.length === 0) return <Empty depth={0} text="No hay organizaciones visibles." />

  return (
    <div role="tree" className="py-1 pr-1">
      {orgs.map((o) => (
        <OrgNode
          key={o.id}
          orgRef={{ id: o.id, name: o.name, count: `${o.datacentrals_count} CIAgros` }}
          selection={selection}
          onSelect={onSelect}
        />
      ))}
    </div>
  )
}
