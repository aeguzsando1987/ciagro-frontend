import { useMemo, useState } from 'react'
import { ArrowLeft, Building2, ChevronRight, SearchX } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { ListSkeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/ui/page-header'
import { SearchInput } from '@/components/ui/search-input'
import { useDataCentralsMain } from './useDataCentralsMain'
import { useDataCentrals } from './useDataCentrals'
import { DataCentralChildSelector } from './DataCentralChildSelector'
import type { EntryTarget } from './entryTarget'
import type { DataCentralMain } from '@/types/workspace'

function ciaCountLabel(value?: number | string) {
  const count = Number(value ?? 0)
  return `${count} ${count === 1 ? 'CIAgro' : 'CIAgros'}`
}

/** Selector jerárquico de organización → CIAgro para Gerente y SuperAdmin. */
export function DataCentralMainSelector({ next }: { next?: EntryTarget }) {
  const [selectedMain, setSelectedMain] = useState<DataCentralMain | null>(null)
  const [search, setSearch] = useState('')
  const {
    data: mains = [],
    isLoading: loadingMains,
    error: mainsError,
    refetch: refetchMains,
  } = useDataCentralsMain()
  const {
    data: children = [],
    isLoading: loadingChildren,
    error: childrenError,
    refetch: refetchChildren,
  } = useDataCentrals(selectedMain?.id)

  const filteredMains = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('es-MX')
    if (!query) return mains
    return mains.filter((main) =>
      `${main.name} ${main.slug}`.toLocaleLowerCase('es-MX').includes(query)
    )
  }, [mains, search])

  if (selectedMain) {
    return (
      <div className="w-full space-y-7">
        <PageHeader
          title={selectedMain.name}
          description="Selecciona la CIAgro con la que deseas trabajar."
          className="[&_h1]:text-[30px] [&_p]:text-[15px]"
          breadcrumbs={
            <Button variant="ghost" size="sm" onClick={() => setSelectedMain(null)}>
              <ArrowLeft />
              Organizaciones
            </Button>
          }
        />

        {loadingChildren ? (
          <ListSkeleton rows={3} label="Cargando CIAgros…" />
        ) : childrenError ? (
          <ErrorState
            title="No pudimos cargar las CIAgros"
            description="Revisa tu conexión e inténtalo nuevamente."
            onRetry={() => void refetchChildren()}
          />
        ) : children.length === 0 ? (
          <EmptyState
            icon={<Building2 />}
            title="Esta organización todavía no tiene CIAgros"
            description="Crea la primera desde Administración → Organizaciones."
          />
        ) : (
          <DataCentralChildSelector
            next={next}
            datacentrals={children}
            title="CIAgros disponibles"
            description={`Unidades pertenecientes a ${selectedMain.name}.`}
            showHeader={false}
          />
        )}
      </div>
    )
  }

  return (
    <div className="w-full space-y-7">
      <PageHeader
        title="Organizaciones"
        description="Selecciona la organización con la que deseas trabajar."
        className="[&_h1]:text-[30px] [&_p]:text-[15px]"
      />

      <SearchInput
        aria-label="Buscar organización"
        placeholder="Buscar organización…"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        onClear={search ? () => setSearch('') : undefined}
        className="h-12 text-base"
        containerClassName="max-w-lg"
      />

      {loadingMains ? (
        <ListSkeleton rows={3} label="Cargando organizaciones…" />
      ) : mainsError ? (
        <ErrorState
          title="No pudimos cargar las organizaciones"
          description="Revisa tu conexión e inténtalo nuevamente."
          onRetry={() => void refetchMains()}
        />
      ) : filteredMains.length === 0 ? (
        <EmptyState
          icon={<SearchX />}
          title={search ? 'No encontramos organizaciones' : 'No hay organizaciones'}
          description={
            search
              ? 'Prueba con otro nombre o limpia la búsqueda.'
              : 'No tienes organizaciones disponibles en este momento.'
          }
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-default bg-surface">
          {filteredMains.map((main, index) => (
            <button
              key={main.id}
              type="button"
              onClick={() => setSelectedMain(main)}
              className={`flex min-h-20 w-full items-center gap-5 px-5 text-left transition-colors duration-150 hover:bg-table-hover focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/25 sm:px-6 ${
                index > 0 ? 'border-t border-border-light' : ''
              }`}
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-brand">
                <Building2 className="h-[22px] w-[22px]" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-base font-semibold text-foreground">
                  {main.name}
                </span>
                <span className="mt-0.5 block text-[15px] text-secondary">
                  {ciaCountLabel(main.datacentrals_count)}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                {main.is_owner && <Badge variant="secondary">Propietario</Badge>}
                {main.status && main.status !== 'active' && (
                  <Badge variant="warning">{main.status}</Badge>
                )}
                <ChevronRight className="h-5 w-5 text-muted" />
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
