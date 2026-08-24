import { useMemo, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Building2, ChevronRight, SearchX } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader } from '@/components/ui/page-header'
import { SearchInput } from '@/components/ui/search-input'
import { useWorkspaceStore } from './useWorkspaceStore'
import type { DataCentral } from '@/types/workspace'
import type { WorkspaceDataCentral } from '@/types/auth'

import { targetRouteFor, type EntryTarget } from './entryTarget'

interface Props {
  datacentrals: Array<DataCentral | WorkspaceDataCentral>
  title?: string
  description?: string
  showHeader?: boolean
  /** A dónde llevar tras elegir. Sin él, al Visor. Ver `entryTarget.ts`. */
  next?: EntryTarget
}

/** Selector compacto de CIAgro con búsqueda y estado activo. */
export function DataCentralChildSelector({
  datacentrals,
  title = 'Organizaciones',
  description = 'Selecciona la organización con la que deseas trabajar.',
  showHeader = true,
  next,
}: Props) {
  const navigate = useNavigate()
  const selectedDc = useWorkspaceStore((state) => state.selectedDc)
  const setSelectedDc = useWorkspaceStore((state) => state.setSelectedDc)
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('es-MX')
    if (!query) return datacentrals
    return datacentrals.filter((dc) =>
      `${dc.name} ${dc.slug}`.toLocaleLowerCase('es-MX').includes(query)
    )
  }, [datacentrals, search])

  return (
    <div className="w-full space-y-7">
      {showHeader && (
        <PageHeader
          title={title}
          description={description}
          className="[&_h1]:text-[30px] [&_p]:text-[15px]"
        />
      )}

      <SearchInput
        aria-label="Buscar organización"
        placeholder="Buscar organización…"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        onClear={search ? () => setSearch('') : undefined}
        className="h-12 text-base"
        containerClassName="max-w-lg"
      />

      {filtered.length === 0 ? (
        <EmptyState
          icon={<SearchX />}
          title="No encontramos organizaciones"
          description="Prueba con otro nombre o limpia la búsqueda."
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-default bg-surface">
          {filtered.map((dc, index) => {
            const active = selectedDc?.id === dc.id
            return (
              <button
                key={dc.id}
                type="button"
                aria-current={active ? 'page' : undefined}
                className={`flex min-h-20 w-full items-center gap-5 px-5 text-left transition-colors duration-150 hover:bg-table-hover focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/25 sm:px-6 ${
                  index > 0 ? 'border-t border-border-light' : ''
                } ${active ? 'bg-primary-soft' : ''}`}
                onClick={() => {
                  setSelectedDc({ id: dc.id, name: dc.name })
                  void navigate(targetRouteFor(dc.id, next))
                }}
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-brand">
                  <Building2 className="h-[22px] w-[22px]" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-base font-semibold text-foreground">
                    {dc.name}
                  </span>
                  <span className="mt-0.5 block text-[15px] text-secondary">
                    {'is_primary' in dc && dc.is_primary ? 'CIAgro principal' : '1 CIAgro'}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  {dc.is_owner && <Badge variant="secondary">Propietario</Badge>}
                  <ChevronRight className="h-5 w-5 text-muted" />
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
